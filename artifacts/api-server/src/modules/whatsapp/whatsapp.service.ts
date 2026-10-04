import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db,
  whatsappDispatchesTable,
  workspaceIntegrationsTable,
  workspacesTable,
  usersTable,
  contentPiecesTable,
  launchSequenceItemsTable,
  sequenceContactsTable,
} from "@workspace/db";
import { NotFoundError, ValidationError, AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";
import { recordEngagementEvent } from "../launch-sequence/sequence-analytics.service.js";
import { emitSequenceEvent } from "../launch-sequence/sequence-realtime.js";
import { runWhatsAppResponseAgent } from "../agents/whatsapp-response.agent.js";
import { enforceNoMandatoryPause } from "../autonomy/autonomy.service.js";
import { authorizeAutonomousResponse, ingestInboundCommunityEvent } from "../community/community.service.js";

export class AmbiguousWhatsAppDispatchError extends Error {
  readonly code = "WHATSAPP_DISPATCH_AMBIGUOUS";
}

/** Native transport/parse failures happen after the mutation may have been
 * accepted by Meta. They are never safe to retry automatically. */
export function classifyWhatsAppTransportError(error: unknown): AmbiguousWhatsAppDispatchError | null {
  return error instanceof AppError ? null : new AmbiguousWhatsAppDispatchError("WhatsApp provider outcome is ambiguous");
}

// ─── Meta WhatsApp Business API ───────────────────────────────────────────────

interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
}

async function getWhatsAppCredentials(workspaceId: string): Promise<WhatsAppCredentials> {
  const [integration] = await db
    .select({
      accessToken: workspaceIntegrationsTable.accessToken,
      accountId: workspaceIntegrationsTable.accountId,
      accountName: workspaceIntegrationsTable.accountName,
      metadata: workspaceIntegrationsTable.metadata,
    })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, "whatsapp_business"),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    );

  if (!integration?.accessToken || !integration.accountId) {
    throw new ValidationError(
      "WhatsApp Business não está conectado. Configure a integração em Configurações > Integrações.",
    );
  }

  return {
    accessToken: integration.accessToken,
    phoneNumberId: integration.accountId,
    displayPhoneNumber: integration.accountName ?? undefined,
  };
}

interface MetaSendResult {
  messageId: string;
  recipientPhone: string;
}

async function sendMetaTextMessage(
  creds: WhatsAppCredentials,
  recipientPhone: string,
  message: string,
): Promise<MetaSendResult> {
  const res = await metaGraphFetch(
    `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "text",
        text: { preview_url: false, body: message },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(502, `Erro ao enviar WhatsApp: ${err}`);
  }

  const data = (await res.json()) as { messages?: Array<{ id: string }> };
  return {
    messageId: data.messages?.[0]?.id ?? "",
    recipientPhone,
  };
}

async function sendMetaTemplateMessage(
  creds: WhatsAppCredentials,
  recipientPhone: string,
  templateName: string,
  params: Record<string, string>,
): Promise<MetaSendResult> {
  const components =
    Object.keys(params).length > 0
      ? [
          {
            type: "body",
            parameters: Object.values(params).map((v) => ({ type: "text", text: v })),
          },
        ]
      : [];

  const res = await metaGraphFetch(
    `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "pt_BR" },
          components,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(502, `Erro ao enviar template WhatsApp: ${err}`);
  }

  const data = (await res.json()) as { messages?: Array<{ id: string }> };
  return { messageId: data.messages?.[0]?.id ?? "", recipientPhone };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getWhatsAppStatus(workspaceId: string) {
  const [integration] = await db
    .select({
      status: workspaceIntegrationsTable.status,
      accountId: workspaceIntegrationsTable.accountId,
      accountName: workspaceIntegrationsTable.accountName,
      metadata: workspaceIntegrationsTable.metadata,
    })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, "whatsapp_business"),
      ),
    );

  return {
    connected: integration?.status === "connected",
    phoneNumber: integration?.accountName ?? null,
    phoneNumberId: integration?.accountId ?? null,
    status: integration?.status ?? "disconnected",
  };
}

export async function createWhatsAppDispatch(
  workspaceId: string,
  input: {
    campaignId?: string;
    sequenceItemId?: string;
    type: "broadcast" | "individual" | "group" | "template";
    recipients: string[];
    message?: string;
    contentPieceId?: string;
    mediaUrl?: string;
    mediaType?: string;
    templateName?: string;
    templateParams?: Record<string, string>;
    scheduledAt?: string;
    idempotencyKey?: string;
  },
) {
  if (!input.message && !input.contentPieceId && !input.templateName) {
    throw new ValidationError("Forneça message, contentPieceId ou templateName");
  }
  if (input.recipients.length === 0) {
    throw new ValidationError("Informe ao menos um destinatário");
  }
  if (input.idempotencyKey) {
    const [existing] = await db.select().from(whatsappDispatchesTable).where(and(
      eq(whatsappDispatchesTable.workspaceId, workspaceId),
      eq(whatsappDispatchesTable.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (existing) return existing;
  }

  let message = input.message ?? "";

  if (!message && input.contentPieceId) {
    const [piece] = await db
      .select({ content: contentPiecesTable.content })
      .from(contentPiecesTable)
      .where(
        and(
          eq(contentPiecesTable.id, input.contentPieceId),
          eq(contentPiecesTable.workspaceId, workspaceId),
        ),
      );
    if (piece) {
      const c = piece.content as Record<string, unknown>;
      message = String(c["body"] ?? c["text"] ?? c["message"] ?? c["content"] ?? "");
    }
  }

  const creds = await getWhatsAppCredentials(workspaceId);

  let [dispatch] = await db
    .insert(whatsappDispatchesTable)
    .values({
      workspaceId,
      campaignId: input.campaignId ?? null,
      sequenceItemId: input.sequenceItemId ?? null,
      phoneNumberId: creds.phoneNumberId,
      displayPhoneNumber: creds.displayPhoneNumber ?? null,
      type: input.type,
      recipients: input.recipients,
      contentPieceId: input.contentPieceId ?? null,
      message: message || (input.templateName ?? ""),
      mediaUrl: input.mediaUrl ?? null,
      mediaType: input.mediaType ?? null,
      templateName: input.templateName ?? null,
      templateParams: input.templateParams ?? {},
      recipientCount: input.recipients.length,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      idempotencyKey: input.idempotencyKey ?? null,
    })
    .onConflictDoNothing()
    .returning();
  if (!dispatch && input.idempotencyKey) {
    [dispatch] = await db.select().from(whatsappDispatchesTable).where(and(
      eq(whatsappDispatchesTable.workspaceId, workspaceId),
      eq(whatsappDispatchesTable.idempotencyKey, input.idempotencyKey),
    )).limit(1);
  }

  return dispatch!;
}

export async function sendWhatsAppDispatch(workspaceId: string, dispatchId: string) {
  const [dispatch] = await db
    .select()
    .from(whatsappDispatchesTable)
    .where(
      and(
        eq(whatsappDispatchesTable.id, dispatchId),
        eq(whatsappDispatchesTable.workspaceId, workspaceId),
      ),
    );
  if (!dispatch) throw new NotFoundError("WhatsApp dispatch not found");
  if (["sent", "delivered", "read"].includes(dispatch.status)) return dispatch;
  if (dispatch.status === "sending" || dispatch.status === "ambiguous") return dispatch;
  if (!["queued", "failed"].includes(dispatch.status))
    throw new ValidationError("Dispatch já enviado ou cancelado");
  await enforceNoMandatoryPause(workspaceId, {
    campaignId: dispatch.campaignId ?? undefined,
    channel: "whatsapp",
    action: "whatsapp_dispatch",
  });

  const [claimed] = await db
    .update(whatsappDispatchesTable)
    .set({ status: "sending" })
    .where(and(eq(whatsappDispatchesTable.id, dispatchId), eq(whatsappDispatchesTable.workspaceId, workspaceId), inArray(whatsappDispatchesTable.status, ["queued", "failed"])))
    .returning();
  if (!claimed) return dispatch;

  try {
    const creds = await getWhatsAppCredentials(workspaceId);
    const recipients = dispatch.recipients as string[];
    const results: MetaSendResult[] = [];
    const failedCount = { count: 0 };

    if (dispatch.scheduledAt && dispatch.scheduledAt > new Date()) {
      await db
        .update(whatsappDispatchesTable)
        .set({ status: "queued" })
        .where(eq(whatsappDispatchesTable.id, dispatchId));
      return dispatch;
    }

    for (const phone of recipients) {
      try {
        await enforceNoMandatoryPause(workspaceId, {
          campaignId: dispatch.campaignId ?? undefined,
          channel: "whatsapp",
          action: "whatsapp_dispatch",
        });
        let result: MetaSendResult;
        if (dispatch.templateName) {
          result = await sendMetaTemplateMessage(
            creds,
            phone,
            dispatch.templateName,
            (dispatch.templateParams ?? {}) as Record<string, string>,
          );
        } else {
          result = await sendMetaTextMessage(creds, phone, dispatch.message);
        }
        results.push(result);
      } catch (err) {
        if (err instanceof AppError && err.code === "MANDATORY_PAUSE_ACTIVE") throw err;
        const transportAmbiguity = classifyWhatsAppTransportError(err);
        if (transportAmbiguity) throw transportAmbiguity;
        failedCount.count++;
        logger.warn({ err }, "WhatsApp send failed for recipient");
      }
    }

    const messageIds = results.map((r) => r.messageId);
    const [updated] = await db
      .update(whatsappDispatchesTable)
      .set({
        status: failedCount.count === recipients.length ? "failed" : "sent",
        sentAt: new Date(),
        externalMessageIds: messageIds,
        deliveredCount: results.length,
        failedCount: failedCount.count,
      })
      .where(eq(whatsappDispatchesTable.id, dispatchId))
      .returning();

    return updated!;
  } catch (err) {
    await db
      .update(whatsappDispatchesTable)
      .set({
        status: err instanceof AppError && err.code === "MANDATORY_PAUSE_ACTIVE" ? "queued"
          : err instanceof AmbiguousWhatsAppDispatchError ? "ambiguous" : "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(whatsappDispatchesTable.id, dispatchId));
    throw err;
  }
}

export async function getWhatsAppDispatches(workspaceId: string, campaignId?: string) {
  const conditions = [eq(whatsappDispatchesTable.workspaceId, workspaceId)];
  if (campaignId) conditions.push(eq(whatsappDispatchesTable.campaignId, campaignId));

  return db
    .select()
    .from(whatsappDispatchesTable)
    .where(and(...conditions))
    .orderBy(desc(whatsappDispatchesTable.createdAt));
}

export async function getWhatsAppDispatch(workspaceId: string, dispatchId: string) {
  const [dispatch] = await db
    .select()
    .from(whatsappDispatchesTable)
    .where(
      and(
        eq(whatsappDispatchesTable.id, dispatchId),
        eq(whatsappDispatchesTable.workspaceId, workspaceId),
      ),
    );
  if (!dispatch) throw new NotFoundError("WhatsApp dispatch not found");
  return dispatch;
}

// ─── Webhook (Meta Cloud API) ─────────────────────────────────────────────────

export async function handleWhatsAppWebhook(payload: unknown) {
  const p = payload as Record<string, unknown>;
  const log = logger.child({ component: "whatsapp-webhook" });

  const entry = (p["entry"] as Array<Record<string, unknown>>)?.[0];
  const changes = (entry?.["changes"] as Array<Record<string, unknown>>)?.[0];
  const value = changes?.["value"] as Record<string, unknown>;

  let processed = 0;

  // ── Delivery status updates ──────────────────────────────────────────────
  const statuses = value?.["statuses"] as Array<Record<string, unknown>> | undefined;
  if (statuses?.length) {
    for (const s of statuses) {
      const msgId = String(s["id"] ?? "");
      const status = String(s["status"] ?? "");
      if (!msgId || !status) continue;

      const statusMap: Record<string, "sent" | "delivered" | "read" | "failed"> = {
        sent: "sent",
        delivered: "delivered",
        read: "read",
        failed: "failed",
      };

      const mapped = statusMap[status];
      if (!mapped) continue;

      if (mapped === "delivered" || mapped === "read") {
        const [dispatch] = await db
          .select({ workspaceId: whatsappDispatchesTable.workspaceId })
          .from(whatsappDispatchesTable)
          .where(
            eq(
              whatsappDispatchesTable.externalMessageIds,
              [msgId] as unknown as string[],
            ),
          )
          .limit(1);

        if (dispatch) {
          const [item] = await db
            .select({ id: launchSequenceItemsTable.id, sequenceId: launchSequenceItemsTable.sequenceId })
            .from(launchSequenceItemsTable)
            .where(eq(launchSequenceItemsTable.status, "dispatched"))
            .limit(1);

          if (item) {
            await recordEngagementEvent({
              sequenceId: item.sequenceId,
              workspaceId: dispatch.workspaceId,
              itemId: item.id,
              event: mapped === "read" ? "open" : "delivered",
              channel: "whatsapp",
              externalRef: msgId,
            });
          }
        }
      }

      log.info({ msgId, status: mapped }, "WhatsApp delivery status update");
      processed++;
    }
  }

  // ── Incoming messages → AI auto-response ────────────────────────────────
  const messages = value?.["messages"] as Array<Record<string, unknown>> | undefined;
  if (messages?.length) {
    const phoneNumberId = String(value?.["metadata"]
      ? (value["metadata"] as Record<string, unknown>)["phone_number_id"]
      : "");

    for (const msg of messages) {
      const from = String(msg["from"] ?? "");
      const msgType = String(msg["type"] ?? "");
      const body =
        msgType === "text"
          ? String((msg["text"] as Record<string, unknown>)?.["body"] ?? "")
          : "";

       if (!from) continue;
      processed++;

      log.info({ from, body: body.substring(0, 50) }, "Incoming WhatsApp message");

      const [integration] = await db
        .select({
          workspaceId: workspaceIntegrationsTable.workspaceId,
          accessToken: workspaceIntegrationsTable.accessToken,
          integrationId: workspaceIntegrationsTable.id,
        })
        .from(workspaceIntegrationsTable)
        .where(
          and(
            eq(workspaceIntegrationsTable.accountId, phoneNumberId),
            eq(workspaceIntegrationsTable.provider, "whatsapp_business"),
            eq(workspaceIntegrationsTable.status, "connected"),
          ),
        )
        .limit(1);

      if (!integration) continue;
        const providerMessageId = String(msg["id"] ?? "");
        if (!providerMessageId) {
          log.warn({ from }, "Ignoring WhatsApp inbound message without provider id");
          continue;
        }
        const normalized = await ingestInboundCommunityEvent(integration.workspaceId, {
          channel: "whatsapp", providerEventId: providerMessageId, providerMessageId,
          providerConversationId: from, providerParticipantId: from, body: body || undefined,
          occurredAt: new Date(Number(msg["timestamp"] ?? 0) * 1000 || Date.now()),
          integrationId: integration.integrationId, payload: msg,
        });
        // Meta can redeliver; a duplicate must never generate another response.
        if (normalized.duplicate || !normalized.message) continue;
        // Non-text messages are durably retained in the inbox but are not
        // eligible for the text response agent.
        if (!body) continue;

      const [contact] = await db
        .select({ id: sequenceContactsTable.id, sequenceId: sequenceContactsTable.sequenceId })
        .from(sequenceContactsTable)
        .where(eq(sequenceContactsTable.phone, from))
        .limit(1);

      if (contact) {
        await recordEngagementEvent({
          sequenceId: contact.sequenceId,
          workspaceId: integration.workspaceId,
          contactId: contact.id,
          event: "reply",
          channel: "whatsapp",
          metadata: { body },
        });
      }

      setImmediate(async () => {
        try {
          const aiResult = await runWhatsAppResponseAgent(
            integration.workspaceId,
            { from, body },
            log,
          );

          if (!aiResult.shouldRespond || !aiResult.response) return;
          const authorization = await authorizeAutonomousResponse(integration.workspaceId, normalized.message.id);
          if (!authorization.allowed) {
            log.info({ from, reason: authorization.reason }, "WhatsApp autonomous response blocked by durable policy");
            return;
          }

          if (aiResult.requiresHuman) {
            emitSequenceEvent({
              sequenceId: contact?.sequenceId ?? "unknown",
              workspaceId: integration.workspaceId,
              type: "engagement_received",
              message: `⚠️ Mensagem de ${from} requer atenção humana: "${body.substring(0, 80)}"`,
              data: { from, body, intent: aiResult.intent, requiresHuman: true },
            });
            return;
          }

          const creds: WhatsAppCredentials = {
            accessToken: integration.accessToken!,
            phoneNumberId,
          };
          await enforceNoMandatoryPause(integration.workspaceId, {
            channel: "whatsapp",
            action: "whatsapp_dispatch",
          });
          await sendMetaTextMessage(creds, from, aiResult.response);
          log.info({ from, intent: aiResult.intent }, "WhatsApp AI auto-response sent");
        } catch (err) {
          log.warn({ err, from }, "WhatsApp AI auto-response failed");
        }
      });
    }
  }

  return { processed };
}

// ─── System Notification Helper ───────────────────────────────────────────────
// Sends a plain-text WhatsApp message directly to a workspace owner's phone
// using the workspace's connected WhatsApp Business integration.
// Used for internal pipeline notifications (e.g. waiting_clarification watchdog).
// Returns false silently if no WA integration is connected — never throws.
export async function sendWhatsAppSystemNotification(
  workspaceId: string,
  recipientPhone: string,
  message: string,
): Promise<boolean> {
  const log = logger.child({ component: "wa-system-notification" });
  try {
    const [integration] = await db
      .select({
        accessToken: workspaceIntegrationsTable.accessToken,
        accountId: workspaceIntegrationsTable.accountId,
        status: workspaceIntegrationsTable.status,
      })
      .from(workspaceIntegrationsTable)
      .where(
        and(
          eq(workspaceIntegrationsTable.workspaceId, workspaceId),
          eq(workspaceIntegrationsTable.provider, "whatsapp_business"),
        ),
      )
      .limit(1);

    if (!integration?.accessToken || !integration.accountId || integration.status !== "connected") {
      log.info({ workspaceId }, "WA system notification skipped — no connected WA integration");
      return false;
    }

    const creds: WhatsAppCredentials = {
      accessToken: integration.accessToken,
      phoneNumberId: integration.accountId,
    };

    await enforceNoMandatoryPause(workspaceId, {
      channel: "whatsapp",
      action: "whatsapp_dispatch",
    });
    await sendMetaTextMessage(creds, recipientPhone, message);
    log.info({ workspaceId, recipientPhone: recipientPhone.slice(0, 6) + "***" }, "WA system notification sent");
    return true;
  } catch (err) {
    log.warn({ err, workspaceId }, "WA system notification failed — non-blocking");
    return false;
  }
}

// ─── Owner Contact Lookup ─────────────────────────────────────────────────────
// Returns the workspace owner's phone + email, or nulls if not set.
export async function getWorkspaceOwnerContact(workspaceId: string): Promise<{ phone: string | null; email: string | null }> {
  const [row] = await db
    .select({ phone: usersTable.phone, email: usersTable.email })
    .from(workspacesTable)
    .innerJoin(usersTable, eq(usersTable.id, workspacesTable.ownerId))
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  return { phone: row?.phone ?? null, email: row?.email ?? null };
}

/** @deprecated Use getWorkspaceOwnerContact instead */
export async function getWorkspaceOwnerPhone(workspaceId: string): Promise<string | null> {
  const { phone } = await getWorkspaceOwnerContact(workspaceId);
  return phone;
}

import { eq, and, desc } from "drizzle-orm";
import {
  db,
  whatsappDispatchesTable,
  workspaceIntegrationsTable,
  contentPiecesTable,
} from "@workspace/db";
import { NotFoundError, ValidationError, AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

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
  const res = await fetch(
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

  const data = await res.json() as { messages?: Array<{ id: string }> };
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
  const components = Object.keys(params).length > 0
    ? [{ type: "body", parameters: Object.values(params).map((v) => ({ type: "text", text: v })) }]
    : [];

  const res = await fetch(
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

  const data = await res.json() as { messages?: Array<{ id: string }> };
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
    type: "broadcast" | "individual" | "group" | "template";
    recipients: string[];
    message?: string;
    contentPieceId?: string;
    mediaUrl?: string;
    mediaType?: string;
    templateName?: string;
    templateParams?: Record<string, string>;
    scheduledAt?: string;
  },
) {
  if (!input.message && !input.contentPieceId && !input.templateName) {
    throw new ValidationError("Forneça message, contentPieceId ou templateName");
  }
  if (input.recipients.length === 0) {
    throw new ValidationError("Informe ao menos um destinatário");
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

  const [dispatch] = await db
    .insert(whatsappDispatchesTable)
    .values({
      workspaceId,
      campaignId: input.campaignId ?? null,
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
    })
    .returning();

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
  if (!["queued", "failed"].includes(dispatch.status))
    throw new ValidationError("Dispatch já enviado ou cancelado");

  await db
    .update(whatsappDispatchesTable)
    .set({ status: "sending" })
    .where(eq(whatsappDispatchesTable.id, dispatchId));

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
        failedCount.count++;
        logger.warn({ phone, err }, "WhatsApp send failed for recipient");
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
        status: "failed",
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

export async function handleWhatsAppWebhook(payload: unknown) {
  const p = payload as Record<string, unknown>;
  const entry = (p["entry"] as Array<Record<string, unknown>>)?.[0];
  const changes = (entry?.["changes"] as Array<Record<string, unknown>>)?.[0];
  const value = changes?.["value"] as Record<string, unknown>;
  const statuses = value?.["statuses"] as Array<Record<string, unknown>>;

  if (!statuses?.length) return { processed: 0 };

  let processed = 0;
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

    logger.info({ msgId, status: mapped }, "WhatsApp delivery status update");
    processed++;
  }

  return { processed };
}

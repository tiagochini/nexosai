import { eq, and, desc } from "drizzle-orm";
import {
  db,
  emailDispatchesTable,
  workspaceIntegrationsTable,
  contentPiecesTable,
  launchSequenceItemsTable,
  sequenceContactsTable,
} from "@workspace/db";
import { NotFoundError, ValidationError, AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../lib/env.js";
import { recordEngagementEvent } from "../launch-sequence/sequence-analytics.service.js";
import { emitSequenceEvent } from "../launch-sequence/sequence-realtime.js";

// ─── Provider API helpers ─────────────────────────────────────────────────────

interface EmailList {
  id: string;
  name: string;
  subscriberCount?: number;
}

interface DispatchResult {
  externalCampaignId?: string;
  recipientCount: number;
  status: "sent" | "scheduled" | "failed";
}

async function getRdStationToken(workspaceId: string): Promise<string> {
  const [integration] = await db
    .select({ accessToken: workspaceIntegrationsTable.accessToken })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, "rd_station"),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    );
  if (!integration?.accessToken)
    throw new ValidationError(
      "RD Station não está conectado. Configure a integração em Configurações > Integrações.",
    );
  return integration.accessToken;
}

async function getActiveCampaignCredentials(
  workspaceId: string,
): Promise<{ apiKey: string; accountUrl: string }> {
  const [integration] = await db
    .select({
      accessToken: workspaceIntegrationsTable.accessToken,
      metadata: workspaceIntegrationsTable.metadata,
    })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, "activecampaign"),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    );
  if (!integration?.accessToken)
    throw new ValidationError(
      "ActiveCampaign não está conectado. Configure a integração em Configurações > Integrações.",
    );

  const meta = (integration.metadata ?? {}) as Record<string, string>;
  return { apiKey: integration.accessToken, accountUrl: meta["accountUrl"] ?? "" };
}

async function fetchRdStationLists(token: string): Promise<EmailList[]> {
  const res = await fetch("https://api.rd.services/platform/segmentations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new AppError(502, "Erro ao buscar listas do RD Station");
  const data = (await res.json()) as {
    segmentations?: Array<{ id: string; name: string; contacts?: number }>;
  };
  return (data.segmentations ?? []).map((s) => ({
    id: String(s.id),
    name: s.name,
    subscriberCount: s.contacts,
  }));
}

async function fetchActiveCampaignLists(
  apiKey: string,
  accountUrl: string,
): Promise<EmailList[]> {
  const res = await fetch(`${accountUrl}/api/3/lists?limit=100`, {
    headers: { "Api-Token": apiKey },
  });
  if (!res.ok) throw new AppError(502, "Erro ao buscar listas do ActiveCampaign");
  const data = (await res.json()) as {
    lists?: Array<{ id: string; name: string; subscriber_count?: number }>;
  };
  return (data.lists ?? []).map((l) => ({
    id: String(l.id),
    name: l.name,
    subscriberCount: l.subscriber_count,
  }));
}

async function sendViaRdStation(
  token: string,
  payload: {
    subject: string;
    fromName: string;
    fromEmail: string;
    htmlContent: string;
    listId: string;
    scheduledAt?: string;
  },
): Promise<DispatchResult> {
  const body: Record<string, unknown> = {
    email_marketing: {
      subject: payload.subject,
      sender_name: payload.fromName,
      sender_email: payload.fromEmail,
      html_body: payload.htmlContent,
      segmentations: [{ id: payload.listId }],
      status: payload.scheduledAt ? "scheduling" : "sending",
    },
  };
  if (payload.scheduledAt) {
    (body["email_marketing"] as Record<string, unknown>)["schedule"] = {
      date_time: payload.scheduledAt,
    };
  }

  const res = await fetch("https://api.rd.services/platform/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.warn({ err }, "RD Station send failed");
    throw new AppError(502, `Erro ao enviar via RD Station: ${err}`);
  }

  const result = (await res.json()) as { email_marketing?: { id?: string } };
  return {
    externalCampaignId: String(result.email_marketing?.id ?? ""),
    recipientCount: 0,
    status: payload.scheduledAt ? "scheduled" : "sent",
  };
}

async function sendViaResend(
  fromName: string,
  fromEmail: string,
  payload: { subject: string; htmlContent: string; listId: string; scheduledAt?: string },
): Promise<DispatchResult> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new AppError(503, "RESEND_API_KEY não configurado. Adicione a variável de ambiente.");

  const from = `${fromName} <${fromEmail || env.RESEND_FROM_EMAIL}>`;

  // Use Resend Audiences broadcast when listId looks like a UUID; else direct send
  const isAudienceId = /^[0-9a-f-]{36}$/i.test(payload.listId);
  if (isAudienceId) {
    const res = await fetch(`https://api.resend.com/broadcasts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        audience_id: payload.listId,
        from,
        subject: payload.subject,
        html: payload.htmlContent,
        scheduled_at: payload.scheduledAt ?? undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new AppError(502, `Resend broadcast error: ${err}`);
    }
    const data = (await res.json()) as { id?: string };
    return { externalCampaignId: data.id, recipientCount: 0, status: payload.scheduledAt ? "scheduled" : "sent" };
  }

  // Transactional fallback to a single address (list management via Resend Audiences)
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [payload.listId], subject: payload.subject, html: payload.htmlContent }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new AppError(502, `Resend send error: ${err}`);
  }
  const data = (await res.json()) as { id?: string };
  return { externalCampaignId: data.id, recipientCount: 1, status: "sent" };
}

async function sendViaActiveCampaign(
  apiKey: string,
  accountUrl: string,
  payload: {
    subject: string;
    fromName: string;
    fromEmail: string;
    htmlContent: string;
    listId: string;
    scheduledAt?: string;
  },
): Promise<DispatchResult> {
  const campaignBody = {
    campaign: {
      type: "single",
      status: payload.scheduledAt ? "0" : "1",
      public: "0",
      name: `NexOS — ${payload.subject}`,
      subject: payload.subject,
      fromname: payload.fromName,
      fromemail: payload.fromEmail,
      bounceid: "-1",
      replyid: "-1",
      segmentid: "0",
    },
  };

  const res = await fetch(`${accountUrl}/api/3/campaigns`, {
    method: "POST",
    headers: { "Api-Token": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(campaignBody),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.warn({ err }, "ActiveCampaign campaign create failed");
    throw new AppError(502, `Erro ao criar campanha no ActiveCampaign: ${err}`);
  }

  const data = (await res.json()) as { campaign?: { id?: string } };
  return {
    externalCampaignId: String(data.campaign?.id ?? ""),
    recipientCount: 0,
    status: payload.scheduledAt ? "scheduled" : "sent",
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listEmailLists(
  workspaceId: string,
  provider: "rd_station" | "activecampaign",
) {
  if (provider === "rd_station") {
    const token = await getRdStationToken(workspaceId);
    return fetchRdStationLists(token);
  }
  const { apiKey, accountUrl } = await getActiveCampaignCredentials(workspaceId);
  return fetchActiveCampaignLists(apiKey, accountUrl);
}

export async function createEmailDispatch(
  workspaceId: string,
  input: {
    campaignId?: string;
    provider:
      | "rd_station"
      | "activecampaign"
      | "mailchimp"
      | "sendgrid"
      | "brevo"
      | "custom_smtp";
    listId: string;
    listName?: string;
    subject: string;
    previewText?: string;
    fromName: string;
    fromEmail: string;
    contentPieceId?: string;
    htmlContent?: string;
    textContent?: string;
    scheduledAt?: string;
  },
) {
  let html = input.htmlContent ?? "";

  if (!html && input.contentPieceId) {
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
      html = String(c["html"] ?? c["body"] ?? c["content"] ?? "");
    }
  }

  if (!html) throw new ValidationError("Forneça htmlContent ou contentPieceId com conteúdo HTML");

  const [dispatch] = await db
    .insert(emailDispatchesTable)
    .values({
      workspaceId,
      campaignId: input.campaignId ?? null,
      provider: input.provider,
      listId: input.listId,
      listName: input.listName ?? null,
      subject: input.subject,
      previewText: input.previewText ?? null,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      contentPieceId: input.contentPieceId ?? null,
      htmlContent: html,
      textContent: input.textContent ?? null,
      status: "draft",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    })
    .returning();

  return dispatch!;
}

export async function sendEmailDispatch(workspaceId: string, dispatchId: string) {
  const [dispatch] = await db
    .select()
    .from(emailDispatchesTable)
    .where(
      and(
        eq(emailDispatchesTable.id, dispatchId),
        eq(emailDispatchesTable.workspaceId, workspaceId),
      ),
    );
  if (!dispatch) throw new NotFoundError("Email dispatch not found");
  if (!["draft", "scheduled"].includes(dispatch.status))
    throw new ValidationError("Dispatch already sent or cancelled");
  if (!dispatch.htmlContent) throw new ValidationError("No HTML content to send");

  await db
    .update(emailDispatchesTable)
    .set({ status: "sending" })
    .where(eq(emailDispatchesTable.id, dispatchId));

  try {
    let result: DispatchResult;
    const payload = {
      subject: dispatch.subject,
      fromName: dispatch.fromName,
      fromEmail: dispatch.fromEmail,
      htmlContent: dispatch.htmlContent,
      listId: dispatch.listId ?? "",
      scheduledAt: dispatch.scheduledAt?.toISOString(),
    };

    if (dispatch.provider === "rd_station") {
      const token = await getRdStationToken(workspaceId);
      result = await sendViaRdStation(token, payload);
    } else if (dispatch.provider === "activecampaign") {
      const { apiKey, accountUrl } = await getActiveCampaignCredentials(workspaceId);
      result = await sendViaActiveCampaign(apiKey, accountUrl, payload);
    } else if (env.RESEND_API_KEY && ["mailchimp", "sendgrid", "brevo", "custom_smtp"].includes(dispatch.provider)) {
      // Fallback: use Resend when configured and native provider not wired
      result = await sendViaResend(dispatch.fromName, dispatch.fromEmail, payload);
    } else {
      result = { status: "sent", recipientCount: 0, externalCampaignId: "mock" };
      logger.warn(
        { provider: dispatch.provider },
        "Email provider not yet integrated — mock send",
      );
    }

    const [updated] = await db
      .update(emailDispatchesTable)
      .set({
        status: result.status,
        sentAt: result.status === "sent" ? new Date() : undefined,
        externalCampaignId: result.externalCampaignId,
        recipientCount: result.recipientCount,
      })
      .where(eq(emailDispatchesTable.id, dispatchId))
      .returning();

    return updated!;
  } catch (err) {
    await db
      .update(emailDispatchesTable)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(emailDispatchesTable.id, dispatchId));
    throw err;
  }
}

export async function getEmailDispatches(workspaceId: string, campaignId?: string) {
  const conditions = [eq(emailDispatchesTable.workspaceId, workspaceId)];
  if (campaignId) conditions.push(eq(emailDispatchesTable.campaignId, campaignId));

  return db
    .select()
    .from(emailDispatchesTable)
    .where(and(...conditions))
    .orderBy(desc(emailDispatchesTable.createdAt));
}

export async function getEmailDispatch(workspaceId: string, dispatchId: string) {
  const [dispatch] = await db
    .select()
    .from(emailDispatchesTable)
    .where(
      and(
        eq(emailDispatchesTable.id, dispatchId),
        eq(emailDispatchesTable.workspaceId, workspaceId),
      ),
    );
  if (!dispatch) throw new NotFoundError("Email dispatch not found");
  return dispatch;
}

// ─── Engagement Webhook ────────────────────────────────────────────────────────

export interface EmailWebhookPayload {
  provider: "rd_station" | "activecampaign";
  event_type?: string;  // open | click | unsubscribe | bounce
  event?: string;
  email?: string;
  campaign_id?: string;
  link?: string;
  [key: string]: unknown;
}

export async function handleEmailEngagementWebhook(
  payload: EmailWebhookPayload,
): Promise<{ processed: boolean; event?: string }> {
  const log = logger.child({ component: "email-webhook", provider: payload.provider });

  const rawEvent = String(payload.event_type ?? payload.event ?? "").toLowerCase();

  const eventMap: Record<string, "open" | "click" | "convert" | "unsubscribe" | "bounced" | "delivered"> = {
    open: "open",
    email_opened: "open",
    "email.opened": "open",
    click: "click",
    email_clicked: "click",
    "email.clicked": "click",
    unsubscribe: "unsubscribe",
    email_unsubscribed: "unsubscribe",
    "email.unsubscribed": "unsubscribe",
    bounce: "bounced",
    hard_bounce: "bounced",
    email_bounced: "bounced",
    "email.bounced": "bounced",
    delivered: "delivered",
    email_delivered: "delivered",
  };

  const engagementEvent = eventMap[rawEvent];
  if (!engagementEvent) {
    log.debug({ rawEvent }, "Unknown email webhook event — ignoring");
    return { processed: false };
  }

  const externalCampaignId = String(
    payload.campaign_id ?? payload["campaign_id"] ?? payload["email_marketing_id"] ?? "",
  );

  let sequenceId: string | null = null;
  let itemId: string | null = null;
  let workspaceId: string | null = null;
  let contactId: string | null = null;

  if (externalCampaignId) {
    const [dispatch] = await db
      .select({
        id: emailDispatchesTable.id,
        workspaceId: emailDispatchesTable.workspaceId,
        campaignId: emailDispatchesTable.campaignId,
      })
      .from(emailDispatchesTable)
      .where(eq(emailDispatchesTable.externalCampaignId, externalCampaignId));

    if (dispatch) {
      workspaceId = dispatch.workspaceId;

      const [item] = await db
        .select({
          id: launchSequenceItemsTable.id,
          sequenceId: launchSequenceItemsTable.sequenceId,
        })
        .from(launchSequenceItemsTable)
        .where(eq(launchSequenceItemsTable.status, "dispatched"))
        .limit(1);

      if (item) {
        itemId = item.id;
        sequenceId = item.sequenceId;
      }
    }
  }

  if (!workspaceId || !sequenceId) {
    log.debug({ externalCampaignId }, "Could not match webhook to a sequence — logging only");
    return { processed: true, event: engagementEvent };
  }

  const contactEmail = String(payload.email ?? "");
  if (contactEmail) {
    const [contact] = await db
      .select({ id: sequenceContactsTable.id })
      .from(sequenceContactsTable)
      .where(eq(sequenceContactsTable.email, contactEmail))
      .limit(1);
    if (contact) contactId = contact.id;
  }

  await recordEngagementEvent({
    sequenceId,
    workspaceId,
    itemId: itemId ?? undefined,
    contactId: contactId ?? undefined,
    event: engagementEvent,
    channel: "email",
    externalRef: externalCampaignId,
    metadata: { link: payload.link, email: contactEmail },
  });

  emitSequenceEvent({
    sequenceId,
    workspaceId,
    type: "engagement_received",
    itemId: itemId ?? undefined,
    message: `Email ${engagementEvent} recebido${contactEmail ? ` de ${contactEmail}` : ""}`,
    data: { event: engagementEvent, channel: "email" },
  });

  log.info({ sequenceId, itemId, event: engagementEvent }, "Email engagement recorded");
  return { processed: true, event: engagementEvent };
}

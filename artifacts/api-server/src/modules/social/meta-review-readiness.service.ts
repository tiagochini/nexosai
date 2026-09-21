import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  metaWebhookEventsTable,
  socialConversationTurnsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { env } from "../../lib/env.js";
import { isOrganicSocialIntegration } from "../integrations/integration-purpose.js";

const REQUIRED_PERMISSIONS = [
  { scope: "instagram_basic", useCase: "Connect and identify the professional Instagram account.", recording: "OAuth consent and connected Instagram profile.", status: "required" as const },
  { scope: "instagram_business_manage_messages", useCase: "Receive and answer Instagram direct messages.", recording: "External account sends a DM and receives the contextual reply.", status: "required" as const },
  { scope: "instagram_manage_comments", useCase: "Read, moderate and answer Instagram comments.", recording: "External account comments and receives a public reply and, if enabled, a private reply.", status: "required" as const },
  { scope: "pages_show_list", useCase: "Let the operator select an authorized Facebook Page.", recording: "OAuth connection lists and saves the selected Page.", status: "required" as const },
  { scope: "pages_read_engagement", useCase: "Read Page posts, comments and engagement.", recording: "Open the Page activity and show the incoming test comment.", status: "required" as const },
  { scope: "pages_manage_engagement", useCase: "Reply to and moderate Page comments.", recording: "External account comments on the Page and receives a reply.", status: "required" as const },
  { scope: "pages_manage_metadata", useCase: "Subscribe the Page to webhook events.", recording: "Show the Page subscription and a real webhook delivery.", status: "required" as const },
  { scope: "instagram_content_publish", useCase: "Publish approved posts and reels.", recording: "Publish approved test content and show its Instagram media ID.", status: "conditional" as const },
  { scope: "instagram_manage_insights", useCase: "Display account and media performance.", recording: "Open analytics and show real timestamped Instagram metrics.", status: "conditional" as const },
  { scope: "pages_manage_posts", useCase: "Publish approved content to a Facebook Page.", recording: "Publish a test Page post and show its Page post ID.", status: "conditional" as const },
  { scope: "business_management", useCase: "Resolve authorized Business assets during connection.", recording: "Show the authorized Business, Page and linked Instagram selection.", status: "conditional" as const },
];

export async function getMetaReviewReadiness(workspaceId: string) {
  const [allAccounts, evidence, turns] = await Promise.all([
    db.select({
      id: workspaceIntegrationsTable.id,
      provider: workspaceIntegrationsTable.provider,
      accountId: workspaceIntegrationsTable.accountId,
      accountName: workspaceIntegrationsTable.accountName,
      status: workspaceIntegrationsTable.status,
      metadata: workspaceIntegrationsTable.metadata,
    }).from(workspaceIntegrationsTable).where(and(
      eq(workspaceIntegrationsTable.workspaceId, workspaceId),
      inArray(workspaceIntegrationsTable.provider, ["instagram", "facebook", "meta_ads"]),
    )),
    db.select({
      id: metaWebhookEventsTable.id,
      eventType: metaWebhookEventsTable.eventType,
      actionKey: metaWebhookEventsTable.actionKey,
      status: metaWebhookEventsTable.status,
      accountId: metaWebhookEventsTable.accountId,
      providerEventId: metaWebhookEventsTable.providerEventId,
      providerMessageId: metaWebhookEventsTable.providerMessageId,
      latencyMs: metaWebhookEventsTable.latencyMs,
      slaStatus: metaWebhookEventsTable.slaStatus,
      receivedAt: metaWebhookEventsTable.receivedAt,
      sentAt: metaWebhookEventsTable.sentAt,
      error: metaWebhookEventsTable.error,
    }).from(metaWebhookEventsTable)
      .where(eq(metaWebhookEventsTable.workspaceId, workspaceId))
      .orderBy(desc(metaWebhookEventsTable.receivedAt))
      .limit(25),
    db.select({
      id: socialConversationTurnsTable.id,
      channel: socialConversationTurnsTable.channel,
      direction: socialConversationTurnsTable.direction,
      decision: socialConversationTurnsTable.decision,
      providerStatus: socialConversationTurnsTable.providerStatus,
      providerEventId: socialConversationTurnsTable.providerEventId,
      providerResponseId: socialConversationTurnsTable.providerResponseId,
      accountId: socialConversationTurnsTable.accountId,
      receivedAt: socialConversationTurnsTable.receivedAt,
      sentAt: socialConversationTurnsTable.sentAt,
      safetyReason: socialConversationTurnsTable.safetyReason,
    }).from(socialConversationTurnsTable)
      .where(eq(socialConversationTurnsTable.workspaceId, workspaceId))
      .orderBy(desc(socialConversationTurnsTable.receivedAt))
      .limit(25),
  ]);

  const accounts = allAccounts
    .filter((account) => isOrganicSocialIntegration(account.metadata as Record<string, unknown> | null))
    .map(({ metadata: _metadata, ...account }) => account);
  const connectedInstagram = accounts.some((account) => account.provider === "instagram" && account.status === "connected");
  const connectedFacebook = accounts.some((account) => (account.provider === "facebook" || account.provider === "meta_ads") && account.status === "connected");
  const successfulEvidence = evidence.some((item) => item.status === "sent");
  const successfulConversation = turns.some((turn) => turn.providerStatus === "sent" && !!turn.providerResponseId);
  const appConfigured = Boolean(
    (env.META_APP_ID || process.env["FACEBOOK_APP_ID"]) &&
    (env.META_APP_SECRET || process.env["FACEBOOK_APP_SECRET"]),
  );
  const webhookConfigured = Boolean(process.env["META_WEBHOOK_VERIFY_TOKEN"]);
  const publicBaseUrl = env.APP_URL.replace(/\/$/, "");

  const checks = [
    { key: "meta_app", label: "Meta app credentials configured", status: appConfigured ? "pass" : "fail", detail: appConfigured ? "App ID and secret are available to the server." : "Configure the Meta App ID and secret before OAuth." },
    { key: "public_url", label: "External HTTPS application URL", status: publicBaseUrl.startsWith("https://") ? "pass" : "fail", detail: publicBaseUrl || "APP_URL is missing." },
    { key: "webhook", label: "Meta webhook verification configured", status: webhookConfigured ? "pass" : "fail", detail: webhookConfigured ? "Verification token is configured and never returned here." : "Configure META_WEBHOOK_VERIFY_TOKEN." },
    { key: "instagram", label: "Professional Instagram account connected", status: connectedInstagram ? "pass" : "fail", detail: connectedInstagram ? "At least one connected organic Instagram account is available." : "Connect the review Instagram account." },
    { key: "facebook", label: "Facebook Page connected", status: connectedFacebook ? "pass" : "warn", detail: connectedFacebook ? "At least one connected organic Facebook Page is available." : "Connect a Page if Page permissions are requested." },
    { key: "provider_evidence", label: "Real Meta callback and send evidence", status: successfulEvidence ? "pass" : "fail", detail: successfulEvidence ? "A successful provider event is available for recording." : "Run a real comment or DM test before recording." },
    { key: "conversation_evidence", label: "Contextual response evidence", status: successfulConversation ? "pass" : "fail", detail: successfulConversation ? "A provider response ID proves a contextual reply was sent." : "Run a contextual comment or DM test." },
  ] as const;

  return {
    ready: checks.every((check) => check.status !== "fail"),
    generatedAt: new Date().toISOString(),
    callbackUrl: `${publicBaseUrl}/api/social-moderation/webhooks/meta`,
    legalUrls: {
      privacy: "https://agencianexos.vip/privacy",
      terms: "https://agencianexos.vip/terms",
      dataDeletion: "https://agencianexos.vip/data-deletion",
    },
    checks,
    permissions: REQUIRED_PERMISSIONS,
    accounts,
    evidence,
    conversationTurns: turns,
  };
}
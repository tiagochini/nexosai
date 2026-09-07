import { and, count, desc, eq, gte } from "drizzle-orm";
import {
  communityActionAttemptsTable, communityConversationsTable, communityMessagesTable,
  communityModerationDecisionsTable, communityModerationRulesTable, communityParticipantsTable,
  communityProviderEventsTable, db,
  communityResponsePoliciesTable,
} from "@workspace/db";
import { providerCapability, type CommunityAction, type CommunityChannel } from "./community-capabilities.js";

export type InboundCommunityEvent = {
  channel: CommunityChannel; providerEventId: string; providerConversationId: string;
  providerMessageId: string; providerParticipantId: string; body?: string;
  occurredAt: Date; integrationId?: string; displayName?: string;
  attachments?: unknown[]; payload: Record<string, unknown>;
};

export function isDuplicateProviderEvent(
  existing: { workspaceId: string; channel: CommunityChannel; providerEventId: string } | undefined,
  workspaceId: string,
  event: Pick<InboundCommunityEvent, "channel" | "providerEventId">,
) {
  return !!existing && existing.workspaceId === workspaceId
    && existing.channel === event.channel && existing.providerEventId === event.providerEventId;
}

/** Persist first, then process. Duplicate provider delivery is a no-op. */
export async function ingestInboundCommunityEvent(workspaceId: string, event: InboundCommunityEvent) {
  const inserted = await db.insert(communityProviderEventsTable).values({
    workspaceId, channel: event.channel, providerEventId: event.providerEventId, payload: event.payload,
  }).onConflictDoNothing().returning({ id: communityProviderEventsTable.id });
  if (!inserted.length) return { duplicate: true as const };

  const [conversation] = await db.insert(communityConversationsTable).values({
    workspaceId, integrationId: event.integrationId ?? null, channel: event.channel,
    providerConversationId: event.providerConversationId, lastMessageAt: event.occurredAt,
  }).onConflictDoNothing().returning();
  const resolvedConversation = conversation ?? await db.select().from(communityConversationsTable)
    .where(and(eq(communityConversationsTable.workspaceId, workspaceId), eq(communityConversationsTable.channel, event.channel), eq(communityConversationsTable.providerConversationId, event.providerConversationId))).then((x) => x[0]!);

  const [participant] = await db.insert(communityParticipantsTable).values({
    workspaceId, conversationId: resolvedConversation.id, providerParticipantId: event.providerParticipantId,
    displayName: event.displayName ?? null,
  }).onConflictDoNothing().returning();
  const resolvedParticipant = participant ?? await db.select().from(communityParticipantsTable)
    .where(and(eq(communityParticipantsTable.conversationId, resolvedConversation.id), eq(communityParticipantsTable.providerParticipantId, event.providerParticipantId))).then((x) => x[0]!);

  const [message] = await db.insert(communityMessagesTable).values({
    workspaceId, conversationId: resolvedConversation.id, senderParticipantId: resolvedParticipant.id,
    providerMessageId: event.providerMessageId, direction: "inbound", body: event.body ?? null,
    attachments: event.attachments ?? [], occurredAt: event.occurredAt, metadata: event.payload,
  }).onConflictDoNothing().returning();
  return { duplicate: false as const, message };
}

export async function listInbox(workspaceId: string) {
  return db.select().from(communityMessagesTable)
    .where(eq(communityMessagesTable.workspaceId, workspaceId))
    .orderBy(desc(communityMessagesTable.occurredAt)).limit(100);
}

export async function createModerationRule(workspaceId: string, input: {
  name: string; channel?: CommunityChannel; condition: Record<string, unknown>;
  decision: "allow" | "queue" | "delete" | "restrict" | "ban" | "respond" | "capability_blocked"; requiresApproval?: boolean;
}) {
  return db.insert(communityModerationRulesTable).values({
    workspaceId, ...input, channel: input.channel ?? null, requiresApproval: input.requiresApproval ?? true,
  }).returning().then((r) => r[0]!);
}

export function evaluateAutonomousResponsePolicy(input: {
  enabled: boolean; requiresConsent: boolean; consentGranted: boolean;
  requiresApproval: boolean; dailyQuota: number; sentToday: number;
}) {
  if (!input.enabled) return { allowed: false, reason: "policy_disabled" as const };
  if (input.requiresConsent && !input.consentGranted) return { allowed: false, reason: "consent_required" as const };
  if (input.requiresApproval) return { allowed: false, reason: "approval_required" as const };
  if (input.dailyQuota <= 0 || input.sentToday >= input.dailyQuota) return { allowed: false, reason: "quota_exhausted" as const };
  return { allowed: true, reason: "authorized" as const };
}

export function evaluateCommunityModerationRules(
  rules: Array<{ id: string; enabled: boolean; condition: Record<string, unknown>; decision: string; requiresApproval: boolean }>,
  message: { body?: string; classification?: string; role?: string },
) {
  const body = message.body ?? "";
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const condition = rule.condition;
    const keyword = typeof condition["keyword"] === "string" ? condition["keyword"] : undefined;
    const regex = typeof condition["regex"] === "string" ? condition["regex"] : undefined;
    const matches = (keyword && body.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()))
      || (regex && new RegExp(regex, "iu").test(body))
      || (typeof condition["classification"] === "string" && condition["classification"] === message.classification)
      || (typeof condition["role"] === "string" && condition["role"] === message.role);
    if (matches) return { ruleId: rule.id, decision: rule.decision, requiresApproval: rule.requiresApproval };
  }
  return { decision: "allow", requiresApproval: false };
}

/** Fail closed when no durable policy authorizes an autonomous response. */
export async function authorizeAutonomousResponse(workspaceId: string, messageId: string) {
  const message = await db.select({
    channel: communityConversationsTable.channel,
    consentGranted: communityParticipantsTable.consentGranted,
  }).from(communityMessagesTable)
    .innerJoin(communityConversationsTable, eq(communityMessagesTable.conversationId, communityConversationsTable.id))
    .leftJoin(communityParticipantsTable, eq(communityMessagesTable.senderParticipantId, communityParticipantsTable.id))
    .where(and(eq(communityMessagesTable.workspaceId, workspaceId), eq(communityMessagesTable.id, messageId))).then((r) => r[0]);
  if (!message) return { allowed: false as const, reason: "message_not_found" as const };
  const policy = await db.select().from(communityResponsePoliciesTable)
    .where(and(eq(communityResponsePoliciesTable.workspaceId, workspaceId), eq(communityResponsePoliciesTable.channel, message.channel)))
    .orderBy(desc(communityResponsePoliciesTable.createdAt)).limit(1).then((r) => r[0]);
  if (!policy) return { allowed: false as const, reason: "policy_disabled" as const };
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const [{ sentToday }] = await db.select({ sentToday: count() }).from(communityMessagesTable)
    .innerJoin(communityConversationsTable, eq(communityMessagesTable.conversationId, communityConversationsTable.id))
    .where(and(eq(communityMessagesTable.workspaceId, workspaceId), eq(communityMessagesTable.direction, "outbound"), eq(communityConversationsTable.channel, message.channel), gte(communityMessagesTable.occurredAt, start)));
  return evaluateAutonomousResponsePolicy({
    enabled: policy.enabled, requiresConsent: policy.requiresConsent, consentGranted: message.consentGranted ?? false,
    requiresApproval: policy.requiresApproval, dailyQuota: policy.dailyQuota, sentToday,
  });
}

export async function attemptCommunityAction(workspaceId: string, messageId: string, action: CommunityAction, idempotencyKey: string) {
  const message = await db.select({ id: communityMessagesTable.id, conversationId: communityMessagesTable.conversationId, channel: communityConversationsTable.channel, integrationId: communityConversationsTable.integrationId })
    .from(communityMessagesTable).innerJoin(communityConversationsTable, eq(communityMessagesTable.conversationId, communityConversationsTable.id))
    .where(and(eq(communityMessagesTable.id, messageId), eq(communityMessagesTable.workspaceId, workspaceId))).then((r) => r[0]);
  if (!message) throw new Error("Message not found");
  const capability = providerCapability(message.channel, action);
  const [attempt] = await db.insert(communityActionAttemptsTable).values({
    workspaceId, messageId, integrationId: message.integrationId, action, idempotencyKey,
    status: capability.supported ? "pending" : "capability_blocked",
    error: capability.reason ?? null, completedAt: capability.supported ? null : new Date(),
  }).onConflictDoNothing().returning();
  const result = attempt ?? await db.select().from(communityActionAttemptsTable)
    .where(and(eq(communityActionAttemptsTable.workspaceId, workspaceId), eq(communityActionAttemptsTable.idempotencyKey, idempotencyKey))).then((r) => r[0]!);
  if (!capability.supported && attempt) await db.insert(communityModerationDecisionsTable).values({
    workspaceId, messageId, decision: "capability_blocked", reason: capability.reason!,
  });
  return result;
}
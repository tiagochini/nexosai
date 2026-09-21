/**
 * Shared, tenant-safe conversation context and reply decision boundary for Meta
 * comments and messages.  Provider handlers should do deterministic policy
 * checks first, then call this module for eligible free-form messages.
 */
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  campaignsTable,
  socialCommentActionsTable,
  socialPresencePostsTable,
  instagramDmSequencesTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { runAgent, parseAgentJSON } from "../agents/agent.runner.js";
import { buildCampaignActionContext } from "../agents/campaign-action-context.js";
import { getApprovedMasterplan } from "../masterplan/masterplan.service.js";
import { logger } from "../../lib/logger.js";

export type ConversationChannel = "instagram_comment" | "instagram_dm" | "facebook_dm" | "facebook_comment";
export type ConversationAction = "reply_public" | "reply_private" | "reply_dm" | "ignore" | "hide" | "delete" | "human_handoff";

export interface ConversationContextInput {
  workspaceId: string;
  integrationId: string;
  accountId: string;
  provider: "instagram" | "facebook" | "meta_ads";
  platformPostId?: string;
  campaignId?: string;
  providerUserId?: string;
}

export interface ResolvedConversationContext {
  workspaceId: string;
  integrationId: string;
  accountId: string;
  campaignId: string | null;
  masterplan: { id: string; version: number; contextFingerprint: string } | null;
  canonicalContext: string | null;
  canonicalContextFingerprint: string | null;
  recentTurns: Array<{ direction: string; input: string; reply: string | null; createdAt: Date }>;
  provenance: { source: "post" | "explicit" | "none"; postId?: string; campaignId?: string; masterplanId?: string };
  failureReason?: string;
}

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const safeText = (value: unknown, max = 2_000) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

/** Resolves in the order provider post -> explicitly supplied campaign. Never workspace-wide. */
export async function resolveConversationContext(input: ConversationContextInput): Promise<ResolvedConversationContext> {
  const [integration] = await db.select({ id: workspaceIntegrationsTable.id, accountId: workspaceIntegrationsTable.accountId })
    .from(workspaceIntegrationsTable)
    .where(and(
      eq(workspaceIntegrationsTable.id, input.integrationId),
      eq(workspaceIntegrationsTable.workspaceId, input.workspaceId),
      eq(workspaceIntegrationsTable.accountId, input.accountId),
    )).limit(1);
  const base = { workspaceId: input.workspaceId, integrationId: input.integrationId, accountId: input.accountId };
  if (!integration) return { ...base, campaignId: null, masterplan: null, canonicalContext: null, canonicalContextFingerprint: null, recentTurns: [], provenance: { source: "none" }, failureReason: "integration_context_mismatch" };

  let campaignId = input.campaignId;
  let postId: string | undefined;
  let source: "post" | "explicit" | "none" = campaignId ? "explicit" : "none";
  if (input.platformPostId) {
    const [post] = await db.select({ id: socialPresencePostsTable.id, campaignId: socialPresencePostsTable.campaignId })
      .from(socialPresencePostsTable)
      .where(and(eq(socialPresencePostsTable.workspaceId, input.workspaceId), eq(socialPresencePostsTable.platformPostId, input.platformPostId))).limit(1);
    if (post) {
      postId = post.id;
      if (post.campaignId) {
        if (campaignId && campaignId !== post.campaignId) return { ...base, campaignId: null, masterplan: null, canonicalContext: null, canonicalContextFingerprint: null, recentTurns: [], provenance: { source: "none" }, failureReason: "ambiguous_campaign_context" };
        campaignId = post.campaignId;
        source = "post";
      }
    }
  }
  // A free-form DM may not carry a post id. An active keyword sequence is a
  // durable, exact post binding and is therefore safe to use as its origin.
  if (!campaignId && input.providerUserId) {
    const [sequence] = await db.select({ postId: instagramDmSequencesTable.postId })
      .from(instagramDmSequencesTable)
      .where(and(
        eq(instagramDmSequencesTable.workspaceId, input.workspaceId),
        eq(instagramDmSequencesTable.igAccountId, input.accountId),
        eq(instagramDmSequencesTable.recipientId, input.providerUserId),
      )).orderBy(desc(instagramDmSequencesTable.createdAt)).limit(1);
    if (sequence?.postId) {
      const [post] = await db.select({ id: socialPresencePostsTable.id, campaignId: socialPresencePostsTable.campaignId })
        .from(socialPresencePostsTable).where(and(eq(socialPresencePostsTable.workspaceId, input.workspaceId), eq(socialPresencePostsTable.id, sequence.postId))).limit(1);
      if (post?.campaignId) { campaignId = post.campaignId; postId = post.id; source = "post"; }
    }
  }
  if (!campaignId) return { ...base, campaignId: null, masterplan: null, canonicalContext: null, canonicalContextFingerprint: null, recentTurns: [], provenance: { source, ...(postId ? { postId } : {}) }, failureReason: "campaign_not_resolved" };

  const [campaign, approved] = await Promise.all([
    db.select({ id: campaignsTable.id }).from(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, input.workspaceId))).limit(1).then(r => r[0]),
    getApprovedMasterplan(input.workspaceId, campaignId),
  ]);
  if (!campaign) return { ...base, campaignId: null, masterplan: null, canonicalContext: null, canonicalContextFingerprint: null, recentTurns: [], provenance: { source, ...(postId ? { postId } : {}) }, failureReason: "campaign_context_mismatch" };
  if (!approved) return { ...base, campaignId, masterplan: null, canonicalContext: null, canonicalContextFingerprint: null, recentTurns: [], provenance: { source, ...(postId ? { postId } : {}), campaignId }, failureReason: "approved_masterplan_required" };

  const context = await buildCampaignActionContext(campaignId, input.workspaceId, "social_media");
  const recentComments = input.providerUserId
    ? await db.select({ direction: socialCommentActionsTable.action, input: socialCommentActionsTable.commentText, reply: socialCommentActionsTable.aiReply, createdAt: socialCommentActionsTable.createdAt })
      .from(socialCommentActionsTable).where(and(eq(socialCommentActionsTable.workspaceId, input.workspaceId), eq(socialCommentActionsTable.authorId, input.providerUserId))).orderBy(desc(socialCommentActionsTable.createdAt)).limit(8)
    : [];
  return {
    ...base, campaignId,
    masterplan: { id: approved.id, version: approved.version, contextFingerprint: approved.contextFingerprint },
    canonicalContext: context.block,
    canonicalContextFingerprint: context.metadata.fingerprint,
    recentTurns: recentComments,
    provenance: { source, ...(postId ? { postId } : {}), campaignId, masterplanId: approved.id },
  };
}

export interface IntelligentConversationReply {
  classification: string;
  intent: string;
  salesStage: string;
  reply: string;
  confidence: number;
  action: ConversationAction;
  needsHuman: boolean;
  safetyReason: string | null;
  contextProvenance: ResolvedConversationContext["provenance"] & { contextFingerprint?: string; masterplanVersion?: number };
}

const HANDOFF = (ctx: ResolvedConversationContext, reason: string): IntelligentConversationReply => ({
  classification: "needs_human", intent: "unknown", salesStage: "unknown", reply: "",
  confidence: 0, action: "human_handoff", needsHuman: true, safetyReason: reason,
  contextProvenance: { ...ctx.provenance, ...(ctx.canonicalContextFingerprint ? { contextFingerprint: ctx.canonicalContextFingerprint } : {}), ...(ctx.masterplan ? { masterplanVersion: ctx.masterplan.version } : {}) },
});

const sensitive = /\b(preço|valor|reembolso|estorno|refund|processo|advogad|legal|médic|saúde|cura|pagamento|cartão|humano|atendente)\b/i;

export async function orchestrateIntelligentConversation(input: ConversationContextInput & { channel: ConversationChannel; message: string }): Promise<IntelligentConversationReply> {
  const ctx = await resolveConversationContext(input);
  if (ctx.failureReason) return HANDOFF(ctx, ctx.failureReason);
  const message = safeText(input.message);
  if (!message) return HANDOFF(ctx, "empty_message");
  if (sensitive.test(message)) return HANDOFF(ctx, "sensitive_or_explicit_human_request");
  try {
    const result = await runAgent({
      campaignId: ctx.campaignId,
      workspaceId: input.workspaceId,
      agentRole: "social_media",
      systemPrompt: `Você é o atendente social da campanha. Responda somente com fatos do CONTEXTO CANÔNICO e responda a pergunta real, conectando-a à operação completa do cliente (não faça um pitch genérico). Seja conciso e adequado ao canal. Nunca prometa preço, resultado, reembolso, cura ou obrigação legal. Retorne JSON: {"classification":"question|objection|compliment|neutral","intent":"string","salesStage":"awareness|consideration|decision|retention","reply":"até 3 frases","confidence":0.0,"action":"reply_public|reply_private|reply_dm|human_handoff","needsHuman":false,"safetyReason":null}`,
      messages: [{ role: "user", content: `Canal: ${input.channel}\nMensagem: ${message}\nConversas recentes: ${JSON.stringify(ctx.recentTurns)}` }],
      log: logger,
      requiresApproval: false,
      skipAllStaticLayers: false,
    });
    const parsed = parseAgentJSON<Partial<IntelligentConversationReply>>(result.content, {});
    const confidence = Number(parsed.confidence ?? 0);
    if (!parsed.reply || confidence < 0.7 || parsed.needsHuman || parsed.action === "human_handoff") return HANDOFF(ctx, parsed.safetyReason ?? "low_confidence");
    return { classification: String(parsed.classification ?? "question"), intent: String(parsed.intent ?? "unknown"), salesStage: String(parsed.salesStage ?? "consideration"), reply: safeText(parsed.reply, 600), confidence, action: (parsed.action as ConversationAction) ?? (input.channel.includes("comment") ? "reply_public" : "reply_dm"), needsHuman: false, safetyReason: null, contextProvenance: { ...ctx.provenance, contextFingerprint: ctx.canonicalContextFingerprint!, masterplanVersion: ctx.masterplan!.version } };
  } catch (error) {
    logger.warn({ error, workspaceId: input.workspaceId }, "Contextual conversation agent failed closed");
    return HANDOFF(ctx, "agent_unavailable");
  }
}
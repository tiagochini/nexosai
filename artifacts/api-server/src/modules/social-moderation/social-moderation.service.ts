import { eq, and, desc } from "drizzle-orm";
import {
  db,
  socialCommentActionsTable,
  socialConversationTurnsTable,
  workspaceIntegrationsTable,
  workspacesTable,
  type SocialCommentAction,
} from "@workspace/db";
import {
  completeWithAgent,
  type AIMessage,
} from "../ai-gateway/ai-gateway.service.js";
import { logger } from "../../lib/logger.js";
import { isOrganicSocialIntegration } from "../integrations/integration-purpose.js";
import { claimMetaWebhookEvent, recordMetaSendResult, recordMetaSendStarted } from "../social/meta-webhook-evidence.service.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";
import { orchestrateIntelligentConversation } from "../social/contextual-conversation.service.js";
import { metaGraphUrl } from "../../lib/meta-graph.constants.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export type CommentPlatform = "instagram" | "facebook_page" | "tiktok";
export type CommentClassification =
  | "hostile"
  | "spam"
  | "question"
  | "compliment"
  | "objection"
  | "neutral";
export type CommentActionType =
  | "pending"
  | "replied"
  | "deleted"
  | "hidden"
  | "liked"
  | "ignored"
  | "error";

export interface ModerationConfig {
  autoDeleteHostile: boolean;
  autoHideSpam: boolean;
  autoReplyQuestions: boolean;
  autoReplyCompliments: boolean;
  autoReplyObjections: boolean;
  replyTone: string;
  productContext: string;
  brandVoice: string;
  hostileKeywords: string[];
  ignoredAuthors: string[];
  /** Explicit policy gate for Meta's IG Comment Private Replies API. */
  enableInstagramPrivateReplies: boolean;
  /** Explicit keyword -> deterministic first response map (no AI in webhook path). */
  immediateKeywordReplies: Record<string, string>;
}

export const DEFAULT_CONFIG: ModerationConfig = {
  autoDeleteHostile: true,
  autoHideSpam: true,
  autoReplyQuestions: true,
  autoReplyCompliments: false,
  autoReplyObjections: true,
  replyTone: "amigável e profissional",
  productContext: "",
  brandVoice: "",
  hostileKeywords: [],
  ignoredAuthors: [],
  enableInstagramPrivateReplies: false,
  immediateKeywordReplies: {},
};

// ─── Meta Graph API helper ─────────────────────────────────────────────────

async function metaGraph<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...fetchOpts } = options;
  const url = new URL(metaGraphUrl(path));
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await metaGraphFetch(url.toString(), {
    ...fetchOpts,
    headers: { "Content-Type": "application/json", ...fetchOpts.headers },
  });
  const data = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || (data as { error?: { message: string } }).error?.message) {
    throw new Error(
      (data as { error?: { message: string } }).error?.message ??
        `Meta API ${res.status}`
    );
  }
  return data;
}

// ─── AI Classification ─────────────────────────────────────────────────────

export async function classifyComment(
  text: string,
  productContext: string,
  workspaceId: string
): Promise<{
  classification: CommentClassification;
  confidence: number;
  reasoning: string;
}> {
  const systemPrompt = `Você é um classificador de comentários de redes sociais para campanhas de marketing brasileiro.

Classifique o comentário em uma das categorias:
- hostile: ofensivo, agressivo, discurso de ódio, ataques pessoais, palavrões com intenção hostil
- spam: propaganda não solicitada, links suspeitos, repetição, bot, conteúdo irrelevante
- question: pergunta genuína sobre o produto, preço, funcionamento, disponibilidade
- compliment: elogio, agradecimento, expressão positiva sobre o produto ou criador
- objection: dúvida ou resistência sobre o produto ("isso funciona mesmo?", "é caro demais", "já tentei e não funcionou")
- neutral: comentário neutro, reação genérica, sem intenção clara

Contexto do produto: ${productContext || "produto digital/curso"}

Retorne APENAS JSON (sem markdown):
{"classification": "hostile|spam|question|compliment|objection|neutral", "confidence": 0.0-1.0, "reasoning": "string curta"}`;

  const messages: AIMessage[] = [{ role: "user", content: text }];

  try {
    const result = await completeWithAgent(
      "analytics",
      systemPrompt,
      messages,
      workspaceId,
      logger,
      undefined
    );
    const raw = result.content
      .replace(/```json\n?|\n?```/g, "")
      .trim();
    const json = JSON.parse(raw) as {
      classification: CommentClassification;
      confidence: number;
      reasoning: string;
    };
    return {
      classification: json.classification ?? "neutral",
      confidence: Number(json.confidence ?? 0.7),
      reasoning: json.reasoning ?? "",
    };
  } catch {
    // Keyword fallback
    const lower = text.toLowerCase();
    if (/merda|idiota|lixo|golpe|fraude|fdp|vigarist|viadinho|imbecil/.test(lower)) {
      return { classification: "hostile", confidence: 0.9, reasoning: "keyword match" };
    }
    if (/\?/.test(text)) {
      return { classification: "question", confidence: 0.7, reasoning: "question mark" };
    }
    return { classification: "neutral", confidence: 0.5, reasoning: "fallback" };
  }
}

// ─── AI Reply Generation ────────────────────────────────────────────────────

export async function generateCommentReply(
  commentText: string,
  classification: CommentClassification,
  config: ModerationConfig,
  workspaceId: string
): Promise<string> {
  const toneMap: Record<CommentClassification, string> = {
    question:
      "responda de forma clara, específica e útil. Inclua um CTA suave se fizer sentido.",
    compliment:
      "agradeça de forma calorosa, pessoal e genuína. Não seja corporativo.",
    objection:
      "valide a preocupação com empatia, apresente a contra-evidência específica, e convide para uma conversa privada se a dúvida for complexa.",
    hostile: "não responda comentários hostis.",
    spam: "não responda spam.",
    neutral:
      "interaja de forma leve e natural, criando senso de comunidade.",
  };

  const systemPrompt = `Você é o bot de comentários da marca respondendo em nome do criador de conteúdo.

Tom: ${config.replyTone || "amigável, próximo, sem ser corporativo"}
${config.brandVoice ? `Voz da marca: ${config.brandVoice}` : ""}
${config.productContext ? `Produto: ${config.productContext}` : ""}

Regras:
- Máximo 3 frases. Coloquial, natural, humanizado.
- NUNCA mencione que é um bot ou sistema automatizado.
- Não use frases genéricas como "Obrigado pelo seu comentário!"
- Use emoji com moderação (máximo 1-2).
- Instrução para esta categoria: ${toneMap[classification]}

Retorne APENAS o texto da resposta, sem aspas, sem markdown.`;

  const messages: AIMessage[] = [
    { role: "user", content: `Comentário: "${commentText}"\nEscreva a resposta:` },
  ];

  try {
    const result = await completeWithAgent(
      "copywriter",
      systemPrompt,
      messages,
      workspaceId,
      logger,
      undefined
    );
    return result.content.trim().replace(/^["']|["']$/g, "");
  } catch {
    return "Obrigado pelo seu comentário! 🙏";
  }
}

// ─── Platform API Actions ────────────────────────────────────────────────────

export async function deleteComment(
  commentId: string,
  accessToken: string
): Promise<boolean> {
  try {
    await metaGraph(`/${commentId}`, {
      method: "DELETE",
      params: { access_token: accessToken },
    });
    return true;
  } catch (err) {
    logger.warn({ err, commentId }, "Failed to delete comment");
    return false;
  }
}

export async function hideComment(
  commentId: string,
  accessToken: string
): Promise<boolean> {
  try {
    await metaGraph(`/${commentId}`, {
      method: "POST",
      body: JSON.stringify({
        is_hidden: true,
        access_token: accessToken,
      }),
    });
    return true;
  } catch (err) {
    logger.warn({ err, commentId }, "Failed to hide comment");
    return false;
  }
}

export async function replyToComment(
  commentId: string,
  replyText: string,
  accessToken: string,
  evidenceId?: string,
): Promise<string | null> {
  try {
    if (evidenceId) await recordMetaSendStarted(evidenceId, `/${commentId}/replies`, { message: replyText });
    const res = await metaGraph<{ id: string }>(`/${commentId}/replies`, {
      method: "POST",
      body: JSON.stringify({
        message: replyText,
        access_token: accessToken,
      }),
    });
    if (evidenceId) await recordMetaSendResult(evidenceId, { providerResponse: res, providerMessageId: res.id });
    return res.id;
  } catch (err) {
    if (evidenceId) await recordMetaSendResult(evidenceId, { error: err instanceof Error ? err.message : String(err) });
    logger.warn({ err, commentId }, "Failed to reply to comment");
    return null;
  }
}

export async function replyPrivatelyToInstagramComment(
  commentId: string,
  replyText: string,
  accessToken: string,
  evidenceId?: string,
): Promise<{ id: string | null; error: string | null }> {
  try {
    if (evidenceId) await recordMetaSendStarted(evidenceId, `/${commentId}/private_replies`, { message: replyText });
    // Official Instagram Graph API operation: POST /{ig-comment-id}/private_replies.
    const res = await metaGraph<{ id: string }>(`/${commentId}/private_replies`, {
      method: "POST",
      body: JSON.stringify({ message: replyText, access_token: accessToken }),
    });
    if (evidenceId) await recordMetaSendResult(evidenceId, { providerResponse: res, providerMessageId: res.id });
    return { id: res.id, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (evidenceId) await recordMetaSendResult(evidenceId, { error });
    logger.warn({ err, commentId }, "Instagram private comment reply failed");
    return { id: null, error };
  }
}

export async function likeComment(
  commentId: string,
  accessToken: string
): Promise<boolean> {
  try {
    await metaGraph(`/${commentId}/likes`, {
      method: "POST",
      body: JSON.stringify({ access_token: accessToken }),
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Fetch Comments from Meta API ────────────────────────────────────────────

export async function fetchPostComments(
  postId: string,
  accessToken: string
): Promise<
  Array<{
    id: string;
    message: string;
    from?: { name: string; id: string };
    parent?: { id: string };
    timestamp: string;
  }>
> {
  try {
    const res = await metaGraph<{
      data: Array<{
        id: string;
        message: string;
        from?: { name: string; id: string };
        parent?: { id: string };
        timestamp: string;
      }>;
    }>(`/${postId}/comments`, {
      params: {
        fields: "id,message,from,timestamp,parent",
        access_token: accessToken,
        limit: "100",
      },
    });
    return res.data ?? [];
  } catch (err) {
    logger.error({ err, postId }, "Failed to fetch comments");
    return [];
  }
}

// ─── Config Helpers ────────────────────────────────────────────────────────

export async function getModerationConfig(
  workspaceId: string
): Promise<ModerationConfig> {
  const ws = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1)
    .then((r) => r[0]);

  const stored = (ws?.settings as Record<string, unknown>)
    ?.socialModerationConfig;
  return {
    ...DEFAULT_CONFIG,
    ...(stored as Partial<ModerationConfig> ?? {}),
  };
}

export async function saveModerationConfig(
  workspaceId: string,
  config: Partial<ModerationConfig>
): Promise<void> {
  const ws = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1)
    .then((r) => r[0]);

  const existing = (ws?.settings as Record<string, unknown>) ?? {};
  const existingConfig =
    (existing.socialModerationConfig as Partial<ModerationConfig>) ?? {};

  await db
    .update(workspacesTable)
    .set({
      settings: {
        ...existing,
        socialModerationConfig: {
          ...DEFAULT_CONFIG,
          ...existingConfig,
          ...config,
        },
      },
    })
    .where(eq(workspacesTable.id, workspaceId));
}

// ─── Main Orchestrator ─────────────────────────────────────────────────────

export async function processIncomingComment(opts: {
  workspaceId: string;
  campaignId?: string;
  platform: CommentPlatform;
  postId: string;
  commentId: string;
  parentCommentId?: string;
  authorName: string;
  authorId: string;
  commentText: string;
  accessToken: string;
  integrationId?: string;
  /** IG business account ID (entry.id from webhook) — used to trigger DM keyword flows */
  igAccountId?: string;
}): Promise<void> {
  const {
    workspaceId,
    campaignId,
    platform,
    postId,
    commentId,
    parentCommentId,
    authorName,
    authorId,
    commentText,
    accessToken,
    integrationId,
    igAccountId,
  } = opts;

  if (!integrationId) {
    logger.warn({ workspaceId, platform, commentId }, "Comment has no integration context; failing closed");
    return;
  }
  const [integrationContext] = await db.select({
    accountId: workspaceIntegrationsTable.accountId,
    metadata: workspaceIntegrationsTable.metadata,
  }).from(workspaceIntegrationsTable).where(and(
    eq(workspaceIntegrationsTable.id, integrationId),
    eq(workspaceIntegrationsTable.workspaceId, workspaceId),
  )).limit(1);
  if (!integrationContext?.accountId || !isOrganicSocialIntegration(integrationContext.metadata as Record<string, unknown> | null)) {
    logger.warn({ workspaceId, integrationId, platform, commentId }, "Comment integration context mismatch; failing closed");
    return;
  }
  const accountId = integrationContext.accountId;
  if (igAccountId && igAccountId !== accountId) {
    logger.warn({ workspaceId, integrationId, platform, commentId }, "Comment account context mismatch; failing closed");
    return;
  }

  const eventClaim = await claimMetaWebhookEvent({
    workspaceId, integrationId, accountId,
    providerEventId: commentId,
    eventType: platform === "instagram" ? "instagram_comment" : "facebook_comment",
  });
  if (!eventClaim.claimed) return;

  // Legacy idempotency for historical comment action rows.
  const existing = await db
    .select({
      id: socialCommentActionsTable.id,
      action: socialCommentActionsTable.action,
    })
    .from(socialCommentActionsTable)
    .where(
      and(
        eq(socialCommentActionsTable.workspaceId, workspaceId),
        eq(socialCommentActionsTable.commentId, commentId)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  if (existing && existing.action !== "pending") return;

  const config = await getModerationConfig(workspaceId);

  // Skip ignored authors
  if (config.ignoredAuthors.includes(authorId)) return;

  const immediateReply = Object.entries(config.immediateKeywordReplies).find(([keyword]) =>
    keyword.trim() && commentText.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
  )?.[1]?.trim();
  if (immediateReply) {
    const publicReplyId = await replyToComment(commentId, immediateReply, accessToken, eventClaim.id);
    let privateReply: Record<string, unknown> | null = null;
    if (platform === "instagram" && config.enableInstagramPrivateReplies) {
      const privateClaim = await claimMetaWebhookEvent({
        workspaceId, integrationId, accountId, providerEventId: commentId,
        eventType: "instagram_comment", actionKey: "private_reply",
      });
      privateReply = privateClaim.claimed
        ? await replyPrivatelyToInstagramComment(commentId, immediateReply, accessToken, privateClaim.id)
        : { error: "already_claimed" };
    }
    await db.insert(socialCommentActionsTable).values({
      workspaceId, campaignId: campaignId ?? undefined, platform, postId, commentId,
      parentCommentId: parentCommentId ?? undefined, authorName, authorId, commentText,
      classification: "neutral", confidence: "1", action: publicReplyId ? "replied" : "error",
      aiReply: immediateReply, platformReplyId: publicReplyId ?? undefined,
      processingError: publicReplyId ? undefined : "Immediate reply API call failed",
      processedAt: new Date(),
      metadata: { deterministicKeywordReply: true, privateReply },
    });
    return;
  }

  // Classify
  const { classification, confidence, reasoning } = await classifyComment(
    commentText,
    config.productContext,
    workspaceId
  );

  // Override with keyword list
  const isKeywordHostile = config.hostileKeywords.some((kw) =>
    commentText.toLowerCase().includes(kw.toLowerCase())
  );
  const finalClassification: CommentClassification = isKeywordHostile
    ? "hostile"
    : classification;

  // Decide action
  let action: CommentActionType = "ignored";
  let aiReply: string | null = null;
  let platformReplyId: string | null = null;
  let privateReply: { attempted: boolean; id: string | null; error: string | null } | null = null;
  let error: string | null = null;
  const contextualDecision = (finalClassification === "question" || finalClassification === "objection")
    ? await orchestrateIntelligentConversation({
      workspaceId, integrationId, accountId,
      provider: platform === "instagram" ? "instagram" : "facebook",
      platformPostId: postId, campaignId, providerUserId: authorId,
      channel: platform === "instagram" ? "instagram_comment" : "facebook_comment",
      message: commentText,
    })
    : null;

  try {
    if (finalClassification === "hostile") {
      if (config.autoDeleteHostile && platform !== "tiktok") {
        const ok = await deleteComment(commentId, accessToken);
        action = ok ? "deleted" : "error";
        if (!ok) error = "Delete API call failed";
      } else {
        const ok = await hideComment(commentId, accessToken);
        action = ok ? "hidden" : "error";
      }
    } else if (finalClassification === "spam" && config.autoHideSpam) {
      const ok = await hideComment(commentId, accessToken);
      action = ok ? "hidden" : "ignored";
    } else if (
      finalClassification === "question" &&
      config.autoReplyQuestions
    ) {
      aiReply = contextualDecision?.action === "reply_public" ? contextualDecision.reply : null;
      if (contextualDecision?.needsHuman) error = contextualDecision.safetyReason;
      if (aiReply) {
        platformReplyId = await replyToComment(commentId, aiReply, accessToken, eventClaim.id);
        if (platform === "instagram" && config.enableInstagramPrivateReplies) {
          const privateClaim = await claimMetaWebhookEvent({ workspaceId, integrationId, accountId, providerEventId: commentId, eventType: "instagram_comment", actionKey: "private_reply" });
          privateReply = privateClaim.claimed
            ? { attempted: true, ...(await replyPrivatelyToInstagramComment(commentId, aiReply, accessToken, privateClaim.id)) }
            : { attempted: false, id: null, error: "already_claimed" };
          if (privateReply.error) error = `Private reply failed: ${privateReply.error}`;
        }
        action = platformReplyId ? "replied" : "error";
        if (!platformReplyId) error = "Reply API call failed";
      }
    } else if (
      finalClassification === "compliment" &&
      config.autoReplyCompliments
    ) {
      aiReply = await generateCommentReply(
        commentText,
        finalClassification,
        config,
        workspaceId
      );
      if (aiReply) {
        platformReplyId = await replyToComment(commentId, aiReply, accessToken, eventClaim.id);
        if (platform === "instagram" && config.enableInstagramPrivateReplies) {
          const privateClaim = await claimMetaWebhookEvent({ workspaceId, integrationId, accountId, providerEventId: commentId, eventType: "instagram_comment", actionKey: "private_reply" });
          privateReply = privateClaim.claimed
            ? { attempted: true, ...(await replyPrivatelyToInstagramComment(commentId, aiReply, accessToken, privateClaim.id)) }
            : { attempted: false, id: null, error: "already_claimed" };
          if (privateReply.error) error = `Private reply failed: ${privateReply.error}`;
        }
        await likeComment(commentId, accessToken);
        action = platformReplyId ? "replied" : "liked";
      } else {
        await likeComment(commentId, accessToken);
        action = "liked";
      }
    } else if (
      finalClassification === "objection" &&
      config.autoReplyObjections
    ) {
      aiReply = contextualDecision?.action === "reply_public" ? contextualDecision.reply : null;
      if (contextualDecision?.needsHuman) error = contextualDecision.safetyReason;
      if (aiReply) {
        platformReplyId = await replyToComment(commentId, aiReply, accessToken, eventClaim.id);
        if (platform === "instagram" && config.enableInstagramPrivateReplies) {
          const privateClaim = await claimMetaWebhookEvent({ workspaceId, integrationId, accountId, providerEventId: commentId, eventType: "instagram_comment", actionKey: "private_reply" });
          privateReply = privateClaim.claimed
            ? { attempted: true, ...(await replyPrivatelyToInstagramComment(commentId, aiReply, accessToken, privateClaim.id)) }
            : { attempted: false, id: null, error: "already_claimed" };
          if (privateReply.error) error = `Private reply failed: ${privateReply.error}`;
        }
        action = platformReplyId ? "replied" : "error";
        if (!platformReplyId) error = "Reply API call failed";
      }
    } else {
      action = "ignored";
    }
  } catch (err) {
    action = "error";
    error = err instanceof Error ? err.message : String(err);
    logger.error({ err, commentId, workspaceId }, "Comment moderation failed");
  }

  const recordData = {
    workspaceId,
    campaignId: campaignId ?? undefined,
    platform,
    postId,
    commentId,
    parentCommentId: parentCommentId ?? undefined,
    authorName,
    authorId,
    commentText,
    classification: finalClassification,
    confidence: String(confidence),
    action,
    aiReply: aiReply ?? undefined,
    platformReplyId: platformReplyId ?? undefined,
    processingError: error ?? undefined,
    processedAt: new Date(),
    metadata: { reasoning, isKeywordHostile, privateReply },
  };

  if (existing) {
    await db
      .update(socialCommentActionsTable)
      .set({
        classification: finalClassification,
        confidence: String(confidence),
        action,
        aiReply: aiReply ?? undefined,
        platformReplyId: platformReplyId ?? undefined,
        processingError: error ?? undefined,
        processedAt: new Date(),
        metadata: { reasoning, isKeywordHostile, privateReply },
      })
      .where(eq(socialCommentActionsTable.id, existing.id));
  } else {
    await db.insert(socialCommentActionsTable).values(recordData);
  }
  if (integrationId) {
    await db.insert(socialConversationTurnsTable).values({
      workspaceId, integrationId, accountId,
      providerUserId: authorId, providerEventId: commentId,
      channel: platform === "instagram" ? "instagram_comment" : "facebook_comment",
      direction: "inbound", inputText: commentText, replyText: aiReply,
      campaignId: campaignId ?? null, intent: contextualDecision?.intent,
      salesStage: contextualDecision?.salesStage,
      decision: contextualDecision?.action ?? action,
      confidence: String(contextualDecision?.confidence ?? confidence),
      needsHuman: String(contextualDecision?.needsHuman ?? false),
      safetyReason: contextualDecision?.safetyReason,
      contextFingerprint: contextualDecision?.contextProvenance.contextFingerprint,
      masterplanVersion: contextualDecision?.contextProvenance.masterplanVersion ? String(contextualDecision.contextProvenance.masterplanVersion) : null,
      provenance: contextualDecision?.contextProvenance ?? {},
      providerResponseId: platformReplyId,
      providerStatus: platformReplyId ? "sent" : "not_sent",
      sentAt: platformReplyId ? new Date() : null,
    }).onConflictDoNothing();
  }

  // ── DM keyword trigger ────────────────────────────────────────────────────
  // Quando alguém comenta uma palavra-chave configurada no post (ex: "MAPA"),
  // envia DM automático em < 30s — exigência do Meta App Review.
  // Funciona apenas para Instagram (DM via Messaging API).
  // handleInstagramDmTrigger já faz deduplicação (não dispara duas vezes pro mesmo user).
  if (platform === "instagram" && igAccountId) {
    setImmediate(() => {
      import("../social-presence/social-presence.service.js")
        .then(({ handleInstagramDmTrigger }) =>
          handleInstagramDmTrigger(igAccountId, authorId, commentText)
        )
        .catch((err) =>
          logger.warn({ err, commentId, igAccountId }, "comment→DM trigger error (non-fatal)")
        );
    });
  }
}

// ─── Sync all comments on a post ─────────────────────────────────────────────

export async function syncPostComments(opts: {
  workspaceId: string;
  integrationId: string;
  accountId: string;
  postId: string;
  platform: CommentPlatform;
  accessToken: string;
  campaignId?: string;
}): Promise<{ processed: number; skipped: number }> {
  const { workspaceId, integrationId, accountId, postId, platform, accessToken, campaignId } = opts;
  const comments = await fetchPostComments(postId, accessToken);

  let processed = 0;
  let skipped = 0;

  for (const c of comments) {
    // Skip reply threads (parent present = it's a reply, not a top-level comment)
    if (c.parent) {
      skipped++;
      continue;
    }
    await processIncomingComment({
      workspaceId,
      campaignId,
      platform,
      postId,
      commentId: c.id,
      authorName: c.from?.name ?? "unknown",
      authorId: c.from?.id ?? "unknown",
      commentText: c.message,
      accessToken,
      integrationId,
      igAccountId: accountId,
    });
    processed++;
  }

  return { processed, skipped };
}

// ─── Dashboard queries ──────────────────────────────────────────────────────

export async function getCommentActions(
  workspaceId: string,
  filters: {
    platform?: CommentPlatform;
    classification?: CommentClassification;
    action?: CommentActionType;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ actions: SocialCommentAction[]; total: number }> {
  const conditions = [
    eq(socialCommentActionsTable.workspaceId, workspaceId),
  ];

  if (filters.platform) {
    conditions.push(
      eq(socialCommentActionsTable.platform, filters.platform)
    );
  }
  if (filters.classification) {
    conditions.push(
      eq(
        socialCommentActionsTable.classification,
        filters.classification
      )
    );
  }
  if (filters.action) {
    conditions.push(
      eq(socialCommentActionsTable.action, filters.action)
    );
  }

  const [actions, countRows] = await Promise.all([
    db
      .select()
      .from(socialCommentActionsTable)
      .where(and(...conditions))
      .orderBy(desc(socialCommentActionsTable.createdAt))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0),
    db
      .select({ id: socialCommentActionsTable.id })
      .from(socialCommentActionsTable)
      .where(and(...conditions)),
  ]);

  return { actions, total: countRows.length };
}

export async function overrideCommentAction(
  commentActionId: string,
  workspaceId: string,
  userId: string,
  newAction: CommentActionType,
  manualReply?: string,
  accessToken?: string
): Promise<void> {
  const record = await db
    .select()
    .from(socialCommentActionsTable)
    .where(
      and(
        eq(socialCommentActionsTable.id, commentActionId),
        eq(socialCommentActionsTable.workspaceId, workspaceId)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  if (!record) throw new Error("Comment action not found");

  let platformReplyId: string | undefined;
  let error: string | undefined;

  if (newAction === "replied" && manualReply && accessToken) {
    const replyId = await replyToComment(
      record.commentId,
      manualReply,
      accessToken
    );
    if (replyId) platformReplyId = replyId;
    else error = "Reply failed";
  } else if (newAction === "deleted" && accessToken) {
    await deleteComment(record.commentId, accessToken);
  } else if (newAction === "hidden" && accessToken) {
    await hideComment(record.commentId, accessToken);
  }

  await db
    .update(socialCommentActionsTable)
    .set({
      action: newAction,
      aiReply: manualReply ?? record.aiReply ?? undefined,
      platformReplyId:
        platformReplyId ?? record.platformReplyId ?? undefined,
      processingError: error,
      overriddenBy: userId,
      overriddenAt: new Date(),
    })
    .where(eq(socialCommentActionsTable.id, commentActionId));
}

// ─── Webhook helper — find workspace from platform account ─────────────────

export async function findWorkspaceByPlatformAccount(
  platform: "instagram" | "facebook_page",
  pageOrAccountId: string
): Promise<{ workspaceId: string; integrationId: string; accessToken: string } | null> {
  const provider = platform === "instagram" ? "instagram" : "meta_ads";

  const rows = await db
    .select({
      workspaceId: workspaceIntegrationsTable.workspaceId,
      integrationId: workspaceIntegrationsTable.id,
      accessToken: workspaceIntegrationsTable.accessToken,
      accountId: workspaceIntegrationsTable.accountId,
      status: workspaceIntegrationsTable.status,
      metadata: workspaceIntegrationsTable.metadata,
    })
    .from(workspaceIntegrationsTable)
    .where(eq(workspaceIntegrationsTable.provider, provider));

  const match = rows.find(
    (r) =>
      r.accountId === pageOrAccountId &&
      r.status === "connected" &&
      typeof r.accessToken === "string" &&
      r.accessToken.trim().length > 0 &&
      isOrganicSocialIntegration(r.metadata as Record<string, unknown> | null),
  );

  if (!match) {
    logger.warn({ platform, pageOrAccountId }, "Unroutable Meta webhook account");
    return null;
  }
  return { workspaceId: match.workspaceId, integrationId: match.integrationId, accessToken: match.accessToken! };
}

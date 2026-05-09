import { eq, and, desc } from "drizzle-orm";
import {
  db,
  campaignsTable,
  contentPiecesTable,
  mediaBriefsTable,
  auditLogsTable,
} from "@workspace/db";
import { runCopywriterAgent } from "../agents/copywriter.agent.js";
import { runSocialMediaAgent } from "../agents/social-media.agent.js";
import { runAdCopyAgent } from "../agents/ad-copy.agent.js";
import { runVSLScriptAgent } from "../agents/vsl-script.agent.js";
import { runMediaBriefAgent } from "../agents/media-brief.agent.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { ProfileBuilderOutput } from "../agents/profile-builder.agent.js";
import type { StrategyOutput } from "../agents/strategy.agent.js";
import type { Logger } from "pino";

export interface ContentGenerationResult {
  campaignId: string;
  piecesGenerated: number;
  mediaBriefsGenerated: number;
  agentsRun: string[];
  errors: { agent: string; error: string }[];
  status: "completed" | "partial" | "failed";
}

const CONTENT_GENERATION_ALLOWED_STATUSES = [
  "approved",
  "generating",
  "active",
];

export async function generateCampaignContent(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<ContentGenerationResult> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  if (!CONTENT_GENERATION_ALLOWED_STATUSES.includes(campaign.status)) {
    throw new ValidationError(
      `Campaign must be approved before content generation. Current status: ${campaign.status}`,
    );
  }

  const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const profile = campaign.audienceData
    ? extractProfile(campaign.audienceData)
    : undefined;
  const strategy = campaign.strategyData as unknown as StrategyOutput | undefined;
  const launchPlan = (campaign.timelineData ?? undefined) as
    | Record<string, unknown>
    | undefined;

  if (!strategy) {
    throw new ValidationError(
      "Campaign strategy not found. Run orchestration first.",
    );
  }

  const agentsRun: string[] = [];
  const errors: { agent: string; error: string }[] = [];
  let piecesGenerated = 0;
  let mediaBriefsGenerated = 0;

  await db
    .update(campaignsTable)
    .set({ status: "generating" })
    .where(eq(campaignsTable.id, campaignId));

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: "Iniciando produção de conteúdo — 5 agentes em execução...",
    data: { phase: "content_production" },
    timestamp: new Date().toISOString(),
  });

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "content.generation.started",
    actor: "system",
    data: { hasProfile: !!profile, hasStrategy: !!strategy, hasLaunchPlan: !!launchPlan },
  });

  // ── 1. Copywriter Agent ─────────────────────────────────────────────────────
  try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "copywriter",
      message: "Agente Copywriter — escrevendo toda a copy da campanha...",
      timestamp: new Date().toISOString(),
    });

    const copyOutput = await runCopywriterAgent(
      campaignId,
      workspaceId,
      intakeData,
      strategy,
      profile,
      launchPlan,
      log,
    );

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "email_sequence",
        status: "draft",
        title: `Copy Completa — ${copyOutput.campaignTitle}`,
        content: copyOutput as any,
        aiProvider: "openai",
        creditsUsed: 80,
      })
      .returning();

    piecesGenerated++;
    agentsRun.push("copywriter");

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "copywriter",
      message: `Copywriter concluído — ${copyOutput.emailSequence.preLaunch.length + copyOutput.emailSequence.cartOpen.length + copyOutput.emailSequence.cartClose.length} e-mails + página de vendas + WhatsApp`,
      data: { pieceId: piece?.id },
      timestamp: new Date().toISOString(),
    });

    log.info({ campaignId, pieceId: piece?.id }, "Copywriter agent completed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "copywriter", error: msg });
    log.error({ err, campaignId }, "Copywriter agent failed");
    emitAgentError(campaignId, "copywriter", err);
  }

  // ── 2. Social Media Agent ───────────────────────────────────────────────────
  try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "social_media",
      message: "Agente Social Media — montando calendário de conteúdo...",
      timestamp: new Date().toISOString(),
    });

    const socialOutput = await runSocialMediaAgent(
      campaignId,
      workspaceId,
      intakeData,
      strategy,
      profile,
      launchPlan,
      log,
    );

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "content_calendar",
        status: "draft",
        title: `Calendário de Social Media — ${socialOutput.totalDays} dias`,
        content: socialOutput as any,
        aiProvider: "openai",
        creditsUsed: 60,
      })
      .returning();

    piecesGenerated++;
    agentsRun.push("social_media");

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "social_media",
      message: `Social Media concluído — ${socialOutput.calendar.length} posts em ${socialOutput.totalDays} dias`,
      data: { pieceId: piece?.id },
      timestamp: new Date().toISOString(),
    });

    log.info({ campaignId, pieceId: piece?.id, posts: socialOutput.calendar.length }, "Social media agent completed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "social_media", error: msg });
    log.error({ err, campaignId }, "Social media agent failed");
    emitAgentError(campaignId, "social_media", err);
  }

  // ── 3. Ad Copy Agent ────────────────────────────────────────────────────────
  try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "ad_copy",
      message: "Agente Ad Copy — criando anúncios para Meta, Google e TikTok...",
      timestamp: new Date().toISOString(),
    });

    const adOutput = await runAdCopyAgent(
      campaignId,
      workspaceId,
      intakeData,
      strategy,
      profile,
      log,
    );

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "ad_copy",
        status: "draft",
        title: `Pacote de Anúncios — ${adOutput.segments.length} segmentos`,
        content: adOutput as any,
        aiProvider: "openai",
        creditsUsed: 50,
      })
      .returning();

    piecesGenerated++;
    agentsRun.push("ad_copy");

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "ad_copy",
      message: `Ad Copy concluído — ${adOutput.segments.length} segmentos com Meta + Google + TikTok`,
      data: { pieceId: piece?.id },
      timestamp: new Date().toISOString(),
    });

    log.info({ campaignId, pieceId: piece?.id }, "Ad copy agent completed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "ad_copy", error: msg });
    log.error({ err, campaignId }, "Ad copy agent failed");
    emitAgentError(campaignId, "ad_copy", err);
  }

  // ── 4. VSL Script Agent ─────────────────────────────────────────────────────
  const campaignType = String(intakeData["campaign.type"] ?? campaign.type ?? "launch");
  const hasVSL = ["launch", "perpetual_launch", "continuous_sales", "live_sale"].includes(campaignType);

  if (hasVSL) {
    try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "vsl_script",
        message: "Agente VSL Script — escrevendo roteiro completo do vídeo de vendas...",
        timestamp: new Date().toISOString(),
      });

      const vslOutput = await runVSLScriptAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy,
        profile,
        log,
      );

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "vsl_script",
          status: "draft",
          title: vslOutput.title,
          content: vslOutput as any,
          aiProvider: "openai",
          creditsUsed: 70,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("vsl_script");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "vsl_script",
        message: `VSL Script concluído — ${vslOutput.totalDuration} | ${vslOutput.sections.length} seções`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id, duration: vslOutput.totalDuration }, "VSL script agent completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "vsl_script", error: msg });
      log.error({ err, campaignId }, "VSL script agent failed");
      emitAgentError(campaignId, "vsl_script", err);
    }
  }

  // ── 5. Media Brief Agent ────────────────────────────────────────────────────
  try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "media_brief",
      message: "Agente Media Brief — criando briefings visuais para imagens e vídeos...",
      timestamp: new Date().toISOString(),
    });

    const mediaOutput = await runMediaBriefAgent(
      campaignId,
      workspaceId,
      intakeData,
      profile,
      undefined,
      log,
    );

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "media_brief",
        status: "pending_approval",
        title: `Briefings de Mídia — ${mediaOutput.imageConcepts.length} imagens + ${mediaOutput.videoConcepts.length} vídeos`,
        content: mediaOutput as any,
        aiProvider: "google",
        creditsUsed: 40,
      })
      .returning();

    // Save individual media briefs to mediaBriefsTable for approval flow
    const allConcepts = [
      ...mediaOutput.imageConcepts.map((c) => ({ ...c, kind: "image" as const })),
      ...mediaOutput.videoConcepts.map((c) => ({ ...c, kind: "video" as const })),
    ];

    for (const concept of allConcepts.slice(0, 20)) {
      await db.insert(mediaBriefsTable).values({
        campaignId,
        workspaceId,
        contentPieceId: piece?.id,
        mediaType: concept.kind,
        conceptStatus: "pending_concept",
        conceptData: concept as any,
      });
      mediaBriefsGenerated++;
    }

    piecesGenerated++;
    agentsRun.push("media_brief");

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "media_brief",
      message: `Media Brief concluído — ${mediaOutput.imageConcepts.length} conceitos de imagem + ${mediaOutput.videoConcepts.length} conceitos de vídeo aguardando aprovação`,
      data: { pieceId: piece?.id, mediaBriefs: mediaBriefsGenerated },
      timestamp: new Date().toISOString(),
    });

    log.info(
      { campaignId, pieceId: piece?.id, mediaBriefs: mediaBriefsGenerated },
      "Media brief agent completed",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "media_brief", error: msg });
    log.error({ err, campaignId }, "Media brief agent failed");
    emitAgentError(campaignId, "media_brief", err);
  }

  // ── Final status ────────────────────────────────────────────────────────────
  const finalStatus =
    errors.length === 0
      ? "active"
      : errors.length < agentsRun.length
        ? "active"
        : "approved";

  await db
    .update(campaignsTable)
    .set({ status: finalStatus as any })
    .where(eq(campaignsTable.id, campaignId));

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "content.generation.completed",
    actor: "system",
    data: { agentsRun, piecesGenerated, mediaBriefsGenerated, errors, finalStatus },
  });

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: `Produção de conteúdo concluída — ${piecesGenerated} peças geradas`,
    data: { agentsRun, piecesGenerated, mediaBriefsGenerated, errors: errors.length },
    timestamp: new Date().toISOString(),
  });

  return {
    campaignId,
    piecesGenerated,
    mediaBriefsGenerated,
    agentsRun,
    errors,
    status: errors.length === 0 ? "completed" : errors.length < 5 ? "partial" : "failed",
  };
}

export async function getCampaignContent(
  campaignId: string,
  workspaceId: string,
  type?: string,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const query = db
    .select()
    .from(contentPiecesTable)
    .where(
      and(
        eq(contentPiecesTable.campaignId, campaignId),
        eq(contentPiecesTable.workspaceId, workspaceId),
        ...(type ? [eq(contentPiecesTable.type, type as any)] : []),
      ),
    )
    .orderBy(desc(contentPiecesTable.createdAt));

  const pieces = await query;
  return pieces;
}

export async function getCampaignMediaBriefs(
  campaignId: string,
  workspaceId: string,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  return db
    .select()
    .from(mediaBriefsTable)
    .where(eq(mediaBriefsTable.campaignId, campaignId))
    .orderBy(desc(mediaBriefsTable.createdAt));
}

export async function approveContentPiece(
  campaignId: string,
  workspaceId: string,
  pieceId: string,
) {
  await assertCampaignAccess(campaignId, workspaceId);

  const [updated] = await db
    .update(contentPiecesTable)
    .set({ status: "approved", approvedAt: new Date() })
    .where(
      and(
        eq(contentPiecesTable.id, pieceId),
        eq(contentPiecesTable.campaignId, campaignId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError("Content piece");

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "content.piece.approved",
    actor: "user",
    data: { pieceId, type: updated.type },
  });

  return updated;
}

export async function rejectContentPiece(
  campaignId: string,
  workspaceId: string,
  pieceId: string,
  reason: string,
) {
  await assertCampaignAccess(campaignId, workspaceId);

  const [updated] = await db
    .update(contentPiecesTable)
    .set({ status: "rejected", rejectedAt: new Date(), rejectionReason: reason })
    .where(
      and(
        eq(contentPiecesTable.id, pieceId),
        eq(contentPiecesTable.campaignId, campaignId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError("Content piece");

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "content.piece.rejected",
    actor: "user",
    data: { pieceId, type: updated.type, reason },
  });

  return updated;
}

export async function approveMediaBrief(
  campaignId: string,
  workspaceId: string,
  briefId: string,
) {
  await assertCampaignAccess(campaignId, workspaceId);

  const [updated] = await db
    .update(mediaBriefsTable)
    .set({ conceptStatus: "concept_approved", approvedAt: new Date() })
    .where(
      and(
        eq(mediaBriefsTable.id, briefId),
        eq(mediaBriefsTable.campaignId, campaignId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError("Media brief");

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "media.brief.approved",
    actor: "user",
    data: { briefId, mediaType: updated.mediaType },
  });

  return updated;
}

export async function rejectMediaBrief(
  campaignId: string,
  workspaceId: string,
  briefId: string,
  feedback: string,
) {
  await assertCampaignAccess(campaignId, workspaceId);

  const [updated] = await db
    .update(mediaBriefsTable)
    .set({ conceptStatus: "concept_rejected", userFeedback: feedback })
    .where(
      and(
        eq(mediaBriefsTable.id, briefId),
        eq(mediaBriefsTable.campaignId, campaignId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError("Media brief");

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "media.brief.rejected",
    actor: "user",
    data: { briefId, feedback },
  });

  return updated;
}

async function assertCampaignAccess(campaignId: string, workspaceId: string) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");
}

function extractProfile(audienceData: unknown): ProfileBuilderOutput | undefined {
  if (!audienceData || typeof audienceData !== "object") return undefined;
  const d = audienceData as Record<string, unknown>;
  if (!d["primaryAvatar"]) return undefined;
  return audienceData as unknown as ProfileBuilderOutput;
}

function emitAgentError(
  campaignId: string,
  agentType: string,
  err: unknown,
): void {
  emitCampaignEvent({
    campaignId,
    type: "agent_failed",
    agentType,
    message: `${agentType} falhou: ${err instanceof Error ? err.message : String(err)}`,
    timestamp: new Date().toISOString(),
  });
}

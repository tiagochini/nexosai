import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import {
  generateCampaignContent,
  getCampaignContent,
  getCampaignMediaBriefs,
  approveContentPiece,
  rejectContentPiece,
  rewriteContentPiece,
  regeneratePiece,
  generateExtraContent,
  approveMediaBrief,
  rejectMediaBrief,
  optimizeCampaign,
  resolveComplianceReview,
  patchContentPiece,
} from "./content.service.js";
import { applyBudgetDecision } from "./budget-decision.service.js";
import { processContentPieceApproval } from "../memory/memory.service.js";
import { runPostApprovalHooks } from "./content-post-approval.js";
import { autoGenerateCreativesFromBrief } from "./creative-auto-gen.service.js";
import { ContentTypeSchema } from "@workspace/db";

const router = Router();
router.use(requireAuth);

// GET /campaigns/:campaignId/content — list all content pieces
router.get("/:campaignId/content", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const type = req.query["type"] as string | undefined;
  const mentalTrigger = req.query["trigger"] as string | undefined;
  const launchPhase = req.query["launchPhase"] as string | undefined;

  if (type) {
    const parsed = ContentTypeSchema.safeParse(type);
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid type: ${type}`, code: "VALIDATION_ERROR" });
      return;
    }
  }

  try {
    const result = await getCampaignContent(
      campaignId,
      req.auth.workspaceId,
      type,
      mentalTrigger,
      launchPhase,
    );
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:campaignId/content/compliance-scan — pre-scan results
router.get("/:campaignId/content/compliance-scan", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  try {
    const { getComplianceSweepSummary } = await import("./content-compliance-sweep.js");
    const summary = await getComplianceSweepSummary(campaignId, req.auth.workspaceId);
    res.json({ summary });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:campaignId/content/media-briefs — list media briefs
router.get("/:campaignId/content/media-briefs", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await getCampaignMediaBriefs(campaignId, req.auth.workspaceId);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/generate — trigger content generation
router.post("/:campaignId/content/generate", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await generateCampaignContent(
      campaignId,
      req.auth.workspaceId,
      req.log,
    );
    res.status(202).json({
      message: "Content generation completed",
      result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/:pieceId/generate-visual
// Creates a DALL-E concept for a social-media content piece (no image yet).
// The concept is stored in campaignCreativesTable with metadata.contentPieceId.
// After approve-concept → preview → approve-preview → final, the finalMediaUrl
// is written back to the piece and autopost is re-triggered.
router.post("/:campaignId/content/:pieceId/generate-visual", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };
  try {
    const { generateVisualForPiece } = await import("./creative-auto-gen.service.js");
    const result = await generateVisualForPiece(campaignId, req.auth.workspaceId, pieceId, req.log);
    res.json({ creativeId: result.creativeId, conceptTitle: result.conceptTitle, dallePrompt: result.dallePrompt });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : "Erro ao gerar conceito visual";
    res.status(500).json({ error: msg });
  }
});

// POST /campaigns/:campaignId/content/:pieceId/approve
const approvePieceSchema = z.object({
  feedback: z.string().optional().default(""),
  force: z.boolean().optional().default(false),
});

router.post("/:campaignId/content/:pieceId/approve", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };

  const parsed = approvePieceSchema.safeParse(req.body);
  const forceApprove = parsed.success ? parsed.data.force : false;

  try {
    // ── Compliance gate ────────────────────────────────────────────────────────
    // Always runs. The `force` flag only bypasses non-blocked violations
    // (high_risk and lower). Pieces with riskLevel="blocked" cannot be approved
    // regardless of the force flag — they must be rewritten first.
    {
      const { db, contentPiecesTable, campaignsTable } = await import("@workspace/db");
      const { eq, and } = await import("drizzle-orm");
      const { validatePieceCompliance } = await import("../agents/compliance.agent.js");

      // Enforce ownership: piece must belong to the requested campaign,
      // and that campaign must belong to the requesting workspace.
      const [dbPiece] = await db
        .select({ content: contentPiecesTable.content, type: contentPiecesTable.type })
        .from(contentPiecesTable)
        .innerJoin(campaignsTable, and(
          eq(campaignsTable.id, contentPiecesTable.campaignId),
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, req.auth.workspaceId),
        ))
        .where(eq(contentPiecesTable.id, pieceId))
        .limit(1);

      if (dbPiece?.content) {
        const rawContent = dbPiece.content;
        let pieceText = "";

        if (typeof rawContent === "string") {
          pieceText = rawContent;
        } else if (rawContent && typeof rawContent === "object") {
          // Extract human-readable text from structured JSONB content
          const c = rawContent as Record<string, unknown>;
          const candidates: string[] = [];
          for (const key of ["body", "caption", "copyText", "primaryText", "script",
            "message", "subject", "headline", "bigPromise", "openingLine"]) {
            if (typeof c[key] === "string") candidates.push(c[key] as string);
          }
          // Walk one level deep into arrays for email sequences, sections, etc.
          for (const key of ["sections", "emailSequence", "videos", "segments"]) {
            const arr = c[key];
            if (Array.isArray(arr)) {
              (arr as Record<string, unknown>[]).slice(0, 5).forEach(item => {
                for (const f of ["body", "script", "copyText", "caption", "subject"]) {
                  if (typeof item[f] === "string") candidates.push(item[f] as string);
                }
              });
            }
          }
          pieceText = candidates.join("\n\n").slice(0, 4000);
        }

        if (pieceText.length >= 30) {
          const complianceResult = await validatePieceCompliance(
            pieceText,
            dbPiece.type ?? "content",
            campaignId,
            req.auth.workspaceId,
            req.log,
          );

          const isBlocked = complianceResult.riskLevel === "blocked";
          // Blocked pieces can never be force-approved — they must be rewritten.
          // High-risk and lower can be overridden with explicit force=true.
          const shouldBlock = !complianceResult.passed && (isBlocked || !forceApprove);

          if (shouldBlock) {
            res.status(422).json({
              code: "COMPLIANCE_VIOLATION",
              error: isBlocked
                ? "Peça com risco BLOQUEADO não pode ser aprovada — reescreva antes de publicar"
                : "Peça bloqueada por compliance — corrija as violações ou force a aprovação",
              compliance: complianceResult,
            });
            return;
          }
        }
      }
    }

    const piece = await approveContentPiece(
      campaignId,
      req.auth.workspaceId,
      pieceId,
    );
    // All post-approval side-effects are isolated in content-post-approval.ts
    runPostApprovalHooks({
      workspaceId: req.auth.workspaceId,
      campaignId,
      pieceId,
      pieceType: piece.type ?? "copywriter",
      log: req.log,
    });
    res.json({ message: "Content piece approved", piece });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/:pieceId/reject
const rejectPieceSchema = z.object({
  reason: z.string().optional().default(""),
  feedback: z.string().optional().default(""),
});

router.post("/:campaignId/content/:pieceId/reject", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };

  const parsed = rejectPieceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const reason = parsed.data.reason || parsed.data.feedback || "";
    const piece = await rejectContentPiece(
      campaignId,
      req.auth.workspaceId,
      pieceId,
      reason,
    );
    // Fire-and-forget memory save — never blocks response
    processContentPieceApproval(
      req.auth.workspaceId,
      campaignId,
      pieceId,
      piece.type ?? "copywriter",
      false,
      reason,
    ).catch(() => undefined);
    res.json({ message: "Content piece rejected", piece });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/:pieceId/regenerate — re-run the original agent for this piece type
// Fire-and-forget: responds 202 immediately, agent runs in background.
// Frontend polls GET /content until piece.status changes to "pending_approval".
router.post("/:campaignId/content/:pieceId/regenerate", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };
  const workspaceId = req.auth.workspaceId;
  const log = req.log;

  // Validate campaign + piece exist before accepting — fast DB check, no LLM
  try {
    const { db } = await import("@workspace/db");
    const { campaignsTable, contentPiecesTable } = await import("@workspace/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const [campaign] = await db.select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
      .limit(1);
    if (!campaign) { res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" }); return; }
    const [piece] = await db.select({ id: contentPiecesTable.id })
      .from(contentPiecesTable)
      .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
      .limit(1);
    if (!piece) { res.status(404).json({ error: "Content piece not found", code: "NOT_FOUND" }); return; }
  } catch (err) {
    if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; }
    throw err;
  }

  // Accept immediately — agent runs in background
  res.status(202).json({ message: "Regeneração iniciada — aguarde a peça atualizar", status: "regenerating" });

  setImmediate(async () => {
    try {
      await regeneratePiece(campaignId, workspaceId, pieceId, log);
      log.info({ campaignId, pieceId }, "Background regeneratePiece completed");
    } catch (err) {
      log.error({ err, campaignId, pieceId }, "Background regeneratePiece failed");
    }
  });
});

// POST /campaigns/:campaignId/content/:pieceId/rewrite — AI rewrites piece based on rejection feedback
const rewriteSchema = z.object({
  feedback: z.string().optional().default(""),
});

router.post("/:campaignId/content/:pieceId/rewrite", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };

  const parsed = rewriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const piece = await rewriteContentPiece(
      campaignId,
      req.auth.workspaceId,
      pieceId,
      parsed.data.feedback,
      req.log,
    );
    res.json({ message: "Content piece rewritten by AI", piece });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/generate-extra — generate additional pieces for a platform
const generateExtraSchema = z.object({
  platform: z.string().min(1),
  count: z.number().int().min(1).max(10).default(3),
  instructions: z.string().optional().default(""),
});

router.post("/:campaignId/content/generate-extra", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const parsed = generateExtraSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const result = await generateExtraContent(
      campaignId,
      req.auth.workspaceId,
      parsed.data.platform,
      parsed.data.count,
      parsed.data.instructions,
      req.log,
    );
    res.status(201).json({ message: "Extra content generated", ...result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/media-briefs/:briefId/approve
router.post("/:campaignId/content/media-briefs/:briefId/approve", async (req, res): Promise<void> => {
  const { campaignId, briefId } = req.params as { campaignId: string; briefId: string };

  try {
    const brief = await approveMediaBrief(campaignId, req.auth.workspaceId, briefId);
    res.json({ message: "Media brief concept approved", brief });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/:pieceId/generate-creatives  (Fix E1/Bug #09)
// Explicit second step: user confirms they want creative concept records created.
// This is intentionally separate from approval — approving a media_brief does NOT
// auto-trigger this. No DALL-E call happens here; it only creates concept_ready rows
// which the user must then individually promote to preview (DALL-E) → final.
router.post("/:campaignId/content/:pieceId/generate-creatives", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };

  try {
    const { db, contentPiecesTable, campaignsTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");

    // Verify ownership: piece must belong to this campaign + this workspace
    const [piece] = await db
      .select({ id: contentPiecesTable.id, type: contentPiecesTable.type, status: contentPiecesTable.status })
      .from(contentPiecesTable)
      .innerJoin(
        campaignsTable,
        and(
          eq(campaignsTable.id, contentPiecesTable.campaignId),
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, req.auth.workspaceId),
        ),
      )
      .where(eq(contentPiecesTable.id, pieceId))
      .limit(1);

    if (!piece) {
      res.status(404).json({ error: "Peça não encontrada", code: "NOT_FOUND" });
      return;
    }

    if (piece.type !== "media_brief") {
      res.status(422).json({
        error: "Apenas peças do tipo media_brief podem gerar criativos",
        code: "INVALID_PIECE_TYPE",
      });
      return;
    }

    if (piece.status !== "approved") {
      res.status(422).json({
        error: "O media brief deve estar aprovado antes de gerar criativos",
        code: "PIECE_NOT_APPROVED",
      });
      return;
    }

    // Acknowledge immediately — generation runs fire-and-forget
    res.json({
      message: "Geração de criativos iniciada — os conceitos aparecerão em Criativos em instantes",
      pieceId,
      note: "Nenhum crédito DALL-E é consumido aqui. Créditos só são debitados quando você confirmar a geração da imagem (preview ou final) em cada criativo individualmente.",
    });

    // Run the concept creation async — no DALL-E calls, no credit deduction
    setImmediate(() => {
      autoGenerateCreativesFromBrief(campaignId, req.auth.workspaceId, pieceId, req.log)
        .catch((err: unknown) => {
          req.log.warn({ err, campaignId, pieceId }, "generate-creatives endpoint: autoGenerateCreativesFromBrief failed — non-blocking");
        });
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/media-briefs/:briefId/reject
const rejectBriefSchema = z.object({
  feedback: z.string().min(1, "Feedback is required for rejection"),
});

router.post("/:campaignId/content/media-briefs/:briefId/reject", async (req, res): Promise<void> => {
  const { campaignId, briefId } = req.params as { campaignId: string; briefId: string };

  const parsed = rejectBriefSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const brief = await rejectMediaBrief(
      campaignId,
      req.auth.workspaceId,
      briefId,
      parsed.data.feedback,
    );
    res.json({ message: "Media brief concept rejected", brief });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:campaignId/content/coherence — emotional coherence report
router.get("/:campaignId/content/coherence", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const { db, campaignsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");

  const [campaign] = await db
    .select({ brainData: campaignsTable.brainData })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
    return;
  }

  const brain = (campaign.brainData ?? {}) as Record<string, unknown>;
  const report = brain["coherenceReport"] ?? null;

  res.json({ report });
});

// POST /campaigns/:campaignId/content/coherence — manually trigger coherence check
router.post("/:campaignId/content/coherence", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const { runEmotionalCoherenceCheck } = await import("../agents/emotional-coherence-checker.agent.js");

  try {
    const report = await runEmotionalCoherenceCheck(campaignId, req.auth.workspaceId, req.log);
    if (!report) {
      res.status(422).json({ error: "Não foi possível gerar o relatório. Verifique se o arco emocional e as peças de conteúdo existem.", code: "COHERENCE_UNAVAILABLE" });
      return;
    }
    res.json({ report });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/optimize — run optimization agent with live metrics
const optimizeSchema = z.object({
  metrics: z.record(z.string(), z.unknown()),
});

router.post("/:campaignId/content/optimize", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const parsed = optimizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const result = await optimizeCampaign(
      campaignId,
      req.auth.workspaceId,
      parsed.data.metrics,
      req.log,
    );
    res.status(202).json({
      message: "Optimization analysis completed",
      pieceId: result.pieceId,
      output: result.output,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/compliance/resolve
// Called when user decides how to handle compliance violations.
// decision: "accept_all" | "custom" | "override"
const complianceResolveSchema = z.object({
  decision: z.enum(["accept_all", "custom", "override", "request_revision"]),
  corrections: z.array(z.object({
    violationIndex: z.number().int().min(0),
    acceptedText: z.string().min(1),
  })).optional(),
});

router.post("/:campaignId/compliance/resolve", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const parsed = complianceResolveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const result = await resolveComplianceReview(
      campaignId,
      req.auth.workspaceId,
      parsed.data.decision,
      parsed.data.corrections,
      req.log,
    );
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// PATCH /campaigns/:campaignId/content/:pieceId/patch
// Targeted text replacement per compliance-suggested correction — no full AI rewrite needed.
const patchPieceSchema = z.object({
  patches: z.array(z.object({
    originalText: z.string().min(1),
    correctedText: z.string().min(1),
  })).min(1).max(20),
});

router.patch("/:campaignId/content/:pieceId/patch", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };

  const parsed = patchPieceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const piece = await patchContentPiece(
      campaignId,
      req.auth.workspaceId,
      pieceId,
      parsed.data.patches,
    );
    res.json({ message: "Content piece patched", piece });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/:pieceId/publish-social
// Step 1 (no body / confirmed:false): preview — returns which platforms would receive the post.
// Step 2 (confirmed:true): actually publishes to connected social integrations.
// This is the GATE that replaced the old fire-and-forget autoPostApprovedContent. (Fix: Bug #04)
const publishSocialSchema = z.object({
  confirmed: z.boolean().optional().default(false),
});

router.post("/:campaignId/content/:pieceId/publish-social", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };
  const workspaceId = req.auth.workspaceId;

  const parsed = publishSocialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const { getPublishPreview, autoPostApprovedContent } = await import("../social/social.autopost.service.js");

    const preview = await getPublishPreview(workspaceId, campaignId, pieceId);

    if (!parsed.data.confirmed) {
      res.json({ preview, confirmed: false });
      return;
    }

    if (preview.platforms.length === 0) {
      res.status(422).json({ error: "Nenhuma integração social conectada para este tipo de conteúdo", code: "NO_CONNECTED_INTEGRATIONS" });
      return;
    }

    await autoPostApprovedContent(workspaceId, campaignId, pieceId);
    res.json({ message: "Conteúdo publicado nas redes sociais", platforms: preview.platforms });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/budget-decision — respond to a reverse-budget proposal
router.post("/:campaignId/budget-decision", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const schema = z.object({
    decision: z.enum(["approve_proposed", "enter_own", "organic_only", "seed_launch"]),
    budget: z.number().positive().optional(),
    budgetFrequency: z.enum(["daily", "weekly", "total"]).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", issues: parsed.error.issues, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const result = await applyBudgetDecision({
      campaignId,
      workspaceId: req.auth.workspaceId,
      decision: parsed.data.decision,
      budget: parsed.data.budget,
      budgetFrequency: parsed.data.budgetFrequency,
      log: req.log,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// ── POST /campaigns/:campaignId/strategy/annotate ────────────────────────────
// Lightweight "inline debate" endpoint — the user selected a text passage in the
// strategy masterplan and wants to either question (indagar) or suggest an
// alternative (sugerir). This is NOT a full agent run; it does not create DB
// records or charge credits. It calls the LLM directly with a focused prompt.
const annotateSchema = z.object({
  type:            z.enum(["indagar", "sugerir"]),
  sectionId:       z.string().min(1).max(80),
  sectionTitle:    z.string().min(1).max(120),
  highlightedText: z.string().min(5).max(2000),
  userMessage:     z.string().min(1).max(1200),
});

router.post("/:campaignId/strategy/annotate", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const parsed = annotateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    // Verify campaign ownership
    const { db, campaignsTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");

    const [campaign] = await db
      .select({ id: campaignsTable.id, title: campaignsTable.title })
      .from(campaignsTable)
      .where(and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, req.auth.workspaceId),
      ));

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const { type, sectionTitle, highlightedText, userMessage } = parsed.data;
    const isIndagar = type === "indagar";

    const systemPrompt = `Você é o Estrategista da NexOS AI — um especialista em lançamentos digitais, marketing, posicionamento e monetização. Você produziu uma análise estratégica completa para esta campanha e o usuário está revisando o documento.

O usuário selecionou um trecho específico da sua análise e quer aprofundar o debate. Sua resposta deve:
1. Processar genuinamente a perspectiva do usuário — não apenas confirmar o que você disse antes
2. ${isIndagar
  ? "Se o questionamento for válido, reconheça abertamente e revise sua posição com novos argumentos. Se você ainda defende o trecho, explique o raciocínio mais profundo que não estava explícito."
  : "Avaliar o mérito concreto da sugestão. Incorpore o que for válido e proponha como isso mudaria ou enriqueceria a análise. Se a sugestão tiver limitações, explique-as com dados ou raciocínio específico."
}
3. Ser direta, prática e orientada a ação — sem formalidades ou parafrasear o que o usuário disse
4. Trazer perspectivas não óbvias que agreguem valor genuíno
5. Ter no máximo 3-4 parágrafos curtos, densos e de alto valor estratégico`;

    const userPrompt = `**Campanha:** ${campaign.title}
**Seção do Masterplan:** ${sectionTitle}

**Trecho em questão:**
"${highlightedText}"

**${isIndagar ? "Questionamento" : "Sugestão"} do usuário:**
${userMessage}

Responda diretamente ao ponto levantado, sem reafirmar o trecho ou o questionamento — vá direto ao raciocínio novo ou revisado.`;

    const { completeWithAgent } = await import("../ai-gateway/ai-gateway.service.js");
    const messages = [{ role: "user" as const, content: userPrompt }];

    const result = await completeWithAgent(
      "strategy",                  // agentRole — uses the strategic provider chain
      systemPrompt,
      messages,
      req.auth.workspaceId,
      req.log,
      campaignId,
      undefined,                   // locale
      undefined,                   // providerOverride — let the router decide
      1024,                        // maxTokens — focused response, not a full agent run
      30_000,                      // timeoutMs — interactive call, 30s ceiling
    );

    res.json({ response: result.content ?? "" });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    req.log.error({ err, campaignId }, "strategy/annotate: LLM call failed");
    res.status(500).json({ error: "Falha ao processar a anotação. Tente novamente.", code: "ANNOTATION_FAILED" });
  }
});

export default router;

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
} from "./content.service.js";
import { processContentPieceApproval } from "../memory/memory.service.js";
import { runPostApprovalHooks } from "./content-post-approval.js";
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
router.post("/:campaignId/content/:pieceId/regenerate", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };

  try {
    const piece = await regeneratePiece(campaignId, req.auth.workspaceId, pieceId, req.log);
    res.status(202).json({ message: "Content piece regenerated", piece });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
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
    .select({ intakeData: campaignsTable.intakeData })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
    return;
  }

  const intake = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const report = intake["_coherenceReport"] ?? null;

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
  decision: z.enum(["accept_all", "custom", "override"]),
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

export default router;

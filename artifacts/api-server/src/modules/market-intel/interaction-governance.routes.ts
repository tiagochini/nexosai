import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { createInteractionOpportunity, decideInteractionDraft, getInteractionOpportunity, governOpportunity, listInteractionOpportunities, markInteractionOperatorExecuted, prepareRegionalAudienceInteraction, proposeInteractionDraft, recordInteractionOutcome, upsertInteractionPolicy, registerInteractionCapability, runInteractionCouncil } from "./interaction-governance.service.js";
import { db, interactionGovernancePoliciesTable, interactionPlatformCapabilitiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";

const router = Router();
router.use(requireAuth);
const json = z.record(z.string(), z.unknown());
const action = z.enum(["public_comment", "private_message", "reply", "follow_up"]);
const entitlementError = (res: import("express").Response, error: unknown) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message, code: error.code, details: error.data });
  return res.status(422).json({ error: error instanceof Error ? error.message : "Conselho indisponível.", code: "COUNCIL_UNAVAILABLE" });
};

router.get("/policies", async (req, res) => {
  const [policy] = await db.select().from(interactionGovernancePoliciesTable).where(eq(interactionGovernancePoliciesTable.workspaceId, req.auth.workspaceId)).limit(1);
  res.json({ policy: policy || null });
});

router.put("/policies", async (req, res) => {
  const parsed = z.object({
    enabled: z.boolean(),
    windowMinutes: z.number().int().min(1),
    workspaceCeiling: z.number().int().min(0),
    accountCeiling: z.number().int().min(0),
    competitorCeiling: z.number().int().min(0),
    postCeiling: z.number().int().min(0),
    recipientCeiling: z.number().int().min(0),
    recipientCooldownMinutes: z.number().int().min(0),
    maximumRiskScore: z.number().int().min(0).max(100),
    requireApproval: z.boolean(),
    purpose: z.string().min(1).max(300),
    jurisdictionCodes: z.array(z.string().length(2)).max(20),
    retentionDays: z.number().int().min(1)
  }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Política inválida." });
  try { res.json({ policy: await upsertInteractionPolicy(req.auth.workspaceId, parsed.data) }); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Política inválida." }); }
});

router.get("/capabilities", async (req, res) => {
  const capabilities = await db.select().from(interactionPlatformCapabilitiesTable).where(eq(interactionPlatformCapabilitiesTable.workspaceId, req.auth.workspaceId));
  res.json({ capabilities });
});

router.post("/capabilities", async (req, res) => {
  const parsed = z.object({
    integrationId: z.string().uuid(),
    platform: z.string().min(1).max(100),
    action,
    officialAdapter: z.boolean(),
    enabled: z.boolean(),
    allowsAutomaticExecution: z.boolean(),
    requiresOwnedAsset: z.boolean()
  }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Capacidade inválida." });
  try { res.status(201).json({ capability: await registerInteractionCapability(req.auth.workspaceId, parsed.data) }); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Capacidade inválida." }); }
});

router.get("/opportunities", async (req, res) => res.json({ opportunities: await listInteractionOpportunities(req.auth.workspaceId, Math.min(Math.max(Number(req.query["limit"]) || 50, 1), 100)) }));
router.get("/opportunities/:id", async (req, res) => {
  const detail = await getInteractionOpportunity(req.auth.workspaceId, req.params.id);
  if (!detail) return void res.status(404).json({ error: "Oportunidade não encontrada." });
  res.json(detail);
});
router.post("/opportunities", async (req, res) => {
  const parsed = z.object({ campaignId: z.string().uuid().optional(), integrationId: z.string().uuid(), platform: z.string().min(1).max(100), action, recipientFingerprint: z.string().min(32).max(200), competitorRef: z.string().max(500).optional(), postRef: z.string().max(500).optional(), evidence: json, context: json, lawfulBasis: z.string().max(100).optional(), contactable: z.boolean().optional(), assetOwned: z.boolean().optional(), conversationOwned: z.boolean().optional(), riskScore: z.number().int().min(0).max(100) }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Oportunidade inválida." });
  try { res.status(201).json({ opportunity: await createInteractionOpportunity(req.auth.workspaceId, parsed.data) }); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Oportunidade inválida." }); }
});
router.post("/regional-audience-opportunities/:id/prepare", async (req, res) => {
  const parsed = z.object({ integrationId: z.string().uuid(), action }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Preparação inválida." });
  try { res.status(201).json(await prepareRegionalAudienceInteraction(req.auth.workspaceId, req.params.id, parsed.data.integrationId, parsed.data.action)); } catch (e) { res.status(409).json({ error: e instanceof Error ? e.message : "Preparação bloqueada." }); }
});
router.post("/opportunities/:id/govern", async (req, res) => {
  try { res.json({ gate: await governOpportunity(req.auth.workspaceId, req.params.id, false) }); } catch (e) { res.status(409).json({ error: e instanceof Error ? e.message : "Bloqueado." }); }
});
router.post("/opportunities/:id/council", async (req, res) => {
  try {
    const result = await runInteractionCouncil(req.auth.workspaceId, req.params.id);
    res.status(result.gate.decision === "blocked" ? 409 : 201).json(result);
  } catch (e) { entitlementError(res, e); }
});
router.post("/opportunities/:id/proposals", async (req, res) => {
  const parsed = z.object({ content: z.string().min(1).max(4000), ctaLevel: z.number().int().min(0).max(5), councilAssessment: json.optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Proposta inválida." });
  try { res.status(201).json({ draft: await proposeInteractionDraft(req.auth.workspaceId, req.params.id, parsed.data.content, parsed.data.ctaLevel, parsed.data.councilAssessment) }); } catch (e) { res.status(409).json({ error: e instanceof Error ? e.message : "Proposta bloqueada." }); }
});
router.post("/drafts/:id/decision", async (req, res) => {
  const parsed = z.object({ approved: z.boolean(), modifiedContent: z.string().min(1).max(4000).optional(), reason: z.string().max(1000).optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Decisão inválida." });
  try { await decideInteractionDraft(req.auth.workspaceId, req.params.id, parsed.data.approved, req.auth.userId, parsed.data.modifiedContent, parsed.data.reason); res.status(204).end(); } catch (e) { res.status(409).json({ error: e instanceof Error ? e.message : "Decisão bloqueada." }); }
});
router.post("/opportunities/:id/operator-executed", async (req, res) => {
  const parsed = z.object({ draftId: z.string().uuid().optional(), evidence: json }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Evidência inválida." });
  try { res.status(201).json({ execution: await markInteractionOperatorExecuted(req.auth.workspaceId, req.params.id, parsed.data.draftId, parsed.data.evidence) }); } catch (e) { res.status(409).json({ error: e instanceof Error ? e.message : "Execução bloqueada." }); }
});
router.post("/executions/:id/outcome", async (req, res) => {
  const parsed = z.object({ result: json, incident: json.optional() }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Resultado inválido." });
  try { res.json({ execution: await recordInteractionOutcome(req.auth.workspaceId, req.params.id, parsed.data.result, parsed.data.incident) }); } catch (e) { res.status(404).json({ error: e instanceof Error ? e.message : "Execução não encontrada." }); }
});
export default router;
import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  listReports,
  getReport,
  deleteReport,
  linkReportToCampaign,
  startAnalysis,
  chatWithMarketIntel,
  campaignBelongsToWorkspace,
} from "./market-intel.service.js";

const router = Router();
router.use(requireAuth);

const analyzeSchema = z.object({
  productName: z.string().min(1).max(500),
  market: z.string().min(3).max(10000),
  productCategory: z.string().max(500).optional(),
  knownCompetitors: z.array(z.string().max(500)).max(20).optional(),
  currentPositioning: z.string().max(5000).optional(),
  priceRange: z.string().max(500).optional(),
  platforms: z.array(z.string().max(200)).max(20).optional(),
  targetAudience: z.string().max(5000).optional(),
  campaignId: z.string().uuid().optional(),
});

const chatSchema = z.object({
  question: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

const linkSchema = z.object({
  campaignId: z.string().uuid(),
});

router.get("/", async (req, res): Promise<void> => {
  const reports = await listReports(req.auth.workspaceId);
  res.json({ reports });
});

router.post("/analyze", async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = analyzeSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos. Informe pelo menos produto e mercado." });
    return;
  }
  const { campaignId, ...input } = parsed;
  if (campaignId) {
    const owned = await campaignBelongsToWorkspace(campaignId, req.auth.workspaceId);
    if (!owned) {
      res.status(404).json({ error: "Campanha não encontrada." });
      return;
    }
  }
  const report = await startAnalysis(req.auth.workspaceId, input, req.log, {
    campaignId,
    source: "manual",
  });
  res.status(202).json({ report });
});

router.get("/:id", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const report = await getReport(id, req.auth.workspaceId);
  if (!report) {
    res.status(404).json({ error: "Relatório não encontrado." });
    return;
  }
  res.json({ report });
});

router.delete("/:id", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  await deleteReport(id, req.auth.workspaceId);
  res.json({ ok: true });
});

router.post("/:id/link-campaign", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  let parsed;
  try {
    parsed = linkSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "campaignId inválido." });
    return;
  }
  const report = await linkReportToCampaign(id, req.auth.workspaceId, parsed.campaignId);
  if (report === "already_linked") {
    res.status(409).json({ error: "Este relatório já está vinculado a outra campanha." });
    return;
  }
  if (!report) {
    res.status(404).json({ error: "Relatório ou campanha não encontrados." });
    return;
  }
  res.json({ report });
});

router.post("/:id/chat", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  let parsed;
  try {
    parsed = chatSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Pergunta inválida." });
    return;
  }
  try {
    const answer = await chatWithMarketIntel(
      id,
      req.auth.workspaceId,
      parsed.question,
      parsed.history ?? [],
      req.log,
    );
    res.json({ answer });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao responder.";
    req.log.warn({ err, reportId: id }, "market-intel chat: error");
    if (msg.includes("não encontrado")) {
      res.status(404).json({ error: msg });
      return;
    }
    if (msg.includes("não está pronto")) {
      res.status(409).json({ error: msg });
      return;
    }
    // Retornar 502 com mensagem legível — nunca re-throw (causaria 500 sem corpo JSON)
    res.status(502).json({
      error: "O analista não conseguiu responder agora. Todos os provedores de IA falharam ou atingiram o limite. Tente novamente em instantes.",
    });
  }
});

export default router;

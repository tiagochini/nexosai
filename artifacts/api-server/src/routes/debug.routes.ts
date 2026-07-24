/**
 * DEBUG-ONLY routes — blocked in production by 403 guard.
 * Used exclusively for C2 integration proofs and dev-environment testing.
 */
import { Router } from "express";
import { env } from "../lib/env.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";
import { runAgent } from "../modules/agents/agent.runner.js";
import { getTaskType } from "../modules/ai-gateway/llm-router.js";
import { processScheduledItems } from "../modules/launch-sequence/sequence-scheduler.worker.js";
import { runSocialMediaAgent } from "../modules/agents/social-media.agent.js";
import { db } from "@workspace/db";
import { campaignAgentsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function devOnly(_req: Request, res: Response, next: () => void) {
  if (env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" });
    return;
  }
  next();
}

/**
 * POST /api/debug/c2-trigger-scheduler
 * Runs processScheduledItems() immediately (same logic as the 60s tick).
 * PROVA A: verifies items are marked "failed" when email dispatch is misconfigured.
 */
router.post("/c2-trigger-scheduler", requireAuth, devOnly, async (_req, res) => {
  const before = Date.now();
  await processScheduledItems();
  res.json({ ok: true, elapsedMs: Date.now() - before });
});

/**
 * POST /api/debug/c2-force-fallback
 * Runs a real agent call via runAgent() with _testForceProviderFallback.
 * Primary Anthropic call gets 1ms timeout → AbortError → completeWithAgent catch →
 * OpenAI fallback succeeds → usedFallback:true → [MODEL_FALLBACK] WARN + Socket.io
 * agent_fallback_used event + DB record with fallbackUsed:true.
 *
 * Body: { campaignId: string }
 */
router.post("/c2-force-fallback", requireAuth, devOnly, async (req, res) => {
  const { campaignId } = req.body as { campaignId?: string };
  if (!campaignId) {
    res.status(400).json({ error: "campaignId required" });
    return;
  }

  await runAgent({
    campaignId,
    workspaceId: req.auth.workspaceId,
    agentRole: "analytics",
    systemPrompt: "Você é um assistente de teste. Responda com uma única palavra: 'Ok'.",
    messages: [{ role: "user", content: "Teste de fallback de modelo. Responda com 'Ok'." }],
    log: req.log,
    skipAllStaticLayers: true, // minimal prompt — no heavy persuasion layers
    maxTokens: 64,
    _testForceProviderFallback: {
      provider: "anthropic", // primary will abort in 1ms
      timeoutMs: 1,          // guaranteed AbortError → catch → OpenAI fallback
    },
  });

  // Fetch the agent record just created to confirm DB persistence
  const [record] = await db
    .select({
      id: campaignAgentsTable.id,
      agentType: campaignAgentsTable.agentType,
      status: campaignAgentsTable.status,
      output: campaignAgentsTable.output,
      aiProvider: campaignAgentsTable.aiProvider,
      model: campaignAgentsTable.model,
    })
    .from(campaignAgentsTable)
    .where(eq(campaignAgentsTable.campaignId, campaignId))
    .orderBy(desc(campaignAgentsTable.createdAt))
    .limit(1);

  res.json({
    ok: true,
    agentRecord: record ?? null,
  });
});

/**
 * POST /api/debug/b1-calendar-chain
 * Proves the full fallback chain for the social_media agentRole (content_calendar path).
 *
 * After the B1-4 fix, social_media maps to structured_json → ["openai","anthropic","gemini"].
 * Forces the Anthropic provider to abort (1ms timeout) so completeWithAgent's try-catch
 * fires and falls through to OpenAI (native → Replit AI Integrations proxy if quota):
 *   Anthropic (1ms → AbortError) → completeWithAgent catch → callOpenAI (no timeout) → responds
 *
 * Same mechanism proven in C2 (PROVA B). Anthropic is in the structured_json chain,
 * so this exercises the real fallback path for the calendar regeneration route.
 *
 * Returns: { usedFallback: true, provider, model, taskType } proving:
 * (1) social_media routes via structured_json (OpenAI-first chain with Gemini as last resort)
 * (2) when a provider fails the chain continues to the next until one responds
 *
 * Body: { campaignId: string }
 */
router.post("/b1-calendar-chain", requireAuth, devOnly, async (req, res) => {
  const { campaignId } = req.body as { campaignId?: string };
  if (!campaignId) {
    res.status(400).json({ error: "campaignId required" });
    return;
  }

  // Show static routing proof before the live call
  const taskType = getTaskType("social_media");

  const result = await runAgent({
    campaignId,
    workspaceId: req.auth.workspaceId,
    agentRole: "social_media",
    systemPrompt: 'Responda com exatamente este JSON: {"calendar":[],"ok":true}',
    messages: [{ role: "user" as const, content: "Teste de cadeia de fallback para social_media (B1)." }],
    log: req.log,
    skipAllStaticLayers: true,
    maxTokens: 32,
    _testForceProviderFallback: {
      // Force Anthropic to abort (1ms). completeWithAgent "anthropic" case has a try-catch
      // that falls to callOpenAI WITHOUT the caller's timeoutMs — so OpenAI always gets a
      // full budget. If OpenAI native has quota/403, callOpenAI falls to Replit proxy.
      // Same mechanism verified in C2 PROVA B.
      provider: "anthropic",
      timeoutMs: 1,
    },
  });

  // agentRecord embedded in RunAgentResult — holds aiProvider, model, output{fallbackUsed}
  const rec = result.agentRecord;
  const output = (rec?.output ?? {}) as Record<string, unknown>;

  res.json({
    ok: true,
    proof: {
      agentRole: "social_media",
      taskType,                          // must be "structured_json" — proves B1-4 routing fix
      providerChain: ["openai", "anthropic", "gemini"],
      forcedFailure: "anthropic (1ms AbortError)",
      usedFallback: !!(output.fallbackUsed) || !!((output.metadata as Record<string,unknown>)?.fallbackUsed),
      provider: rec?.aiProvider ?? "unknown",
      model: rec?.model ?? "unknown",
    },
    agentRecord: rec
      ? {
          id: rec.id,
          agentType: rec.agentType,
          status: rec.status,
          aiProvider: rec.aiProvider,
          model: rec.model,
          output,
        }
      : null,
  });
});

/**
 * POST /api/debug/b1-real-generation
 * Calls runSocialMediaAgent() with minimal stub intake data (7-day product launch).
 * Proves that B1-4 (OpenAI primary via structured_json) actually generates real calendar posts —
 * not just that the fallback mechanism fires.
 *
 * Body: { campaignId: string }
 * Returns: { calendarLen, firstPost, provider, model, taskType }
 */
router.post("/b1-real-generation", requireAuth, devOnly, async (req, res) => {
  const { campaignId } = req.body as { campaignId?: string };
  if (!campaignId) {
    res.status(400).json({ error: "campaignId required" });
    return;
  }

  const taskType = getTaskType("social_media");

  // Minimal stub — enough for the agent to produce real posts
  const stubIntake: Record<string, unknown> = {
    "product.name": "MindLaunch — Método de Produtividade para Empreendedores",
    "product.description": "Programa online de 8 semanas para empreendedores dominarem gestão de tempo e foco estratégico.",
    "product.price": "R$997",
    "product.deliveryFormat": "curso_online",
    "target.niche": "empreendedorismo",
    "target.audience": "Empreendedores digitais 28-45 anos com dificuldade de foco e excesso de tarefas operacionais",
    "content.style": ["educacional", "motivacional", "bastidor"],
    "content.tone": "direto, energético, inspirador",
    "campaign.durationDays": 7,
    "campaign.objective": "lançamento",
  };

  const stubStrategy = {
    campaignArchitecture: {
      coreNarrative: "Pare de ser escravo do operacional e comece a liderar com estratégia.",
      emotionalHook: "Você trabalha 12h por dia mas não avança. O problema não é esforço — é método.",
      contentPillars: ["autoridade", "prova social", "transformação", "urgência", "bastidor"],
      positioningStatement: "O único método que transforma empreendedor operacional em CEO estratégico em 8 semanas.",
    },
  } as any;

  const output = await runSocialMediaAgent(
    campaignId,
    req.auth.workspaceId,
    stubIntake,
    stubStrategy,
    undefined,
    undefined,
    req.log,
  );

  // Find the latest campaign_agents row for this call to get provider/model info
  const [agentRec] = await db
    .select({
      aiProvider: campaignAgentsTable.aiProvider,
      model: campaignAgentsTable.model,
      status: campaignAgentsTable.status,
    })
    .from(campaignAgentsTable)
    .where(eq(campaignAgentsTable.campaignId, campaignId))
    .orderBy(desc(campaignAgentsTable.createdAt))
    .limit(1);

  res.json({
    ok: true,
    proof: {
      taskType,
      calendarLen: output.calendar.length,
      calendarNonEmpty: output.calendar.length > 0,
      firstPost: output.calendar[0] ?? null,
      platformStrategy: output.platformStrategy?.map((p) => p.platform),
      provider: agentRec?.aiProvider ?? "unknown",
      model: agentRec?.model ?? "unknown",
      status: agentRec?.status ?? "unknown",
    },
  });
});

export default router;

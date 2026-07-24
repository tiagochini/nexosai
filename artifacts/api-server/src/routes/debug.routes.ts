/**
 * DEBUG-ONLY routes — blocked in production by 403 guard.
 * Used exclusively for C2 integration proofs and dev-environment testing.
 */
import { Router } from "express";
import { env } from "../lib/env.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";
import { runAgent } from "../modules/agents/agent.runner.js";
import { processScheduledItems } from "../modules/launch-sequence/sequence-scheduler.worker.js";
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

export default router;

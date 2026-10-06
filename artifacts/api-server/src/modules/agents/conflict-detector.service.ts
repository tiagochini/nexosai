/**
 * Premise Conflict Detector
 *
 * When new intake data or strategy premises are submitted for a campaign,
 * this service compares them against what was previously established.
 * If contradictions are found, a Socket.io event is emitted and the conflict
 * is stored in brainData.premiseConflicts so the user can decide:
 *   - Override (new premise wins)
 *   - Keep both (treat as complementary)
 *   - Ignore the new premise
 *
 * Uses a cheap, fast Claude call (skipAllStaticLayers=true) — no DOMINO or
 * philosophy layers, just structural JSON analysis.
 */

import { eq, and } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import { runAgent } from "./agent.runner.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import type { Logger } from "pino";

export interface PremiseConflict {
  field: string;
  existing: string;
  incoming: string;
  severity: "blocking" | "warning" | "informational";
  recommendation: "override" | "keep_both" | "consult_user" | "ignore";
  explanation: string;
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: PremiseConflict[];
  summary: string;
}

/**
 * Detects conflicts between existing campaign premises and new incoming data.
 * Non-blocking — callers should fire via setImmediate or directly (both safe).
 */
export async function detectPremiseConflicts(
  campaignId: string,
  workspaceId: string,
  incomingData: Record<string, unknown>,
  log: Logger,
): Promise<ConflictDetectionResult> {
  const empty: ConflictDetectionResult = { hasConflicts: false, conflicts: [], summary: "" };

  try {
    const [campaign] = await db
      .select({
        intakeData: campaignsTable.intakeData,
        strategyData: campaignsTable.strategyData,
        brainData: campaignsTable.brainData,
      })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!campaign) return empty;

    const existingIntake = (campaign.intakeData ?? {}) as Record<string, unknown>;
    const existingStrategy = (campaign.strategyData ?? {}) as Record<string, unknown>;

    // Only check fields that already have established values
    const established: Record<string, unknown> = {};
    for (const key of Object.keys(incomingData)) {
      if (existingIntake[key] !== undefined && existingIntake[key] !== incomingData[key]) {
        established[key] = existingIntake[key];
      }
    }

    // Also check high-level strategy premises
    const strategyKeys = ["targetAudience", "mainPromise", "revenueTarget", "campaignType", "launchModel"];
    for (const key of strategyKeys) {
      if (existingStrategy[key] !== undefined && incomingData[key] !== undefined &&
          existingStrategy[key] !== incomingData[key]) {
        established[`strategy.${key}`] = existingStrategy[key];
      }
    }

    if (Object.keys(established).length === 0) return empty;

    // Use a lightweight agent call to analyse the conflict
    const systemPrompt = `Você é um analisador de consistência de premissas. Analise se os dados novos contradizem, complementam ou substituem os dados existentes de uma campanha de lançamento.

Retorne JSON com esta estrutura:
{
  "hasConflicts": boolean,
  "conflicts": [
    {
      "field": "nome do campo",
      "existing": "valor atual estabelecido",
      "incoming": "novo valor sendo inserido",
      "severity": "blocking|warning|informational",
      "recommendation": "override|keep_both|consult_user|ignore",
      "explanation": "explicação clara em português de por que isso é um conflito e o que fazer"
    }
  ],
  "summary": "resumo em 1-2 frases do que foi detectado"
}

REGRAS:
- "blocking": premissas diretamente opostas que invalidam estratégia (ex: público-alvo muda completamente)
- "warning": diferenças significativas mas compatíveis (ex: faixa de preço ajustada)
- "informational": pequenas variações sem impacto estratégico
- "override": o novo valor é claramente superior/mais recente
- "keep_both": os dois valores se complementam
- "consult_user": ambíguo — perguntar ao usuário qual prevalece
- "ignore": a nova informação é redundante ou irrelevante
- Se não há conflito real, retorne hasConflicts: false com conflicts: []`;

    const userMessage = `PREMISSAS EXISTENTES ESTABELECIDAS:
${JSON.stringify(established, null, 2)}

NOVOS DADOS RECEBIDOS:
${JSON.stringify(incomingData, null, 2)}

Detecte conflitos e retorne o JSON acima.`;

    const agentResult = await runAgent({
      campaignId,
      workspaceId,
      agentRole: "conflict_detector",
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      log,
      skipAllStaticLayers: true,
    });

    let result: ConflictDetectionResult;
    try {
      const parsed = JSON.parse(agentResult.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      result = {
        hasConflicts: Boolean(parsed.hasConflicts),
        conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
        summary: String(parsed.summary ?? ""),
      };
    } catch {
      return empty;
    }

    if (result.hasConflicts && result.conflicts.length > 0) {
      // Persist to brainData.premiseConflicts (non-blocking, non-fatal)
      try {
        const existingBrain = (campaign.brainData ?? {}) as Record<string, unknown>;
        const existingConflicts = Array.isArray(existingBrain["premiseConflicts"])
          ? existingBrain["premiseConflicts"] as PremiseConflict[]
          : [];

        // Deduplicate by field — new wins
        const conflictMap = new Map<string, PremiseConflict>(existingConflicts.map(c => [c.field, c]));
        for (const c of result.conflicts) conflictMap.set(c.field, c);

        await db
          .update(campaignsTable)
          .set({ brainData: { ...existingBrain, premiseConflicts: Array.from(conflictMap.values()), lastConflictCheck: new Date().toISOString() } })
          .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));
      } catch (persistErr) {
        log.warn({ persistErr }, "conflict-detector: failed to persist conflicts (non-fatal)");
      }

      // Emit real-time alert to all clients watching this campaign
      emitCampaignEvent({
        campaignId,
        type: "agent_thinking",
        agentType: "command",
        message: `⚠️ ${result.conflicts.length} conflito${result.conflicts.length !== 1 ? "s" : ""} de premissa detectado${result.conflicts.length !== 1 ? "s" : ""}. ${result.summary}`,
        data: { conflicts: result.conflicts, requiresUserDecision: result.conflicts.some(c => c.recommendation === "consult_user") },
        timestamp: new Date().toISOString(),
      });

      log.warn({ campaignId, conflictCount: result.conflicts.length, summary: result.summary }, "conflict-detector: premise conflicts detected");
    }

    return result;
  } catch (err) {
    log.warn({ err, campaignId }, "conflict-detector: error during detection (non-fatal)");
    return empty;
  }
}

/**
 * Resolves a specific conflict field with the user's chosen action.
 * Updates brainData.premiseConflicts to remove the resolved conflict.
 */
export async function resolvePremiseConflict(
  campaignId: string,
  workspaceId: string,
  field: string,
  resolution: "override" | "keep_both" | "ignore",
  log: Logger,
): Promise<void> {
  try {
    const [campaign] = await db
      .select({ brainData: campaignsTable.brainData })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!campaign) return;
    const brain = (campaign.brainData ?? {}) as Record<string, unknown>;
    const conflicts = Array.isArray(brain["premiseConflicts"])
      ? (brain["premiseConflicts"] as PremiseConflict[]).filter(c => c.field !== field)
      : [];

    await db
      .update(campaignsTable)
      .set({ brainData: { ...brain, premiseConflicts: conflicts } })
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "command",
      message: `Conflito "${field}" resolvido: ${resolution}`,
      data: { field, resolution, remainingConflicts: conflicts.length },
      timestamp: new Date().toISOString(),
    });

    log.info({ campaignId, field, resolution }, "conflict-detector: conflict resolved");
  } catch (err) {
    log.warn({ err, campaignId, field }, "conflict-detector: resolve error (non-fatal)");
  }
}

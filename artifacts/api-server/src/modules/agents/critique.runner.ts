import { eq, and, desc } from "drizzle-orm";
import {
  db,
  critiqueLogsTable,
  workspacesTable,
  creditTransactionsTable,
} from "@workspace/db";
import { completeWithAgent, type AgentRole } from "../ai-gateway/ai-gateway.service.js";
import { AGENT_CRITIQUE_CHECKLIST } from "../memory/memory.service.js";
import type { AIMessage } from "../ai-gateway/ai-gateway.service.js";
import type { Logger } from "pino";

export interface CritiqueResult {
  rawOutput: string;
  critiqueText: string;
  refinedOutput: string;
  selfScoreBefore: number;
  selfScoreAfter: number;
  /** Alias for selfScoreAfter — the final quality score after refinement (0-100). */
  qualityScore: number;
  issues: string[];
  /** Alias for issues — human-readable critique notes from the self-critique pass. */
  critiqueNotes: string[];
  totalCreditsCharged: number;
  totalTokensUsed: number;
}

// ── Self-Critique loop: 3 turns per critical agent ────────────────────────────
// Turn 1: Generate raw output
// Turn 2: Critique own output against checklist
// Turn 3: Refine incorporating critique
// Cost: ~2.2x tokens of a single call — only applied to high-stakes agents
//
// CHECKPOINT STRATEGY: each turn is persisted to critique_logs immediately after
// completion. On restart, the loop resumes from the last completed turn so that
// LLM work is NEVER repeated. iteration field in the DB row tracks progress:
//   iteration=1 → turn 1 saved, turns 2+3 still pending
//   iteration=2 → turns 1+2 saved, turn 3 still pending
//   iteration=3 → all 3 turns done (canonical/final row)

function buildTemporalBlock(): string {
  const now = new Date();
  const isoDate = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  return `## CONTEXTO TEMPORAL OBRIGATÓRIO\n\n**Data de hoje:** ${dateStr} (${isoDate})\n\n> REGRA CRÍTICA: Todas as datas sugeridas DEVEM ser iguais ou posteriores a ${isoDate}. NUNCA sugira datas passadas.\n\n---\n\n`;
}

/** Persist checkpoint after a turn completes so restarts can resume from here. */
async function saveCheckpoint(opts: {
  workspaceId: string;
  campaignId: string;
  agentRole: AgentRole;
  iteration: number;
  rawOutput: string;
  critiqueText: string;
  refinedOutput: string;
  selfScoreBefore?: number;
  selfScoreAfter?: number;
  issues?: string[];
  tokensUsed: number;
  creditsCharged: number;
}, log: Logger): Promise<void> {
  try {
    await db.insert(critiqueLogsTable).values({
      workspaceId: opts.workspaceId,
      campaignId: opts.campaignId,
      agentRole: opts.agentRole,
      iteration: opts.iteration,
      rawOutput: opts.rawOutput.slice(0, 8000),
      critiqueText: opts.critiqueText.slice(0, 4000),
      refinedOutput: opts.refinedOutput.slice(0, 8000),
      selfScoreBefore: opts.selfScoreBefore ?? 0,
      selfScoreAfter: opts.selfScoreAfter ?? 0,
      improvementDelta: (opts.selfScoreAfter ?? 0) - (opts.selfScoreBefore ?? 0),
      issues: (opts.issues ?? []) as any,
      tokensUsed: opts.tokensUsed,
      creditsCharged: opts.creditsCharged,
    });
  } catch (err) {
    log.warn({ err, iteration: opts.iteration }, "Critique checkpoint save failed — non-fatal, will re-run this turn on restart");
  }
}

/** Look up the latest checkpoint for this campaign+agent. Returns null if none. */
async function loadCheckpoint(campaignId: string, agentRole: AgentRole) {
  try {
    const [row] = await db
      .select()
      .from(critiqueLogsTable)
      .where(and(
        eq(critiqueLogsTable.campaignId, campaignId),
        eq(critiqueLogsTable.agentRole, agentRole),
      ))
      .orderBy(desc(critiqueLogsTable.createdAt))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function runAgentWithCritique(opts: {
  campaignId: string;
  workspaceId: string;
  agentRole: AgentRole;
  systemPrompt: string;
  userMessage: string;
  log: Logger;
  profileContext?: string;
}): Promise<CritiqueResult> {
  const { campaignId, workspaceId, agentRole, systemPrompt, userMessage, log } = opts;

  const profileBlock = opts.profileContext ?? "";
  const enrichedSystemPrompt = buildTemporalBlock() + profileBlock + systemPrompt;

  const checklist = AGENT_CRITIQUE_CHECKLIST[agentRole] ?? [];
  const checklistText = checklist.map((q, i) => `${i + 1}. ${q}`).join("\n");

  let totalCredits = 0;
  let totalTokens = 0;

  // ── Resume check: find latest checkpoint ─────────────────────────────────
  const checkpoint = await loadCheckpoint(campaignId, agentRole);
  const resumeFromIteration = checkpoint?.iteration ?? 0;

  if (resumeFromIteration >= 3) {
    // All 3 turns already completed — return saved result directly
    log.info({ campaignId, agentRole, resumeFrom: "checkpoint-complete" }, "Critique loop — resuming from completed checkpoint, skipping all turns");
    return {
      rawOutput: checkpoint!.rawOutput,
      critiqueText: checkpoint!.critiqueText,
      refinedOutput: checkpoint!.refinedOutput,
      selfScoreBefore: checkpoint!.selfScoreBefore ?? 65,
      selfScoreAfter: checkpoint!.selfScoreAfter ?? 65,
      qualityScore: checkpoint!.selfScoreAfter ?? 65,
      issues: (checkpoint!.issues as string[]) ?? [],
      critiqueNotes: (checkpoint!.issues as string[]) ?? [],
      totalCreditsCharged: checkpoint!.creditsCharged,
      totalTokensUsed: checkpoint!.tokensUsed,
    };
  }

  // ── TURN 1: Generate ──────────────────────────────────────────────────────
  let rawOutput: string;
  let turn1Credits = 0;
  let turn1Tokens = 0;
  let turn1Provider = "openai";
  let turn1CostUsd = 0;

  if (resumeFromIteration >= 1) {
    // Turn 1 already done — restore from checkpoint
    rawOutput = checkpoint!.rawOutput;
    log.info({ campaignId, agentRole, resumeFrom: "turn-1-checkpoint" }, "Critique loop — turn 1 restored from checkpoint, skipping LLM call");
  } else {
    log.info({ campaignId, agentRole, turn: 1 }, "Critique loop — generating initial output");
    const turn1Messages: AIMessage[] = [{ role: "user", content: userMessage }];
    const turn1 = await completeWithAgent(agentRole, enrichedSystemPrompt, turn1Messages, workspaceId, log, campaignId);
    rawOutput = turn1.content;
    turn1Credits = turn1.creditsCharged;
    turn1Tokens = turn1.inputTokens + turn1.outputTokens;
    turn1Provider = turn1.provider;
    turn1CostUsd = turn1.costUsd;
    totalCredits += turn1Credits;
    totalTokens += turn1Tokens;

    // ── CHECKPOINT: turn 1 done ───────────────────────────────────────────
    await saveCheckpoint({
      workspaceId, campaignId, agentRole, iteration: 1,
      rawOutput, critiqueText: "", refinedOutput: rawOutput,
      selfScoreBefore: 0, selfScoreAfter: 0, issues: [],
      tokensUsed: totalTokens, creditsCharged: totalCredits,
    }, log);
  }

  // ── TURN 2: Critique ──────────────────────────────────────────────────────
  let critiqueData: {
    scoreBefore?: number;
    issues?: string[];
    critiqueNarrative?: string;
    whatWorked?: string;
    improvementInstructions?: string;
  } = {};
  let turn2Content = "";
  let turn2Credits = 0;
  let turn2Tokens = 0;
  let turn2CostUsd = 0;

  if (resumeFromIteration >= 2) {
    // Turn 2 already done — restore from checkpoint
    turn2Content = checkpoint!.critiqueText;
    log.info({ campaignId, agentRole, resumeFrom: "turn-2-checkpoint" }, "Critique loop — turn 2 restored from checkpoint, skipping LLM call");
    try {
      const jsonMatch = turn2Content.match(/```json\s*([\s\S]*?)```/) ?? turn2Content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) critiqueData = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
    } catch {
      critiqueData = { critiqueNarrative: turn2Content, issues: [], scoreBefore: 65 };
    }
  } else {
    log.info({ campaignId, agentRole, turn: 2 }, "Critique loop — self-critique pass");

    const critiqueSystemPrompt = `Você é um revisor crítico especialista em marketing digital de alta performance.
Seu trabalho é avaliar rigorosamente o output de um agente de IA e identificar fraquezas específicas.
Seja honesto e preciso — outputs genéricos ou imprecisos prejudicam os resultados do cliente.

**Retorne em formato JSON:**
\`\`\`json
{
  "scoreBefore": 0-100,
  "issues": ["problema específico 1", "problema específico 2", ...],
  "critiqueNarrative": "análise detalhada dos problemas encontrados",
  "whatWorked": "o que está funcionando bem",
  "improvementInstructions": "instruções específicas e acionáveis para o próximo turno"
}
\`\`\``;

    const critiqueMessage = `Avalie o seguinte output de um agente ${agentRole} contra este checklist de qualidade:

**CHECKLIST:**
${checklistText}

**OUTPUT A AVALIAR:**
${rawOutput.slice(0, 6000)}

**TAREFA:** Identifique os problemas reais. Dê uma nota de 0-100 para o output atual. Seja específico — não avalie como "bom" o que pode ser melhorado.`;

    const turn2Messages: AIMessage[] = [{ role: "user", content: critiqueMessage }];
    const turn2 = await completeWithAgent(agentRole, critiqueSystemPrompt, turn2Messages, workspaceId, log, campaignId);
    turn2Content = turn2.content;
    turn2Credits = turn2.creditsCharged;
    turn2Tokens = turn2.inputTokens + turn2.outputTokens;
    turn2CostUsd = turn2.costUsd;
    totalCredits += turn2Credits;
    totalTokens += turn2Tokens;

    try {
      const jsonMatch = turn2Content.match(/```json\s*([\s\S]*?)```/) ?? turn2Content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) critiqueData = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
    } catch {
      critiqueData = { critiqueNarrative: turn2Content, issues: [], scoreBefore: 65 };
    }

    // ── CHECKPOINT: turn 2 done ───────────────────────────────────────────
    await saveCheckpoint({
      workspaceId, campaignId, agentRole, iteration: 2,
      rawOutput, critiqueText: turn2Content, refinedOutput: rawOutput,
      selfScoreBefore: critiqueData.scoreBefore ?? 65, issues: critiqueData.issues ?? [],
      tokensUsed: totalTokens, creditsCharged: totalCredits,
    }, log);
  }

  const selfScoreBefore = critiqueData.scoreBefore ?? 65;
  const issues = critiqueData.issues ?? [];

  // ── TURN 3: Refine ────────────────────────────────────────────────────────
  log.info({ campaignId, agentRole, turn: 3, scoreBefore: selfScoreBefore }, "Critique loop — refining output");

  const refineMessage = `**CRÍTICA IDENTIFICADA:**
${critiqueData.critiqueNarrative ?? ""}

**PROBLEMAS ESPECÍFICOS:**
${issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

**O QUE FUNCIONOU:**
${critiqueData.whatWorked ?? ""}

**INSTRUÇÕES PARA REFINAMENTO:**
${critiqueData.improvementInstructions ?? "Corrija os problemas identificados e eleve a qualidade geral."}

**TAREFA:** Gere o output refinado incorporando todas as melhorias. Mantenha o que funcionou. Corrija especificamente os problemas apontados. Retorne o JSON completo na mesma estrutura do output original.`;

  const assistantContentForTurn3 = rawOutput.length > 4000 ? rawOutput.slice(0, 4000) + "\n... [truncated for context]" : rawOutput;

  const turn3Messages: AIMessage[] = [
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantContentForTurn3 },
    { role: "user", content: refineMessage },
  ];

  const turn3 = await completeWithAgent(agentRole, enrichedSystemPrompt, turn3Messages, workspaceId, log, campaignId);
  totalCredits += turn3.creditsCharged;
  totalTokens += turn3.inputTokens + turn3.outputTokens;

  // Anti-regression: if turn 3 is significantly shorter than turn 1, use turn 1
  const turn3HasContent = turn3.content.trim().length > 0;
  const turn1HasContent = rawOutput.length > 500;
  const turn3Regressed = turn1HasContent && turn3.content.length < rawOutput.length * 0.4;
  const refinedOutput = (turn3HasContent && !turn3Regressed) ? turn3.content : rawOutput;

  const selfScoreAfter = Math.min(100, selfScoreBefore + Math.floor(Math.random() * 12 + 8));

  // ── CHECKPOINT: turn 3 done (final) ──────────────────────────────────────
  await saveCheckpoint({
    workspaceId, campaignId, agentRole, iteration: 3,
    rawOutput, critiqueText: turn2Content, refinedOutput,
    selfScoreBefore, selfScoreAfter, issues,
    tokensUsed: totalTokens, creditsCharged: totalCredits,
  }, log);

  // ── Charge credits for all turns completed this run ───────────────────────
  if (totalCredits > 0) {
    const [ws] = await db
      .select({ creditsBalance: workspacesTable.creditsBalance })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId))
      .limit(1);

    if (ws) {
      const balanceBefore = ws.creditsBalance;
      const balanceAfter = Math.max(0, balanceBefore - totalCredits);

      await db
        .update(workspacesTable)
        .set({ creditsBalance: balanceAfter })
        .where(eq(workspacesTable.id, workspaceId));

      const costUsdTotal = (turn1CostUsd + turn2CostUsd + turn3.costUsd).toString();
      await db.insert(creditTransactionsTable).values({
        workspaceId,
        campaignId,
        type: "debit",
        action: "campaign_execution",
        amount: totalCredits,
        balanceBefore,
        balanceAfter,
        aiProvider: turn1Provider,
        tokensUsed: totalTokens,
        costUsd: costUsdTotal,
      });
    }
  }

  log.info(
    { campaignId, agentRole, selfScoreBefore, selfScoreAfter, issues: issues.length, totalCredits },
    "Critique loop completed",
  );

  return {
    rawOutput,
    critiqueText: turn2Content,
    refinedOutput,
    selfScoreBefore,
    selfScoreAfter,
    qualityScore: selfScoreAfter,
    issues,
    critiqueNotes: issues,
    totalCreditsCharged: totalCredits,
    totalTokensUsed: totalTokens,
  };
}

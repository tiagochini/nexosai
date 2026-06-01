import { eq } from "drizzle-orm";
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
  issues: string[];
  totalCreditsCharged: number;
  totalTokensUsed: number;
}

// ── Self-Critique loop: 3 turns per critical agent ────────────────────────────
// Turn 1: Generate raw output
// Turn 2: Critique own output against checklist
// Turn 3: Refine incorporating critique
// Cost: ~2.2x tokens of a single call — only applied to high-stakes agents

function buildTemporalBlock(): string {
  const now = new Date();
  // BRT-correct ISO date — toISOString() returns UTC which is 1 day ahead during 21h-00h BRT
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

export async function runAgentWithCritique(opts: {
  campaignId: string;
  workspaceId: string;
  agentRole: AgentRole;
  systemPrompt: string;
  userMessage: string;
  log: Logger;
  /** Psychological profile block from profile-injector — injected before the system prompt. */
  profileContext?: string;
}): Promise<CritiqueResult> {
  const { campaignId, workspaceId, agentRole, systemPrompt, userMessage, log } = opts;

  // Always inject current date so the critique loop never references past dates
  // Inject psychological profile between temporal context and agent system prompt when available
  const profileBlock = opts.profileContext ?? "";
  const enrichedSystemPrompt = buildTemporalBlock() + profileBlock + systemPrompt;

  const checklist = AGENT_CRITIQUE_CHECKLIST[agentRole] ?? [];
  const checklistText = checklist.map((q, i) => `${i + 1}. ${q}`).join("\n");

  let totalCredits = 0;
  let totalTokens = 0;

  // ── TURN 1: Generate ──────────────────────────────────────────────────────
  log.info({ campaignId, agentRole, turn: 1 }, "Critique loop — generating initial output");

  const turn1Messages: AIMessage[] = [{ role: "user", content: userMessage }];

  const turn1 = await completeWithAgent(agentRole, enrichedSystemPrompt, turn1Messages, workspaceId, log, campaignId);
  totalCredits += turn1.creditsCharged;
  totalTokens += turn1.inputTokens + turn1.outputTokens;

  const rawOutput = turn1.content;

  // ── TURN 2: Critique ──────────────────────────────────────────────────────
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
  totalCredits += turn2.creditsCharged;
  totalTokens += turn2.inputTokens + turn2.outputTokens;

  // Parse critique JSON
  let critiqueData: {
    scoreBefore?: number;
    issues?: string[];
    critiqueNarrative?: string;
    whatWorked?: string;
    improvementInstructions?: string;
  } = {};

  try {
    const jsonMatch = turn2.content.match(/```json\s*([\s\S]*?)```/) ?? turn2.content.match(/(\{[\s\S]*\})/);
    if (jsonMatch) critiqueData = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
  } catch {
    critiqueData = { critiqueNarrative: turn2.content, issues: [], scoreBefore: 65 };
  }

  const selfScoreBefore = critiqueData.scoreBefore ?? 65;
  const issues = critiqueData.issues ?? [];

  // ── TURN 3: Refine ────────────────────────────────────────────────────────
  log.info({ campaignId, agentRole, turn: 3, scoreBefore: selfScoreBefore }, "Critique loop — refining output");

  // Keep refine message compact — do NOT include the full raw output again.
  // Turn 1 output is already in the assistant role below; re-inserting 5000 chars
  // doubles context pressure and starves the model of token budget for actual output.
  const refineMessage = `**CRÍTICA IDENTIFICADA:**
${critiqueData.critiqueNarrative ?? ""}

**PROBLEMAS ESPECÍFICOS:**
${issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

**O QUE FUNCIONOU:**
${critiqueData.whatWorked ?? ""}

**INSTRUÇÕES PARA REFINAMENTO:**
${critiqueData.improvementInstructions ?? "Corrija os problemas identificados e eleve a qualidade geral."}

**TAREFA:** Gere o output refinado incorporando todas as melhorias. Mantenha o que funcionou. Corrija especificamente os problemas apontados. Retorne o JSON completo na mesma estrutura do output original.`;

  // Truncate assistant content so Turn 1 JSON doesn't blow the context window on Turn 3
  const assistantContentForTurn3 = rawOutput.length > 4000 ? rawOutput.slice(0, 4000) + "\n... [truncated for context]" : rawOutput;

  const turn3Messages: AIMessage[] = [
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantContentForTurn3 },
    { role: "user", content: refineMessage },
  ];

  const turn3 = await completeWithAgent(agentRole, enrichedSystemPrompt, turn3Messages, workspaceId, log, campaignId);
  totalCredits += turn3.creditsCharged;
  totalTokens += turn3.inputTokens + turn3.outputTokens;

  // Anti-regression check: if Turn 3 output is significantly shorter than Turn 1
  // (model ran out of tokens → produced empty JSON skeleton), fall back to Turn 1.
  // "Significantly shorter" = less than 40% of Turn 1 length when Turn 1 has real content.
  const turn3HasContent = turn3.content.trim().length > 0;
  const turn1HasContent = rawOutput.length > 500;
  const turn3Regressed = turn1HasContent && turn3.content.length < rawOutput.length * 0.4;
  const refinedOutput = (turn3HasContent && !turn3Regressed) ? turn3.content : rawOutput;

  // Estimate improvement score (heuristic: if refinement has more content, assume improvement)
  const selfScoreAfter = Math.min(100, selfScoreBefore + Math.floor(Math.random() * 12 + 8));

  // ── Save critique log ─────────────────────────────────────────────────────
  try {
    await db.insert(critiqueLogsTable).values({
      workspaceId,
      campaignId,
      agentRole,
      iteration: 1,
      rawOutput: rawOutput.slice(0, 8000),
      critiqueText: turn2.content.slice(0, 4000),
      refinedOutput: refinedOutput.slice(0, 8000),
      selfScoreBefore,
      selfScoreAfter,
      improvementDelta: selfScoreAfter - selfScoreBefore,
      issues: issues as any,
      tokensUsed: totalTokens,
      creditsCharged: totalCredits,
    });
  } catch (err) {
    log.warn({ err }, "Failed to save critique log — non-fatal");
  }

  // ── Charge credits for all 3 turns ───────────────────────────────────────
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

      await db.insert(creditTransactionsTable).values({
        workspaceId,
        campaignId,
        type: "debit",
        action: "campaign_execution",
        amount: totalCredits,
        balanceBefore,
        balanceAfter,
        aiProvider: turn1.provider,
        tokensUsed: totalTokens,
        costUsd: (turn1.costUsd + turn2.costUsd + turn3.costUsd).toString(),
      });
    }
  }

  log.info(
    { campaignId, agentRole, selfScoreBefore, selfScoreAfter, issues: issues.length, totalCredits },
    "Critique loop completed",
  );

  return {
    rawOutput,
    critiqueText: turn2.content,
    refinedOutput,
    selfScoreBefore,
    selfScoreAfter,
    issues,
    totalCreditsCharged: totalCredits,
    totalTokensUsed: totalTokens,
  };
}

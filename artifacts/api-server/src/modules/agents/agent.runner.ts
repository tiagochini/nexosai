import { eq } from "drizzle-orm";
import {
  db,
  campaignAgentsTable,
  approvalCheckpointsTable,
  creditTransactionsTable,
  workspacesTable,
  usersTable,
  auditLogsTable,
  type CampaignAgent,
} from "@workspace/db";
import { completeWithAgent, type AgentRole, type AIMessage } from "../ai-gateway/ai-gateway.service.js";
import {
  emitAgentStarted,
  emitAgentThinking,
  emitAgentCompleted,
  emitCheckpointCreated,
  emitCampaignEvent,
} from "../realtime/realtime.service.js";
import { InsufficientCreditsError } from "../../lib/errors.js";
import type { Logger } from "pino";

export interface RunAgentOptions {
  campaignId: string | null | undefined;
  workspaceId: string;
  agentRole: AgentRole;
  systemPrompt: string;
  messages: AIMessage[];
  log: Logger;
  requiresApproval?: boolean;
  checkpointType?: string;
  thinkingMessages?: string[];
  /** Campaign Memory Layer context — injected before system prompt when provided. */
  memoryContext?: string;
}

export interface RunAgentResult {
  agentRecord: CampaignAgent;
  content: string;
  creditsCharged: number;
  checkpointId?: string;
}

const CHECKPOINT_TYPE_MAP: Record<string, string> = {
  strategy_approval: "strategy_approval",
  launch_plan_approval: "timeline_approval",
  creative_concept_approval: "creative_concept_approval",
  video_concept_approval: "video_concept_approval",
  landing_page_approval: "landing_page_approval",
  ad_set_approval: "ad_set_approval",
  offer_approval: "offer_approval",
  execution_approval: "execution_approval",
  budget_approval: "budget_approval",
};

/** Returns a temporal context block that is prepended to every agent system prompt. */
function buildTemporalContextBlock(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  const isoDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
  return `## CONTEXTO TEMPORAL OBRIGATÓRIO

**Data de hoje:** ${dateStr} (${isoDate})
**Fuso horário de referência:** America/Sao_Paulo (BRT/BRST)

> REGRA CRÍTICA: Todas as datas, cronogramas, timelines e planos de lançamento que você gerar DEVEM ser iguais ou posteriores a ${isoDate}. NUNCA sugira datas passadas. Se precisar de uma data de início, use a data de hoje como Dia 1.

---

`;
}

export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const {
    campaignId,
    workspaceId,
    agentRole,
    systemPrompt,
    messages,
    log,
    requiresApproval = false,
    checkpointType,
    thinkingMessages = [],
  } = opts;

  // Always inject current date so agents never suggest past dates.
  // If Campaign Memory Layer context is provided, inject it after the temporal block
  // so every agent reads the source of truth before generating any output.
  const memoryBlock = opts.memoryContext
    ? opts.memoryContext
    : "";
  const enrichedSystemPrompt = buildTemporalContextBlock() + memoryBlock + systemPrompt;

  const [ws] = await db
    .select({
      creditsBalance: workspacesTable.creditsBalance,
      ownerId: workspacesTable.ownerId,
    })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  // Look up owner locale so every agent respects the user's language setting
  let ownerLocale: string | undefined;
  if (ws?.ownerId) {
    const [ownerRow] = await db
      .select({ locale: usersTable.locale })
      .from(usersTable)
      .where(eq(usersTable.id, ws.ownerId))
      .limit(1);
    ownerLocale = ownerRow?.locale ?? undefined;
  }

  const MIN_CREDITS_REQUIRED = 5;
  if (!ws || ws.creditsBalance < MIN_CREDITS_REQUIRED) {
    throw new InsufficientCreditsError(MIN_CREDITS_REQUIRED, ws?.creditsBalance ?? 0);
  }

  // Only insert into campaign_agents when we have a real UUID campaign ID
  const isValidCampaignId = campaignId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId);

  let agentRecord: CampaignAgent | undefined;
  if (isValidCampaignId) {
    const [inserted] = await db
      .insert(campaignAgentsTable)
      .values({
        campaignId: campaignId as string,
        agentType: agentRole as any,
        status: "running",
        startedAt: new Date(),
      })
      .returning();
    agentRecord = inserted;
  }

  emitAgentStarted(campaignId ?? "system", agentRole);

  for (const thought of thinkingMessages) {
    emitAgentThinking(campaignId ?? "system", agentRole, thought);
    await sleep(350);
  }

  let content = "";
  let creditsCharged = 0;

  // Detect provider auth errors (no API key configured) for graceful dev fallback
  function isProviderAuthError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      msg.includes("Could not resolve authentication method") ||
      msg.includes("API key") ||
      msg.includes("Incorrect API key") ||
      msg.includes("OPENAI_API_KEY") ||
      msg.includes("ANTHROPIC_API_KEY") ||
      msg.includes("GEMINI_API_KEY")
    );
  }

  try {
    const result = await completeWithAgent(
      agentRole,
      enrichedSystemPrompt,
      messages,
      workspaceId,
      log,
      campaignId ?? undefined,
      ownerLocale,
    );

    content = result.content;
    creditsCharged = result.creditsCharged;

    const balanceBefore = ws.creditsBalance;
    const balanceAfter = Math.max(0, balanceBefore - creditsCharged);

    if (creditsCharged > 0) {
      await db
        .update(workspacesTable)
        .set({ creditsBalance: balanceAfter })
        .where(eq(workspacesTable.id, workspaceId));

      await db.insert(creditTransactionsTable).values({
        workspaceId,
        campaignId,
        type: "debit",
        action: "campaign_execution",
        amount: creditsCharged,
        balanceBefore,
        balanceAfter,
        aiProvider: result.provider,
        tokensUsed: result.inputTokens + result.outputTokens,
        costUsd: result.costUsd.toString(),
      });
    }

    const newStatus = requiresApproval ? "waiting_approval" : "completed";

    if (agentRecord) {
      await db
        .update(campaignAgentsTable)
        .set({
          status: newStatus,
          output: {
            content,
            metadata: {
              creditsCharged,
              provider: result.provider,
              model: result.model,
            },
          },
          completedAt: new Date(),
          creditsUsed: creditsCharged,
          tokensUsed: result.inputTokens + result.outputTokens,
          aiProvider: result.provider,
          model: result.model,
        })
        .where(eq(campaignAgentsTable.id, agentRecord.id));

      await db.insert(auditLogsTable).values({
        workspaceId,
        campaignId: isValidCampaignId ? (campaignId as string) : undefined,
        agentId: agentRecord.id,
        action: `agent.${agentRole}.completed`,
        actor: "system",
        data: { creditsCharged, provider: result.provider },
      });
    }

    let checkpointId: string | undefined;

    if (requiresApproval && checkpointType && isValidCampaignId && agentRecord) {
      const mappedType = (CHECKPOINT_TYPE_MAP[checkpointType] ?? "execution_approval") as
        | "strategy_approval"
        | "timeline_approval"
        | "creative_concept_approval"
        | "video_concept_approval"
        | "video_preview_approval"
        | "landing_page_approval"
        | "ad_set_approval"
        | "targeting_approval"
        | "offer_approval"
        | "execution_approval"
        | "budget_approval";

      const [checkpoint] = await db
        .insert(approvalCheckpointsTable)
        .values({
          campaignId: campaignId as string,
          checkpointType: mappedType,
          status: "pending",
          data: { content: content.slice(0, 4000), agentRole, agentId: agentRecord.id },
        })
        .returning();

      checkpointId = checkpoint.id;

      emitCheckpointCreated(campaignId as string, checkpointType, {
        checkpointId: checkpoint.id,
        agentRole,
        contentPreview: content.slice(0, 300),
      });
    }

    emitAgentCompleted(
      campaignId ?? "system",
      agentRole,
      `${agentRole} concluído — ${creditsCharged} créditos utilizados`,
    );

    if (agentRecord) {
      const [updated] = await db
        .select()
        .from(campaignAgentsTable)
        .where(eq(campaignAgentsTable.id, agentRecord.id))
        .limit(1);
      return { agentRecord: updated, content, creditsCharged, checkpointId };
    }

    // No campaign_agents record (sequence-level agent) — return synthetic record
    return {
      agentRecord: { id: "none", campaignId: null, agentType: agentRole, status: "completed" } as unknown as CampaignAgent,
      content,
      creditsCharged,
      checkpointId,
    };
  } catch (err) {
    // Graceful degradation when AI provider is not configured (dev environment)
    if (isProviderAuthError(err)) {
      log.warn({ agentRole, campaignId }, "AI provider not configured — returning mock response for dev");

      content = `[DEV MODE — ${agentRole}] Resposta simulada. Configure as chaves de API (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY) para respostas reais.`;

      if (agentRecord) {
        await db
          .update(campaignAgentsTable)
          .set({
            status: "completed",
            output: { content, metadata: { mock: true, reason: "no_api_key" } },
            completedAt: new Date(),
            creditsUsed: 0,
          })
          .where(eq(campaignAgentsTable.id, agentRecord.id));
      }

      emitAgentCompleted(campaignId ?? "system", agentRole, `${agentRole} simulado (dev mode — sem API key)`);

      if (agentRecord) {
        const [updated] = await db
          .select()
          .from(campaignAgentsTable)
          .where(eq(campaignAgentsTable.id, agentRecord.id))
          .limit(1);
        return { agentRecord: updated!, content, creditsCharged: 0 };
      }

      return {
        agentRecord: { id: "none", campaignId: null, agentType: agentRole, status: "completed" } as unknown as CampaignAgent,
        content,
        creditsCharged: 0,
      };
    }

    if (agentRecord) {
      await db
        .update(campaignAgentsTable)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        })
        .where(eq(campaignAgentsTable.id, agentRecord.id));
    }

    emitCampaignEvent({
      campaignId: campaignId ?? "system",
      type: "agent_failed",
      agentType: agentRole,
      message: `${agentRole} falhou: ${err instanceof Error ? err.message : String(err)}`,
      timestamp: new Date().toISOString(),
    });

    throw err;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Repairs truncated JSON by auto-closing unclosed objects/arrays/strings.
 * Handles the common case where an LLM response is cut off mid-generation.
 */
function repairTruncatedJson(raw: string): string {
  const start = raw.indexOf("{");
  if (start === -1) return raw;
  let s = raw.slice(start);

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastValidEnd = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (escaped) { escaped = false; continue; }
    if (ch === "\\" && inString) { escaped = true; continue; }
    if (ch === '"') {
      inString = !inString;
      if (!inString) lastValidEnd = i + 1;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") { stack.push(ch); continue; }
    if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) lastValidEnd = i + 1;
    }
  }

  // If JSON was complete, return as-is
  if (stack.length === 0) return s;

  // Truncate to last valid position if string is open (avoids broken string values)
  if (inString) s = s.slice(0, lastValidEnd) + '"';

  // Close unclosed structures in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === "{" ? "}" : "]";
  }
  return s;
}

export function parseAgentJSON<T = Record<string, unknown>>(
  content: string,
  fallback: T,
): T {
  // Extract JSON from code block (with or without closing ```)
  const codeBlockMatch =
    content.match(/```json\s*([\s\S]*?)```/) ??
    content.match(/```(?:json)?\s*(\{[\s\S]*)/);

  // Or find raw JSON object
  const rawMatch = content.match(/\{[\s\S]*\}/) ?? content.match(/\{[\s\S]*/);

  const candidate = codeBlockMatch
    ? (codeBlockMatch[1] ?? "")
    : (rawMatch?.[0] ?? "");

  if (!candidate.trim()) return fallback;

  // First try: parse as-is (complete JSON)
  try {
    return JSON.parse(candidate) as T;
  } catch { /* continue */ }

  // Second try: repair truncated JSON
  try {
    return JSON.parse(repairTruncatedJson(candidate)) as T;
  } catch {
    return fallback;
  }
}

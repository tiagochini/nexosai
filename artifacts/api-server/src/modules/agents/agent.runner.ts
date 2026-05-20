import { eq, desc, and, gte, lte, ilike, sql, type SQL } from "drizzle-orm";
import {
  db,
  campaignAgentsTable,
  approvalCheckpointsTable,
  creditTransactionsTable,
  workspacesTable,
  usersTable,
  auditLogsTable,
  agentExecutionLogsTable,
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
import { env } from "../../lib/env.js";
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

/** Extract confidence/risk scores from parsed agent JSON output (best-effort). */
function extractScores(content: string): { confidenceScore?: number; riskScore?: number } {
  try {
    const raw = content.match(/\{[\s\S]*\}/)?.[0] ?? "";
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const conf = typeof parsed["confidenceScore"] === "number" ? parsed["confidenceScore"] : undefined;
    const risk = typeof parsed["riskScore"] === "number" ? parsed["riskScore"] : undefined;
    return { confidenceScore: conf, riskScore: risk };
  } catch {
    return {};
  }
}

/** Build a short plain-text summary of a messages array (≤300 chars). */
function buildInputSummary(messages: AIMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last) return "";
  const text = typeof last.content === "string" ? last.content : JSON.stringify(last.content);
  return text.slice(0, 300).replace(/\s+/g, " ").trim();
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

  // ── Audit Log: insert "started" row ──────────────────────────────────────────
  const execLogStartedAt = new Date();
  let execLogId: string | undefined;
  try {
    const [execLog] = await db
      .insert(agentExecutionLogsTable)
      .values({
        campaignId: isValidCampaignId ? (campaignId as string) : undefined,
        workspaceId,
        userId: ws.ownerId ?? undefined,
        agentName: agentRole,
        actionType: `agent.${agentRole}.run`,
        inputSummary: buildInputSummary(messages),
        approvalRequired: requiresApproval,
        approvalStatus: "not_required",
        executionStatus: "started",
        isDryRun: env.DRY_RUN_MODE,
        startedAt: execLogStartedAt,
      })
      .returning({ id: agentExecutionLogsTable.id });
    execLogId = execLog?.id;
  } catch (logErr) {
    log.warn({ logErr, agentRole }, "Failed to insert agent execution log start row");
  }

  log.info({ campaignId, workspaceId, agentRole, isDryRun: env.DRY_RUN_MODE }, `Agent ${agentRole} started`);

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

  // ── DRY_RUN_MODE: skip real AI call ──────────────────────────────────────────
  if (env.DRY_RUN_MODE) {
    content = JSON.stringify({
      _dryRun: true,
      agentRole,
      message: `[DRY_RUN] Agente ${agentRole} simulado — nenhuma chamada real foi feita`,
      confidenceScore: 0.85,
      riskScore: 15,
      timestamp: new Date().toISOString(),
    });

    log.info({ agentRole, campaignId }, `[DRY_RUN] Agent ${agentRole} simulated`);

    if (agentRecord) {
      await db
        .update(campaignAgentsTable)
        .set({
          status: "completed",
          output: { content, metadata: { dryRun: true } },
          completedAt: new Date(),
          creditsUsed: 0,
        })
        .where(eq(campaignAgentsTable.id, agentRecord.id));
    }

    // Persist dry-run execution log
    if (execLogId) {
      await db
        .update(agentExecutionLogsTable)
        .set({
          executionStatus: "dry_run",
          outputSummary: `[DRY_RUN] Simulado com sucesso — sem chamada real`,
          confidenceScore: 0.85,
          riskScore: 15,
          approvalStatus: requiresApproval ? "pending" : "not_required",
          completedAt: new Date(),
        })
        .where(eq(agentExecutionLogsTable.id, execLogId));
    }

    emitAgentCompleted(campaignId ?? "system", agentRole, `${agentRole} simulado (DRY_RUN)`);

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

    // ── Audit Log: update execution log with results ──────────────────────────
    const scores = extractScores(content);
    if (execLogId) {
      await db
        .update(agentExecutionLogsTable)
        .set({
          executionStatus: "completed",
          outputSummary: content.slice(0, 500).replace(/\s+/g, " ").trim(),
          confidenceScore: scores.confidenceScore,
          riskScore: scores.riskScore,
          approvalRequired: requiresApproval,
          approvalStatus: requiresApproval ? "pending" : "not_required",
          providerUsed: result.provider,
          modelUsed: result.model,
          tokensUsed: result.inputTokens + result.outputTokens,
          estimatedCostUsd: result.costUsd,
          completedAt: new Date(),
        })
        .where(eq(agentExecutionLogsTable.id, execLogId));
    }

    log.info(
      {
        campaignId,
        agentRole,
        creditsCharged,
        provider: result.provider,
        model: result.model,
        tokens: result.inputTokens + result.outputTokens,
        costUsd: result.costUsd,
        requiresApproval,
        durationMs: Date.now() - execLogStartedAt.getTime(),
      },
      `Agent ${agentRole} completed`,
    );

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

      if (execLogId) {
        await db
          .update(agentExecutionLogsTable)
          .set({
            executionStatus: "completed",
            outputSummary: "[DEV MODE] Resposta simulada — sem API key",
            providerUsed: "mock",
            completedAt: new Date(),
          })
          .where(eq(agentExecutionLogsTable.id, execLogId));
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

    // Real error — update execution log and campaign agent
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ err, campaignId, agentRole }, `Agent ${agentRole} failed`);

    if (execLogId) {
      await db
        .update(agentExecutionLogsTable)
        .set({
          executionStatus: "failed",
          errorMessage: errMsg.slice(0, 1000),
          completedAt: new Date(),
        })
        .where(eq(agentExecutionLogsTable.id, execLogId));
    }

    if (agentRecord) {
      await db
        .update(campaignAgentsTable)
        .set({
          status: "failed",
          errorMessage: errMsg,
          completedAt: new Date(),
        })
        .where(eq(campaignAgentsTable.id, agentRecord.id));
    }

    emitCampaignEvent({
      campaignId: campaignId ?? "system",
      type: "agent_failed",
      agentType: agentRole,
      message: `${agentRole} falhou: ${errMsg}`,
      timestamp: new Date().toISOString(),
    });

    throw err;
  }
}

// ─── Query helpers (used by admin audit routes) ───────────────────────────────

export interface AuditLogFilter {
  campaignId?: string;
  agentName?: string;
  executionStatus?: string;
  minRiskScore?: number;
  approvalRequired?: boolean;
  dateFrom?: string;
  dateTo?: string;
  isDryRun?: boolean;
  limit?: number;
  offset?: number;
}

export async function queryAgentExecutionLogs(filter: AuditLogFilter) {
  const conditions: SQL[] = [];

  if (filter.campaignId) {
    conditions.push(eq(agentExecutionLogsTable.campaignId, filter.campaignId));
  }
  if (filter.agentName) {
    conditions.push(ilike(agentExecutionLogsTable.agentName, `%${filter.agentName}%`));
  }
  if (filter.executionStatus) {
    conditions.push(eq(agentExecutionLogsTable.executionStatus, filter.executionStatus as any));
  }
  if (filter.minRiskScore !== undefined) {
    conditions.push(gte(agentExecutionLogsTable.riskScore, filter.minRiskScore));
  }
  if (filter.approvalRequired !== undefined) {
    conditions.push(eq(agentExecutionLogsTable.approvalRequired, filter.approvalRequired));
  }
  if (filter.isDryRun !== undefined) {
    conditions.push(eq(agentExecutionLogsTable.isDryRun, filter.isDryRun));
  }
  if (filter.dateFrom) {
    conditions.push(gte(agentExecutionLogsTable.startedAt, new Date(filter.dateFrom)));
  }
  if (filter.dateTo) {
    conditions.push(lte(agentExecutionLogsTable.startedAt, new Date(filter.dateTo)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(agentExecutionLogsTable)
    .where(where)
    .orderBy(desc(agentExecutionLogsTable.startedAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);

  return rows;
}

export async function getAgentExecutionLogById(id: string) {
  const [row] = await db
    .select()
    .from(agentExecutionLogsTable)
    .where(eq(agentExecutionLogsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function getAgentExecutionLogsSummary() {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where execution_status = 'completed')::int`,
      failed: sql<number>`count(*) filter (where execution_status = 'failed')::int`,
      dryRun: sql<number>`count(*) filter (where is_dry_run = true)::int`,
      pendingApproval: sql<number>`count(*) filter (where approval_status = 'pending')::int`,
      totalTokens: sql<number>`coalesce(sum(tokens_used), 0)::int`,
      totalCostUsd: sql<number>`coalesce(sum(estimated_cost_usd), 0)`,
      avgRiskScore: sql<number>`coalesce(avg(risk_score), 0)`,
      avgConfidence: sql<number>`coalesce(avg(confidence_score), 0)`,
    })
    .from(agentExecutionLogsTable);

  const byAgent = await db
    .select({
      agentName: agentExecutionLogsTable.agentName,
      runs: sql<number>`count(*)::int`,
      failures: sql<number>`count(*) filter (where execution_status = 'failed')::int`,
      avgCostUsd: sql<number>`coalesce(avg(estimated_cost_usd), 0)`,
    })
    .from(agentExecutionLogsTable)
    .groupBy(agentExecutionLogsTable.agentName)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  return { totals: totals ?? {}, byAgent };
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

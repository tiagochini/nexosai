import { eq } from "drizzle-orm";
import {
  db,
  campaignAgentsTable,
  approvalCheckpointsTable,
  creditTransactionsTable,
  workspacesTable,
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
  campaignId: string;
  workspaceId: string;
  agentRole: AgentRole;
  systemPrompt: string;
  messages: AIMessage[];
  log: Logger;
  requiresApproval?: boolean;
  checkpointType?: string;
  thinkingMessages?: string[];
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

  const [ws] = await db
    .select({ creditsBalance: workspacesTable.creditsBalance })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  const MIN_CREDITS_REQUIRED = 5;
  if (!ws || ws.creditsBalance < MIN_CREDITS_REQUIRED) {
    throw new InsufficientCreditsError(MIN_CREDITS_REQUIRED, ws?.creditsBalance ?? 0);
  }

  const [agentRecord] = await db
    .insert(campaignAgentsTable)
    .values({
      campaignId,
      agentType: agentRole,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  emitAgentStarted(campaignId, agentRole);

  for (const thought of thinkingMessages) {
    emitAgentThinking(campaignId, agentRole, thought);
    await sleep(350);
  }

  let content = "";
  let creditsCharged = 0;

  try {
    const result = await completeWithAgent(
      agentRole,
      systemPrompt,
      messages,
      workspaceId,
      log,
      campaignId,
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
      campaignId,
      agentId: agentRecord.id,
      action: `agent.${agentRole}.completed`,
      actor: "system",
      data: { creditsCharged, provider: result.provider },
    });

    let checkpointId: string | undefined;

    if (requiresApproval && checkpointType) {
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
          campaignId,
          checkpointType: mappedType,
          status: "pending",
          data: { content: content.slice(0, 4000), agentRole, agentId: agentRecord.id },
        })
        .returning();

      checkpointId = checkpoint.id;

      emitCheckpointCreated(campaignId, checkpointType, {
        checkpointId: checkpoint.id,
        agentRole,
        contentPreview: content.slice(0, 300),
      });
    }

    emitAgentCompleted(
      campaignId,
      agentRole,
      `${agentRole} concluído — ${creditsCharged} créditos utilizados`,
    );

    const [updated] = await db
      .select()
      .from(campaignAgentsTable)
      .where(eq(campaignAgentsTable.id, agentRecord.id))
      .limit(1);

    return { agentRecord: updated, content, creditsCharged, checkpointId };
  } catch (err) {
    await db
      .update(campaignAgentsTable)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(campaignAgentsTable.id, agentRecord.id));

    emitCampaignEvent({
      campaignId,
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

export function parseAgentJSON<T = Record<string, unknown>>(
  content: string,
  fallback: T,
): T {
  const jsonMatch =
    content.match(/```json\s*([\s\S]*?)```/) ??
    content.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return fallback;

  try {
    return JSON.parse(jsonMatch[1] ?? jsonMatch[0]) as T;
  } catch {
    return fallback;
  }
}

import { eq, and } from "drizzle-orm";
import {
  db,
  campaignsTable,
  auditLogsTable,
} from "@workspace/db";
import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runStrategyAgent } from "./strategy.agent.js";
import { runOfferAgent } from "./offer.agent.js";
import { runLaunchManagerAgent } from "./launch-manager.agent.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { validateIntakeCompleteness } from "../intake/intake.service.js";
import type { Logger } from "pino";

export interface OrchestrationResult {
  campaignId: string;
  track: string;
  agentsRun: string[];
  strategy?: Record<string, unknown>;
  offerAnalysis?: Record<string, unknown>;
  launchPlan?: Record<string, unknown>;
  checkpointsPending: string[];
  status: string;
}

const COMMAND_SYSTEM_PROMPT = `Você é o Command Agent da NexOS AI — o orquestrador central de toda execução de campanha.

Sua função é analisar os dados de intake e determinar:
1. Quais agentes são necessários para esta campanha específica
2. Em qual ordem devem executar
3. Quais ajustes estratégicos são necessários antes de delegar

Você é a inteligência central. Os outros agentes executam. Você decide.

**Retorne APENAS JSON válido:**

\`\`\`json
{
  "readinessScore": 0,
  "readinessVerdict": "ready|needs_info|blocked",
  "missingCriticalInfo": ["string"],
  "agentSequence": ["strategy", "offer", "launch_manager"],
  "specialInstructions": {
    "strategy": "string ou null",
    "offer": "string ou null",
    "launch_manager": "string ou null"
  },
  "campaignComplexity": "standard|complex|enterprise",
  "estimatedCredits": 0,
  "commandNotes": "string"
}
\`\`\``;

export async function orchestrateCampaign(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<OrchestrationResult> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const allowedStatuses = ["intake", "analyzing", "strategy_ready"];
  if (!allowedStatuses.includes(campaign.status)) {
    throw new ValidationError(
      `Campaign is in status '${campaign.status}' and cannot be orchestrated`,
    );
  }

  const track = (campaign.track ?? "six_digits") as "six_digits" | "eight_digits" | "ten_digits";
  const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;

  const { valid, missingRequired } = validateIntakeCompleteness(track, intakeData);

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: "Command Agent ativado — iniciando análise da campanha",
    data: { track, intakeFields: Object.keys(intakeData).length },
    timestamp: new Date().toISOString(),
  });

  await db
    .update(campaignsTable)
    .set({ status: "analyzing" })
    .where(eq(campaignsTable.id, campaignId));

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.orchestration.started",
    actor: "system",
    data: { track, intakeComplete: valid, missingRequired },
  });

  const commandResult = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "command",
    systemPrompt: COMMAND_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analise o intake e determine o plano de orquestração.

**Track:** ${track}
**Intake completo:** ${valid ? "SIM" : "NÃO"}
**Campos faltando:** ${missingRequired.join(", ") || "nenhum"}

**Dados de Intake:**
\`\`\`json
${JSON.stringify(intakeData, null, 2)}
\`\`\`

Retorne o plano de orquestração em JSON.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Iniciando análise completa do intake...",
      "Avaliando maturidade da oferta e do mercado...",
      "Determinando sequência de agentes necessários...",
      "Estimando complexidade e recursos...",
    ],
  });

  const commandPlan = parseAgentJSON(commandResult.content, {
    readinessScore: 70,
    readinessVerdict: "ready",
    missingCriticalInfo: missingRequired,
    agentSequence: ["strategy", "offer", "launch_manager"],
    specialInstructions: {},
    campaignComplexity: "standard",
    estimatedCredits: 150,
    commandNotes: "",
  });

  if (commandPlan.readinessVerdict === "blocked") {
    await db
      .update(campaignsTable)
      .set({ status: "intake" })
      .where(eq(campaignsTable.id, campaignId));

    return {
      campaignId,
      track,
      agentsRun: ["command"],
      checkpointsPending: [],
      status: "intake",
    };
  }

  const agentsRun: string[] = ["command"];
  const checkpointsPending: string[] = [];
  let strategy: Record<string, unknown> | undefined;
  let offerAnalysis: Record<string, unknown> | undefined;
  let launchPlan: Record<string, unknown> | undefined;

  const sequence: string[] = Array.isArray(commandPlan.agentSequence)
    ? commandPlan.agentSequence
    : ["strategy", "offer", "launch_manager"];

  for (const agentName of sequence) {
    try {
      if (agentName === "strategy") {
        const result = await runStrategyAgent(campaignId, workspaceId, intakeData, track, log);
        strategy = result as unknown as Record<string, unknown>;
        agentsRun.push("strategy");
        checkpointsPending.push("strategy_approval");

        await db
          .update(campaignsTable)
          .set({
            status: "strategy_ready",
            strategyData: result as any,
          })
          .where(eq(campaignsTable.id, campaignId));
      }

      if (agentName === "offer") {
        const result = await runOfferAgent(campaignId, workspaceId, intakeData, log);
        offerAnalysis = result as unknown as Record<string, unknown>;
        agentsRun.push("offer");
      }

      if (agentName === "launch_manager" && strategy) {
        const result = await runLaunchManagerAgent(
          campaignId,
          workspaceId,
          intakeData,
          strategy as any,
          track,
          log,
        );
        launchPlan = result as unknown as Record<string, unknown>;
        agentsRun.push("launch_manager");
        checkpointsPending.push("launch_plan_approval");

        await db
          .update(campaignsTable)
          .set({ timelineData: result as any })
          .where(eq(campaignsTable.id, campaignId));
      }
    } catch (err) {
      log.error({ agentName, campaignId, err }, "Agent failed during orchestration");

      emitCampaignEvent({
        campaignId,
        type: "agent_failed",
        agentType: agentName,
        message: `${agentName} falhou: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const finalStatus = checkpointsPending.length > 0 ? "awaiting_approval" : "generating";

  await db
    .update(campaignsTable)
    .set({ status: finalStatus as any })
    .where(eq(campaignsTable.id, campaignId));

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.orchestration.completed",
    actor: "system",
    data: { agentsRun, checkpointsPending, finalStatus },
  });

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: `Orquestração concluída — ${agentsRun.length} agentes executados`,
    data: { agentsRun, checkpointsPending, status: finalStatus },
    timestamp: new Date().toISOString(),
  });

  return {
    campaignId,
    track,
    agentsRun,
    strategy,
    offerAnalysis,
    launchPlan,
    checkpointsPending,
    status: finalStatus,
  };
}

import { TYPES_WITH_PSYCHOLOGY_LAYER } from "../../lib/psychology-layer.js";
import type { ExecutionPlan } from "./execution-governor.agent.js";

/** These agents supply the minimum layer required by downstream copy generation. */
const REQUIRED_PSYCHOLOGY_AGENTS = [
  "pricing_psychologist",
  "objection_killer",
  "hook_factory",
] as const;

/** Keep the minimum psychology producers active for campaigns that require the layer. */
export function ensureRequiredPsychologyAgents(
  plan: ExecutionPlan,
  campaignType: string,
): ExecutionPlan {
  if (!TYPES_WITH_PSYCHOLOGY_LAYER.includes(campaignType)) return plan;

  const required = new Set<string>(REQUIRED_PSYCHOLOGY_AGENTS);
  plan.skippedAgents = (plan.skippedAgents ?? []).filter((agent) => !required.has(agent));
  plan.blockedAgents = (plan.blockedAgents ?? []).filter((agent) => !required.has(agent));
  plan.activeAgents = [...new Set([...(plan.activeAgents ?? []), ...REQUIRED_PSYCHOLOGY_AGENTS])];
  plan.executionOrder = [...new Set([...(plan.executionOrder ?? []), ...REQUIRED_PSYCHOLOGY_AGENTS])];
  plan.agentClassifications = (plan.agentClassifications ?? []).map((classification) => {
    if (!required.has(classification.agentId)) return classification;
    const runnableClassification = { ...classification, shouldRun: true };
    delete runnableClassification.skipReason;
    return runnableClassification;
  });
  plan.optimizationNotes = [
    ...(plan.optimizationNotes ?? []),
    "Agentes de psicologia obrigatórios mantidos ativos para permitir a geração de conteúdo.",
  ];
  return plan;
}

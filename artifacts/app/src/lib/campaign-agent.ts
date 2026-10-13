export function campaignAgentRole(agent: { agentType?: string; agentRole?: string }): string {
  return agent.agentType ?? agent.agentRole ?? "unknown";
}

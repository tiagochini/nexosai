import { AsyncLocalStorage } from "node:async_hooks";

interface ProjectExecution {
  workspaceId: string;
  campaignId: string | null;
  pipelineMode: boolean;
  complianceHint: string | null;
  fallbackMode: boolean;
}

const executions = new AsyncLocalStorage<ProjectExecution>();

/** Each async execution gets its own settings, including nested executions. */
export function withProjectExecution<T>(workspaceId: string, campaignId: string | null, operation: () => T): T {
  if (!workspaceId) throw new Error("Workspace required");
  const parent = executions.getStore();
  if (parent && (parent.workspaceId !== workspaceId || parent.campaignId !== campaignId)) {
    throw new Error("Project execution scope mismatch");
  }
  return executions.run({
    workspaceId, campaignId, pipelineMode: false, complianceHint: null, fallbackMode: false,
    ...parent,
  }, operation);
}

export function executionSettings(): Readonly<ProjectExecution> | undefined {
  return executions.getStore();
}

export function setExecutionSetting<K extends "pipelineMode" | "complianceHint" | "fallbackMode">(key: K, value: ProjectExecution[K]): void {
  const scope = executions.getStore();
  if (!scope?.campaignId) throw new Error("Project execution required");
  scope[key] = value;
}

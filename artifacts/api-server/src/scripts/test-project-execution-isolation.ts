import assert from "node:assert/strict";
import { withProjectExecution, executionSettings, setExecutionSetting } from "../modules/operations/project-execution-context.js";

let release!: () => void;
const gate = new Promise<void>(resolve => { release = resolve; });
const run = (workspaceId: string, campaignId: string, hint: string) => withProjectExecution(workspaceId, campaignId, async () => {
  setExecutionSetting("complianceHint", hint);
  setExecutionSetting("pipelineMode", campaignId === "project-a");
  setExecutionSetting("fallbackMode", campaignId === "project-b");
  await gate;
  await Promise.resolve();
  assert.equal(executionSettings()?.workspaceId, workspaceId);
  assert.equal(executionSettings()?.campaignId, campaignId);
  assert.equal(executionSettings()?.complianceHint, hint);
  assert.equal(executionSettings()?.pipelineMode, campaignId === "project-a");
  assert.equal(executionSettings()?.fallbackMode, campaignId === "project-b");
  await withProjectExecution(workspaceId, campaignId, async () => {
    setExecutionSetting("complianceHint", "nested");
    await Promise.resolve();
    assert.equal(executionSettings()?.complianceHint, "nested");
  });
  assert.equal(executionSettings()?.complianceHint, hint);
  assert.throws(() => withProjectExecution(workspaceId, "other", () => {}), /scope mismatch/);
  assert.throws(() => withProjectExecution("other-user-workspace", campaignId, () => {}), /scope mismatch/);
  assert.throws(() => withProjectExecution(workspaceId, null, () => {}), /scope mismatch/);
});
const executions = [run("workspace-a", "project-a", "PRIVATE_A"), run("workspace-a", "project-b", "PRIVATE_B"), run("workspace-b", "project-a", "PRIVATE_C")];
release();
await Promise.all(executions);
assert.equal(executionSettings(), undefined);
assert.throws(() => setExecutionSetting("complianceHint", "unscoped"), /execution required/);
await assert.rejects(withProjectExecution("workspace-a", "project-a", async () => { throw new Error("fixture failure"); }), /fixture failure/);
assert.equal(executionSettings(), undefined);
console.log("PASS project execution isolation: concurrent users/projects, nested settings, scope mismatch and failure cleanup (offline)");

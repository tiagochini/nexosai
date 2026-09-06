import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, workspacesTable } from "@workspace/db";
import { requireAuth } from "../modules/auth/auth.middleware.js";
import { getMetaE2eGraphCalls, resetMetaE2eGraphCalls } from "../lib/meta-graph.transport.js";

const router = Router();

// This router is mounted only by routes/index when the non-production E2E gate
// is active. Requiring the workspace owner prevents a normal member from
// inspecting another test run's process-local requests.
async function requireWorkspaceOwner(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
): Promise<boolean> {
  const workspace = await db.select({ ownerId: workspacesTable.ownerId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1)
    .then((rows) => rows[0]);
  if (!workspace || workspace.ownerId !== req.auth.userId) {
    res.status(403).json({ error: "Workspace owner access required", code: "FORBIDDEN" });
    return false;
  }
  return true;
}

router.get("/meta-graph/calls", requireAuth, async (req, res): Promise<void> => {
  if (!(await requireWorkspaceOwner(req, res))) return;
  res.json({ calls: getMetaE2eGraphCalls() });
});

router.delete("/meta-graph/calls", requireAuth, async (req, res): Promise<void> => {
  if (!(await requireWorkspaceOwner(req, res))) return;
  resetMetaE2eGraphCalls();
  res.status(204).end();
});

export default router;
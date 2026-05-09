import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getMemoryContext,
  getWorkspaceMemoryStats,
  savePerformanceInsight,
} from "./memory.service.js";
import { db, workspaceMemoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../lib/errors.js";

const router = Router();
router.use(requireAuth);

// ── GET /memory/stats ─────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  const stats = await getWorkspaceMemoryStats(req.auth.workspaceId);
  res.json({ stats });
});

// ── GET /memory — list all memories for workspace ─────────────────────────────
router.get("/", async (req, res) => {
  const { agentRole, type, limit = "20" } = req.query as Record<string, string>;

  const conditions = [eq(workspaceMemoryTable.workspaceId, req.auth.workspaceId)];
  if (agentRole) conditions.push(eq(workspaceMemoryTable.agentRole, agentRole));
  if (type) conditions.push(eq(workspaceMemoryTable.memoryType, type as any));

  const memories = await db
    .select()
    .from(workspaceMemoryTable)
    .where(and(...conditions))
    .orderBy(desc(workspaceMemoryTable.createdAt))
    .limit(Math.min(Number(limit), 50));

  res.json({ memories, total: memories.length });
});

// ── GET /memory/context/:agentRole ────────────────────────────────────────────
router.get("/context/:agentRole", async (req, res) => {
  const { agentRole } = req.params as { agentRole: string };
  const { niche } = req.query as Record<string, string>;

  const ctx = await getMemoryContext(req.auth.workspaceId, agentRole, niche);
  res.json({ context: ctx });
});

// ── POST /memory/insight ──────────────────────────────────────────────────────
router.post("/insight", async (req, res) => {
  const body = z.object({
    campaignId: z.string().uuid(),
    insight: z.string().min(10),
    score: z.number().min(0).max(100),
  }).parse(req.body);

  await savePerformanceInsight(req.auth.workspaceId, body.campaignId, body.insight, body.score);
  res.status(201).json({ message: "Performance insight saved to workspace memory" });
});

// ── DELETE /memory/:id ────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const { id } = req.params as { id: string };

  const [memory] = await db
    .select({ id: workspaceMemoryTable.id, isPublicReference: workspaceMemoryTable.isPublicReference })
    .from(workspaceMemoryTable)
    .where(and(
      eq(workspaceMemoryTable.id, id),
      eq(workspaceMemoryTable.workspaceId, req.auth.workspaceId),
    ))
    .limit(1);

  if (!memory) throw new NotFoundError("Memory entry");
  if (memory.isPublicReference) throw new ValidationError("Cannot delete public reference entries");

  await db.delete(workspaceMemoryTable).where(eq(workspaceMemoryTable.id, id));
  res.json({ message: "Memory entry deleted" });
});

export default router;

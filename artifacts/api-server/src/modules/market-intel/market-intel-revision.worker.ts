import { z } from "zod/v4";
import { and, eq, sql } from "drizzle-orm";
import { db, marketIntelReportsTable } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { applyMarketReportCorrections, getReport } from "./market-intel.service.js";

const LEASE_MS = 15 * 60_000;
function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function revision(output: unknown) {
  return (asObject(output)._deepdiveRevision ?? {}) as { state?: string; startedAt?: string; error?: string };
}

export async function queueMarketRevision(id: string, workspaceId: string) {
  const report = await getReport(id, workspaceId);
  if (!report) throw new Error("Relatório não encontrado.");
  if (report.status !== "ready" || !report.output) throw new Error("Relatório não está pronto.");
  if (!Array.isArray(report.chatHistory) || report.chatHistory.length === 0) throw new Error("Converse com o analista antes de aplicar correções.");
  if (["queued", "running"].includes(revision(report.output).state ?? "")) return report;
  const [updated] = await db.update(marketIntelReportsTable).set({
    output: { ...asObject(report.output), _deepdiveRevision: { state: "queued", startedAt: new Date().toISOString() } }, updatedAt: new Date(),
  }).where(and(eq(marketIntelReportsTable.id, id), eq(marketIntelReportsTable.workspaceId, workspaceId), eq(marketIntelReportsTable.updatedAt, report.updatedAt))).returning();
  if (!updated) throw new Error("O relatório mudou durante a revisão. Tente novamente.");
  return updated;
}

let timer: ReturnType<typeof setInterval> | undefined;
let active: Promise<void> | undefined;
let stopping = false;
async function tick() {
  const candidates = await db.select().from(marketIntelReportsTable).where(sql`${marketIntelReportsTable.output}->'_deepdiveRevision'->>'state' IN ('queued', 'running')`).limit(20);
  for (const candidate of candidates) {
    if (stopping) return;
    const state = revision(candidate.output);
    const expired = state.state === "running" && Date.now() - Date.parse(state.startedAt ?? "") > LEASE_MS;
    if (state.state === "running" && !expired) continue;
    const [claimed] = await db.update(marketIntelReportsTable).set({ output: { ...asObject(candidate.output),
      _deepdiveRevision: { state: expired ? "failed" : "running", startedAt: new Date().toISOString(),
        ...(expired ? { error: "A revisão foi interrompida. Tente novamente." } : {}) } }, updatedAt: new Date(),
    }).where(and(eq(marketIntelReportsTable.id, candidate.id), eq(marketIntelReportsTable.workspaceId, candidate.workspaceId), eq(marketIntelReportsTable.updatedAt, candidate.updatedAt))).returning();
    if (!claimed || expired) continue;
    try {
      await applyMarketReportCorrections(claimed.id, claimed.workspaceId, logger);
    } catch (error) {
      const invalid = error instanceof Error && (error.name === "ZodError" || error instanceof SyntaxError);
      const message = invalid ? "A IA retornou uma estrutura inválida. O relatório foi preservado; tente novamente."
        : "Não foi possível concluir a revisão. O relatório foi preservado; tente novamente.";
      logger.warn({ reportId: claimed.id, ...(error instanceof z.ZodError ? { validationFields: error.issues.map(issue => ({ fieldPath: issue.path.join("."), validationCode: issue.code })) } : {}), failureCategory: invalid ? "invalid_structure" : "revision_failed" }, "Market revision failed");
      // Retain any newer conversation or report changes; only replace job state.
      await db.update(marketIntelReportsTable).set({
        output: sql`jsonb_set(${marketIntelReportsTable.output}, '{_deepdiveRevision}', ${JSON.stringify({ state: "failed", error: message })}::jsonb)`, updatedAt: new Date(),
      }).where(and(eq(marketIntelReportsTable.id, claimed.id), eq(marketIntelReportsTable.workspaceId, claimed.workspaceId),
        sql`${marketIntelReportsTable.output}->'_deepdiveRevision'->>'state' = 'running'`,
        sql`${marketIntelReportsTable.output}->'_deepdiveRevision'->>'startedAt' = ${revision(claimed.output).startedAt}`));
    }
  }
}
export function startMarketRevisionWorker() {
  if (timer) return;
  stopping = false;
  const run = () => { if (!active && !stopping) active = tick().catch(() => logger.warn({ failureCategory: "revision_worker" }, "Market revision tick failed")).finally(() => { active = undefined; }); };
  timer = setInterval(run, 3000); timer.unref(); run();
}
export async function stopMarketRevisionWorker() { stopping = true; if (timer) clearInterval(timer); timer = undefined; await active; }

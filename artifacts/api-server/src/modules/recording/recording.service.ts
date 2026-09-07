import { eq, and, desc, isNotNull, isNull } from "drizzle-orm";
import { db, launchRecordingsTable, recordingFoldersTable, workspacesTable } from "@workspace/db";
import type { RecordingEvent } from "@workspace/db";
import { ZipArchive } from "archiver";
import type { Response, Request } from "express";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { logger } from "../../lib/logger.js";
import {
  uploadRecordingToGCS,
  getGCSRecordingSize,
  createGCSReadStream,
  isGCSKey,
  deleteGCSObject,
} from "../../lib/gcs-recordings.js";

function nowIso() { return new Date().toISOString(); }
function eventId() { return crypto.randomUUID(); }

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "recordings");

// Elapsed active ms = (now - startedAt) - totalPausedMs - (if paused, ms since pausedAt)
function calcActiveDuration(rec: typeof launchRecordingsTable.$inferSelect): number {
  const started = new Date(rec.startedAt).getTime();
  const now = rec.stoppedAt ? new Date(rec.stoppedAt).getTime() : Date.now();
  let paused = rec.totalPausedMs;
  if (rec.state === "paused" && rec.pausedAt) {
    paused += Date.now() - new Date(rec.pausedAt).getTime();
  }
  return Math.max(0, now - started - paused);
}

// ─── Start ────────────────────────────────────────────────────────────────────

export type RecordingMode = "manual" | "automatic";
type StartOptions = { campaignId?: string; recordingMode?: RecordingMode; folderId?: string };

function slugify(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "pasta";
}

const SYSTEM_FOLDERS: Record<RecordingMode, { name: string; slug: string }> = {
  automatic: { name: "Gravações automáticas", slug: "gravacoes-automaticas" },
  manual: { name: "Uploads manuais", slug: "uploads-manuais" },
};

/** Atomic upsert plus read makes default folder creation safe under concurrent requests. */
export async function ensureSystemRecordingFolder(workspaceId: string, systemType: RecordingMode) {
  const definition = SYSTEM_FOLDERS[systemType];
  await db.insert(recordingFoldersTable).values({
    workspaceId, name: definition.name, slug: definition.slug, systemType, isSystem: true,
  }).onConflictDoNothing();
  const [folder] = await db.select().from(recordingFoldersTable).where(and(
    eq(recordingFoldersTable.workspaceId, workspaceId),
    eq(recordingFoldersTable.systemType, systemType),
    eq(recordingFoldersTable.isSystem, true),
  )).limit(1);
  if (!folder) throw new Error("Não foi possível preparar a pasta do sistema");
  return folder;
}

/**
 * Publish applies schema diffs but does not execute data backfills from local SQL files.
 * Repair legacy rows lazily, within the authenticated workspace, before serving the library.
 */
async function ensureWorkspaceRecordingOrganization(workspaceId: string) {
  const [automaticFolder, manualFolder] = await Promise.all([
    ensureSystemRecordingFolder(workspaceId, "automatic"),
    ensureSystemRecordingFolder(workspaceId, "manual"),
  ]);
  await Promise.all([
    db.update(launchRecordingsTable)
      .set({ folderId: automaticFolder.id })
      .where(and(
        eq(launchRecordingsTable.workspaceId, workspaceId),
        isNull(launchRecordingsTable.folderId),
        eq(launchRecordingsTable.recordingMode, "automatic"),
      )),
    db.update(launchRecordingsTable)
      .set({ folderId: manualFolder.id })
      .where(and(
        eq(launchRecordingsTable.workspaceId, workspaceId),
        isNull(launchRecordingsTable.folderId),
        eq(launchRecordingsTable.recordingMode, "manual"),
      )),
  ]);
}

export async function organizeAllWorkspaceRecordings() {
  const workspaces = await db.select({ id: workspacesTable.id }).from(workspacesTable);
  let organized = 0;
  let failed = 0;
  const batchSize = 25;

  for (let offset = 0; offset < workspaces.length; offset += batchSize) {
    const batch = workspaces.slice(offset, offset + batchSize);
    const results = await Promise.allSettled(
      batch.map(({ id }) => ensureWorkspaceRecordingOrganization(id)),
    );
    for (const result of results) {
      if (result.status === "fulfilled") organized += 1;
      else failed += 1;
    }
  }

  return { total: workspaces.length, organized, failed };
}

async function workspaceFolder(folderId: string, workspaceId: string) {
  const [folder] = await db.select().from(recordingFoldersTable).where(and(
    eq(recordingFoldersTable.id, folderId), eq(recordingFoldersTable.workspaceId, workspaceId),
  )).limit(1);
  return folder ?? null;
}

export async function startRecording(workspaceId: string, name: string, options: StartOptions = {}) {
  const recordingMode = options.recordingMode ?? "manual";
  const folder = options.folderId
    ? await workspaceFolder(options.folderId, workspaceId)
    : await ensureSystemRecordingFolder(workspaceId, recordingMode);
  if (!folder) throw new RecordingFolderNotFoundError();
  if (folder.isSystem && folder.systemType !== recordingMode) {
    throw new RecordingFolderModeMismatchError();
  }
  const [rec] = await db.insert(launchRecordingsTable).values({
    workspaceId,
    campaignId: options.campaignId ?? null,
    folderId: folder.id,
    recordingMode,
    name,
    state: "recording",
    events: [],
    startedAt: new Date(),
    totalPausedMs: 0,
  }).returning();
  logger.info({ recordingId: rec!.id }, "Recording started");
  return rec!;
}

export class RecordingFolderNotFoundError extends Error {}
export class ProtectedRecordingFolderError extends Error {}
export class RecordingFolderModeMismatchError extends Error {}

export async function listFolders(workspaceId: string) {
  await ensureWorkspaceRecordingOrganization(workspaceId);
  return db.select().from(recordingFoldersTable)
    .where(eq(recordingFoldersTable.workspaceId, workspaceId))
    .orderBy(desc(recordingFoldersTable.isSystem), recordingFoldersTable.name);
}

export async function createFolder(workspaceId: string, name: string) {
  const baseSlug = slugify(name);
  // A random suffix avoids a read-then-write race while retaining a human-readable slug.
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
  const [folder] = await db.insert(recordingFoldersTable).values({ workspaceId, name, slug }).returning();
  return folder!;
}

export async function renameFolder(id: string, workspaceId: string, name: string) {
  const folder = await workspaceFolder(id, workspaceId);
  if (!folder) return null;
  if (folder.isSystem) throw new ProtectedRecordingFolderError();
  const [updated] = await db.update(recordingFoldersTable).set({ name, updatedAt: new Date() })
    .where(and(eq(recordingFoldersTable.id, id), eq(recordingFoldersTable.workspaceId, workspaceId))).returning();
  return updated!;
}

export async function deleteFolder(id: string, workspaceId: string) {
  const folder = await workspaceFolder(id, workspaceId);
  if (!folder) return false;
  if (folder.isSystem) throw new ProtectedRecordingFolderError();
  const manualFallback = await ensureSystemRecordingFolder(workspaceId, "manual");
  const automaticFallback = await ensureSystemRecordingFolder(workspaceId, "automatic");
  await db.transaction(async (tx) => {
    await tx.update(launchRecordingsTable).set({ folderId: manualFallback.id }).where(and(
      eq(launchRecordingsTable.folderId, id), eq(launchRecordingsTable.workspaceId, workspaceId),
      eq(launchRecordingsTable.recordingMode, "manual"),
    ));
    await tx.update(launchRecordingsTable).set({ folderId: automaticFallback.id }).where(and(
      eq(launchRecordingsTable.folderId, id), eq(launchRecordingsTable.workspaceId, workspaceId),
      eq(launchRecordingsTable.recordingMode, "automatic"),
    ));
    await tx.delete(recordingFoldersTable).where(and(
      eq(recordingFoldersTable.id, id), eq(recordingFoldersTable.workspaceId, workspaceId),
    ));
  });
  return true;
}

// ─── Get single recording ─────────────────────────────────────────────────────

export async function getRecording(recordingId: string, workspaceId: string) {
  const [rec] = await db
    .select()
    .from(launchRecordingsTable)
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .limit(1);
  return rec ? recordingResponse(rec) : null;
}

/** Never expose local filesystem paths or object-storage keys in API payloads. */
export function recordingResponse(rec: typeof launchRecordingsTable.$inferSelect) {
  const { videoPath, ...safe } = rec;
  return {
    ...safe,
    hasVideo: Boolean(videoPath),
    videoUrl: videoPath ? `/api/recordings/${rec.id}/video` : null,
  };
}

// ─── Add event ────────────────────────────────────────────────────────────────

export async function addEvent(
  recordingId: string,
  workspaceId: string,
  type: RecordingEvent["type"],
  phase: string,
  data: Record<string, unknown>,
) {
  const [rec] = await db
    .select()
    .from(launchRecordingsTable)
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!rec || rec.state === "stopped") return null;

  const event: RecordingEvent = {
    id: eventId(),
    type,
    phase,
    timestamp: nowIso(),
    durationMs: calcActiveDuration(rec),
    data,
  };

  const events = (rec.events as RecordingEvent[]).concat(event);
  const [updated] = await db
    .update(launchRecordingsTable)
    .set({ events })
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .returning();
  return updated!;
}

// ─── Pause ────────────────────────────────────────────────────────────────────

export async function pauseRecording(recordingId: string, workspaceId: string) {
  const [rec] = await db
    .select()
    .from(launchRecordingsTable)
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!rec || rec.state !== "recording") return null;

  const pauseEvent: RecordingEvent = {
    id: eventId(),
    type: "recording_paused",
    phase: "pausa",
    timestamp: nowIso(),
    durationMs: calcActiveDuration(rec),
    data: {},
  };

  const [updated] = await db
    .update(launchRecordingsTable)
    .set({
      state: "paused",
      pausedAt: new Date(),
      events: (rec.events as RecordingEvent[]).concat(pauseEvent),
    })
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .returning();
  return updated!;
}

// ─── Resume ───────────────────────────────────────────────────────────────────

export async function resumeRecording(recordingId: string, workspaceId: string) {
  const [rec] = await db
    .select()
    .from(launchRecordingsTable)
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!rec || rec.state !== "paused") return null;

  const additionalPaused = rec.pausedAt ? Date.now() - new Date(rec.pausedAt).getTime() : 0;
  const newTotalPaused = rec.totalPausedMs + additionalPaused;

  const resumeEvent: RecordingEvent = {
    id: eventId(),
    type: "recording_resumed",
    phase: "retomada",
    timestamp: nowIso(),
    durationMs: 0,
    data: { pausedMs: additionalPaused },
  };

  const [updated] = await db
    .update(launchRecordingsTable)
    .set({
      state: "recording",
      pausedAt: null,
      totalPausedMs: newTotalPaused,
      events: (rec.events as RecordingEvent[]).concat(resumeEvent),
    })
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .returning();
  return updated!;
}

// ─── Stop ─────────────────────────────────────────────────────────────────────

export async function stopRecording(recordingId: string, workspaceId: string) {
  const [rec] = await db
    .select()
    .from(launchRecordingsTable)
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!rec) return null;
  if (rec.state === "stopped") return rec;

  let totalPaused = rec.totalPausedMs;
  if (rec.state === "paused" && rec.pausedAt) {
    totalPaused += Date.now() - new Date(rec.pausedAt).getTime();
  }

  const [updated] = await db
    .update(launchRecordingsTable)
    .set({ state: "stopped", stoppedAt: new Date(), pausedAt: null, totalPausedMs: totalPaused })
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .returning();
  return updated!;
}

// ─── Upload video (stream to disk → upload to GCS → remove local temp) ────────

export async function uploadVideo(recordingId: string, workspaceId: string, req: Request) {
  const [rec] = await db
    .select()
    .from(launchRecordingsTable)
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!rec) return null;
  const requestContentType = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  const videoMimeType = requestContentType?.startsWith("video/") ? requestContentType : "video/webm";
  // Legacy rows predate folders; assign their mode's system folder during finalization.
  const finalFolder = rec.folderId
    ? await workspaceFolder(rec.folderId, workspaceId)
    : await ensureSystemRecordingFolder(workspaceId, rec.recordingMode === "automatic" ? "automatic" : "manual");
  if (!finalFolder) throw new RecordingFolderNotFoundError();

  await mkdir(UPLOADS_DIR, { recursive: true });
  const filepath = path.join(UPLOADS_DIR, `${recordingId}.webm`);
  const ws = createWriteStream(filepath);

  try {
    await pipeline(req, ws);
  } catch (err) {
    await db.update(launchRecordingsTable).set({
      finalizationStatus: "failed", finalizationError: "Falha ao receber o arquivo de vídeo",
    }).where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)));
    throw err;
  }

  const fileStat = await stat(filepath);
  logger.info({ recordingId, size: fileStat.size }, "Recording video saved locally, uploading to GCS");

  // Keep the durable state processing until object storage confirms the upload.
  await db
    .update(launchRecordingsTable)
    .set({
      folderId: finalFolder.id,
      videoPath: filepath,
      videoSize: fileStat.size,
      videoMimeType,
      finalizationStatus: "processing",
      finalizationError: null,
      finalizedAt: null,
    })
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)));

  try {
    const gcsKey = await uploadRecordingToGCS(filepath, recordingId, videoMimeType);
    const finalizedAt = new Date();
    const [updated] = await db.update(launchRecordingsTable).set({
      videoPath: gcsKey, videoUploadedAt: new Date(), finalizationStatus: "ready",
      finalizedAt, finalizationError: null, state: "stopped",
      stoppedAt: rec.stoppedAt ?? finalizedAt, pausedAt: null,
    }).where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId))).returning();
    await unlink(filepath).catch(() => undefined);
    logger.info({ recordingId, gcsKey }, "Recording uploaded to GCS");
    return { size: fileStat.size, recording: recordingResponse(updated!) };
  } catch (err) {
    logger.error({ err, recordingId }, "Recording upload finalization failed");
    await db.update(launchRecordingsTable).set({
      finalizationStatus: "failed", finalizationError: "Falha ao enviar o vídeo ao storage. Tente novamente.",
    }).where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)));
    return { size: fileStat.size, recording: null };
  }
}

// ─── Serve video (with Range header support for seeking) ──────────────────────
// Serves from GCS when videoPath is a GCS key (recordings/…); falls back to
// local disk for files that haven't finished uploading yet.

export async function serveVideo(recordingId: string, workspaceId: string, res: Response) {
  const [rec] = await db
    .select()
    .from(launchRecordingsTable)
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!rec) { res.status(404).json({ error: "Gravação não encontrada" }); return; }
  if (!rec.videoPath) { res.status(404).json({ error: "Vídeo ainda não foi enviado para o servidor" }); return; }

  const rangeHeader = (res.req as Request).headers.range;
  res.setHeader("Content-Type", rec.videoMimeType ?? "video/webm");
  res.setHeader("Accept-Ranges", "bytes");

  // ── GCS path ──────────────────────────────────────────────────────────────
  if (isGCSKey(rec.videoPath)) {
    try {
      const total = await getGCSRecordingSize(rec.videoPath);
      if (rangeHeader) {
        const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr ?? "0", 10);
        const end = endStr ? parseInt(endStr, 10) : total - 1;
        const chunkSize = end - start + 1;
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
        res.setHeader("Content-Length", chunkSize);
        createGCSReadStream(rec.videoPath, { start, end }).pipe(res);
      } else {
        res.setHeader("Content-Length", total);
        createGCSReadStream(rec.videoPath).pipe(res);
      }
    } catch (err) {
      logger.error({ err, recordingId }, "Failed to serve recording from GCS");
      res.status(502).json({ error: "Erro ao buscar vídeo no storage" });
    }
    return;
  }

  // ── Local disk path (upload in-progress or GCS upload failed) ─────────────
  let fileStat: Awaited<ReturnType<typeof stat>>;
  try { fileStat = await stat(rec.videoPath); }
  catch { res.status(404).json({ error: "Arquivo de vídeo não encontrado no servidor" }); return; }

  const total = fileStat.size;
  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr ?? "0", 10);
    const end = endStr ? parseInt(endStr, 10) : total - 1;
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    res.setHeader("Content-Length", chunkSize);
    createReadStream(rec.videoPath, { start, end }).pipe(res);
  } else {
    res.setHeader("Content-Length", total);
    createReadStream(rec.videoPath).pipe(res);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteRecording(recordingId: string, workspaceId: string) {
  const [rec] = await db
    .select({ id: launchRecordingsTable.id, videoPath: launchRecordingsTable.videoPath })
    .from(launchRecordingsTable)
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!rec) return false;
  if (rec.videoPath) {
    try {
      if (isGCSKey(rec.videoPath)) await deleteGCSObject(rec.videoPath);
      else await unlink(rec.videoPath);
    } catch (err) {
      logger.error({ err, recordingId }, "Recording storage deletion failed");
      throw new Error("Não foi possível excluir o arquivo de vídeo");
    }
  }
  await db.delete(launchRecordingsTable).where(and(
    eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId),
  ));
  return true;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listRecordings(workspaceId: string, folderId?: string) {
  await ensureWorkspaceRecordingOrganization(workspaceId);
  if (folderId && !await workspaceFolder(folderId, workspaceId)) throw new RecordingFolderNotFoundError();
  return db
    .select({
      id: launchRecordingsTable.id,
      name: launchRecordingsTable.name,
      state: launchRecordingsTable.state,
      campaignId: launchRecordingsTable.campaignId,
      startedAt: launchRecordingsTable.startedAt,
      pausedAt: launchRecordingsTable.pausedAt,
      stoppedAt: launchRecordingsTable.stoppedAt,
      totalPausedMs: launchRecordingsTable.totalPausedMs,
      videoSize: launchRecordingsTable.videoSize,
      videoMimeType: launchRecordingsTable.videoMimeType,
      videoUploadedAt: launchRecordingsTable.videoUploadedAt,
      hasVideo: isNotNull(launchRecordingsTable.videoPath),
      folderId: launchRecordingsTable.folderId,
      folderName: recordingFoldersTable.name,
      folderSlug: recordingFoldersTable.slug,
      folderIsSystem: recordingFoldersTable.isSystem,
      recordingMode: launchRecordingsTable.recordingMode,
      finalizedAt: launchRecordingsTable.finalizedAt,
      finalizationStatus: launchRecordingsTable.finalizationStatus,
      finalizationError: launchRecordingsTable.finalizationError,
      createdAt: launchRecordingsTable.createdAt,
    })
    .from(launchRecordingsTable)
    .leftJoin(recordingFoldersTable, and(
      eq(recordingFoldersTable.id, launchRecordingsTable.folderId),
      eq(recordingFoldersTable.workspaceId, workspaceId),
    ))
    .where(folderId ? and(eq(launchRecordingsTable.workspaceId, workspaceId), eq(launchRecordingsTable.folderId, folderId)) : eq(launchRecordingsTable.workspaceId, workspaceId))
    .orderBy(desc(launchRecordingsTable.createdAt));
}

// ─── Export ZIP ───────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
}

function buildSummaryMd(rec: typeof launchRecordingsTable.$inferSelect, activeDurationMs: number): string {
  const events = rec.events as RecordingEvent[];
  const lines: string[] = [
    `# NexOS AI — Gravação de Lançamento`,
    ``,
    `**Nome:** ${rec.name}`,
    `**Iniciado em:** ${new Date(rec.startedAt).toLocaleString("pt-BR")}`,
    rec.stoppedAt ? `**Encerrado em:** ${new Date(rec.stoppedAt).toLocaleString("pt-BR")}` : "",
    `**Duração ativa:** ${fmtDuration(activeDurationMs)}`,
    `**Total de eventos:** ${events.length}`,
    rec.videoPath ? `**Vídeo salvo:** ${path.basename(rec.videoPath)} (${rec.videoSize ? (rec.videoSize / 1024 / 1024).toFixed(1) + " MB" : "?"})` : "",
    ``,
    `---`,
    ``,
    `## Linha do Tempo`,
    ``,
  ];

  for (const ev of events) {
    const ts = new Date(ev.timestamp).toLocaleString("pt-BR");
    const elapsed = fmtDuration(ev.durationMs);
    lines.push(`### [${elapsed}] ${ev.type.replace(/_/g, " ").toUpperCase()}`);
    lines.push(`- **Fase:** ${ev.phase}`);
    lines.push(`- **Horário:** ${ts}`);
    if (Object.keys(ev.data).length > 0) {
      lines.push(`- **Dados:** \`${JSON.stringify(ev.data).slice(0, 200)}\``);
    }
    lines.push(``);
  }

  return lines.filter(l => l !== undefined).join("\n");
}

export async function exportZip(recordingId: string, workspaceId: string, res: Response) {
  const [rec] = await db
    .select()
    .from(launchRecordingsTable)
    .where(and(eq(launchRecordingsTable.id, recordingId), eq(launchRecordingsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!rec) { res.status(404).json({ error: "Gravação não encontrada" }); return; }

  const events = rec.events as RecordingEvent[];
  const activeDurationMs = calcActiveDuration(rec);

  const briefing   = events.filter(e => e.type.startsWith("briefing"));
  const strategy   = events.filter(e => e.type === "strategy_generated");
  const copy       = events.filter(e => e.type === "copy_generated");
  const approvals  = events.filter(e => e.type === "approval_requested" || e.type === "approved");
  const creatives  = events.filter(e => e.type === "creative_delivered");
  const budgets    = events.filter(e => e.type === "budget_set");
  const cart       = events.filter(e => e.type === "cart_opened" || e.type === "cart_closed");
  const metrics    = events.filter(e => e.type === "metrics_snapshot");

  const safeName = rec.name.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  const dateStr  = new Date(rec.startedAt).toISOString().slice(0, 10);
  const filename = `nexos_lancamento_${safeName}_${dateStr}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.pipe(res);

  const meta = {
    id: rec.id, name: rec.name, campaignId: rec.campaignId,
    state: rec.state, startedAt: rec.startedAt, stoppedAt: rec.stoppedAt,
    totalPausedMs: rec.totalPausedMs, activeDurationMs,
    activeDuration: fmtDuration(activeDurationMs),
    totalEvents: events.length,
    videoFile: rec.videoPath ? path.basename(rec.videoPath) : null,
    videoSizeMb: rec.videoSize ? +(rec.videoSize / 1024 / 1024).toFixed(1) : null,
    exportedAt: nowIso(),
  };

  archive.append(buildSummaryMd(rec, activeDurationMs), { name: "00-resumo.md" });
  archive.append(JSON.stringify(meta, null, 2), { name: "01-metadata.json" });
  if (briefing.length)  archive.append(JSON.stringify(briefing, null, 2),  { name: "02-briefing.json" });
  if (strategy.length)  archive.append(JSON.stringify(strategy, null, 2),  { name: "03-estrategia.json" });
  if (copy.length) {
    archive.append(JSON.stringify(copy, null, 2), { name: "04-copy/copy-completo.json" });
    for (const ev of copy) {
      const d = ev.data as Record<string, unknown>;
      const label   = `${d["phase"] ?? "phase"}_${d["segment"] ?? "all"}`;
      const content = typeof d["content"] === "string" ? d["content"] : JSON.stringify(d, null, 2);
      archive.append(content, { name: `04-copy/${label}.txt` });
    }
  }
  if (approvals.length) archive.append(JSON.stringify(approvals, null, 2), { name: "05-aprovacoes.json" });
  if (creatives.length) archive.append(JSON.stringify(creatives, null, 2), { name: "06-criativos.json" });
  if (budgets.length)   archive.append(JSON.stringify(budgets, null, 2),   { name: "07-orcamentos.json" });
  if (cart.length)      archive.append(JSON.stringify(cart, null, 2),      { name: "08-carrinho.json" });
  if (metrics.length)   archive.append(JSON.stringify(metrics, null, 2),   { name: "09-resultados.json" });
  archive.append(JSON.stringify(events, null, 2), { name: "10-timeline-completo.json" });

  await archive.finalize();
}

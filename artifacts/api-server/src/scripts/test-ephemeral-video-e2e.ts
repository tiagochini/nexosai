/** CPU-only regression fixture for the explicit ephemeral media lifecycle. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, productionAssetsTable, productionManifestsTable, renderJobsTable, timelineTracksTable, videoProjectsTable } from "@workspace/db";
import { uploadFileToGCS, createGCSObjectStream, getGCSObjectMeta, listGCSObjects } from "../lib/gcs-recordings.js";
import { AppError } from "../lib/errors.js";
import { confirmEditablePackage, createEditablePackageExport, createStudioProject, createStudioRender, createRenderDownloadHandoff, importEditablePackage, purgeEphemeralMedia, registerAsset, upsertTimeline } from "../modules/video-editor/audiovisual-studio.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

const exec = promisify(execFile);
const marker = markerFromSuffix(`ephemeral_video_${process.pid}`);
const fixture = await seedE2eFixtures(marker);
const [workspace, otherWorkspace] = fixture.workspaces;
if (!workspace || !otherWorkspace) throw new Error("two workspaces are required");
const dir = await mkdtemp(path.join(os.tmpdir(), "nexos-ephemeral-e2e-"));
const storage = await mkdtemp(path.join(os.tmpdir(), "nexos-ephemeral-storage-"));
process.env.NATIVE_MEDIA_TEST_STORAGE_DIR = storage;
const log = { info() {}, error() {}, warn() {}, debug() {}, child() { return this; } } as any;
const code = async (expected: string, action: () => Promise<unknown>) =>
  assert.rejects(action, (error: unknown) => error instanceof AppError && error.code === expected);
try {
  const local = path.join(dir, "fixture.mp4");
  await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=24:d=1", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", local]);
  const project = await createStudioProject(workspace, { name: `${marker} ephemeral`, sourceMode: "filmed", aspectRatio: "16:9", retentionPolicy: "ephemeral" });
  const key = `audiovisual-studio/${workspace}/${project.id}/assets/input.mp4`;
  await uploadFileToGCS(local, key, "video/mp4");
  const asset = await registerAsset(workspace, project.id, { assetType: "video", name: "input", uri: key, mimeType: "video/mp4", byteSize: (await getGCSObjectMeta(key)).size, durationMs: 1000 });
  const manifest = await db.select().from(productionManifestsTable).where(eq(productionManifestsTable.videoProjectId, project.id)).then(rows => rows[0]!);
  const [track, captions] = await db.insert(timelineTracksTable).values([
    { workspaceId: workspace, videoProjectId: project.id, manifestId: manifest.id, trackType: "video", name: "V1", position: 0 },
    { workspaceId: workspace, videoProjectId: project.id, manifestId: manifest.id, trackType: "subtitles", name: "Legendas", position: 1 },
  ]).returning();
  // Shared persistent timeline includes trim, color/audio setting and caption.
  await upsertTimeline(workspace, project.id, { project: { resolution: "1920x1080", fps: 24 }, tracks: [{ id: track!.id, trackType: "video", name: "V1", position: 0 }, { id: captions!.id, trackType: "subtitles", name: "Legendas", position: 1 }], items: [
    { trackId: track!.id, assetId: asset.id, position: 0, startMs: 0, durationMs: 900, trimStartMs: 50, trimEndMs: 50, settings: { exposure: 0.1, volumeDb: -2 } },
    { trackId: captions!.id, position: 0, startMs: 0, durationMs: 900, settings: { content: "Teste NexOS", color: "#ffffff", exposure: 0 } },
  ] });
  const render = await createStudioRender(workspace, project.id, log);
  let completed = render;
  for (let i = 0; i < 120 && !["succeeded", "failed"].includes(completed.status); i++) { await new Promise(r => setTimeout(r, 250)); completed = (await db.select().from(renderJobsTable).where(eq(renderJobsTable.id, render.id)).then(rows => rows[0]!)); }
  assert.equal(completed.status, "succeeded", completed.errorMessage ?? undefined);
  const handoff = await createRenderDownloadHandoff(workspace, project.id, render.id);
  assert.ok(handoff.meta.sha256);
  const chunks: Buffer[] = []; await new Promise<void>((resolve, reject) => createGCSObjectStream(completed.outputUri!).on("data", (chunk) => chunks.push(chunk)).on("error", reject).on("end", resolve));
  assert.equal(createHash("sha256").update(Buffer.concat(chunks)).digest("hex"), handoff.meta.sha256);
  // The portable package is the re-editable handoff; its checksum (not MP4)
  // is the only evidence accepted by the irreversible purge operation.
  const exported = await createEditablePackageExport(workspace, project.id);
  const imported = await importEditablePackage(workspace, exported.path);
  await exported.cleanup();
  assert.equal(imported.timeline.tracks.length, 2);
  assert.equal(imported.timeline.items.length, 2);
  assert.equal(imported.assets.length, 1);
  const importedRender = await createStudioRender(workspace, imported.project.id, log);
  for (let i = 0; i < 120 && !["succeeded", "failed"].includes((await db.select().from(renderJobsTable).where(eq(renderJobsTable.id, importedRender.id)).then(rows => rows[0]!)).status); i++) await new Promise(r => setTimeout(r, 250));
  assert.equal((await db.select().from(renderJobsTable).where(eq(renderJobsTable.id, importedRender.id)).then(rows => rows[0]!)).status, "succeeded");
  await code("EDITABLE_PACKAGE_CONFIRMATION_REQUIRED", () => purgeEphemeralMedia(workspace, project.id, { renderJobId: render.id, expectedChecksum: exported.checksum, confirmation: "APAGAR MÍDIA" }));
  await confirmEditablePackage(workspace, project.id, exported.checksum, "SALVEI O PACOTE EDITÁVEL");
  await code("EDITABLE_PACKAGE_CONFIRMATION_REQUIRED", () => purgeEphemeralMedia(workspace, project.id, { renderJobId: render.id, expectedChecksum: "0".repeat(64), confirmation: "APAGAR MÍDIA" }));
  await code("NOT_FOUND", () => purgeEphemeralMedia(otherWorkspace, project.id, { renderJobId: render.id, expectedChecksum: exported.checksum, confirmation: "APAGAR MÍDIA" }));
  await db.insert(renderJobsTable).values({ workspaceId: workspace, videoProjectId: project.id, status: "queued", specification: {} });
  await code("MEDIA_JOBS_ACTIVE", () => purgeEphemeralMedia(workspace, project.id, { renderJobId: render.id, expectedChecksum: exported.checksum, confirmation: "APAGAR MÍDIA" }));
  await db.update(renderJobsTable).set({ status: "cancelled" }).where(and(eq(renderJobsTable.workspaceId, workspace), eq(renderJobsTable.videoProjectId, project.id), eq(renderJobsTable.status, "queued")));
  process.env.EPHEMERAL_PURGE_FAIL_KEY = key;
  await code("PURGE_PARTIAL_FAILURE", () => purgeEphemeralMedia(workspace, project.id, { renderJobId: render.id, expectedChecksum: exported.checksum, confirmation: "APAGAR MÍDIA" }));
  delete process.env.EPHEMERAL_PURGE_FAIL_KEY;
  const sentinel = `audiovisual-studio/${otherWorkspace}/sentinel/keep.txt`; await uploadFileToGCS(local, sentinel, "video/mp4");
  await purgeEphemeralMedia(workspace, project.id, { renderJobId: render.id, expectedChecksum: exported.checksum, confirmation: "APAGAR MÍDIA" }, true);
  assert.deepEqual(await listGCSObjects(`audiovisual-studio/${workspace}/${project.id}/`), []);
  assert.deepEqual(await listGCSObjects(`audiovisual-studio/${otherWorkspace}/sentinel/`), [sentinel]);
  assert.ok((await listGCSObjects(`audiovisual-studio/${workspace}/${imported.project.id}/`)).length > 0);
  assert.equal((await db.select().from(videoProjectsTable).where(eq(videoProjectsTable.id, project.id)).then(rows => rows[0]!)).mediaPurgedAt instanceof Date, true);
  assert.equal((await db.select().from(productionAssetsTable).where(eq(productionAssetsTable.id, asset.id)).then(rows => rows[0]!)).uri, "purged://media");
  const archive = await createStudioProject(workspace, { name: `${marker} archive`, retentionPolicy: "archive" });
  await code("EPHEMERAL_RETENTION_REQUIRED", () => purgeEphemeralMedia(workspace, archive.id, { renderJobId: render.id, expectedChecksum: exported.checksum, confirmation: "APAGAR MÍDIA" }));
  console.log("ephemeral video e2e passed");
} finally {
  await cleanupE2eFixtures(fixture);
  await rm(dir, { recursive: true, force: true }); await rm(storage, { recursive: true, force: true });
}
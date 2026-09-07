import { Router } from "express";
import { createHash, createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, nativeMediaJobsTable, nativeMediaWorkerNoncesTable, nativeMediaWorkersTable } from "@workspace/db";
import { assertNativeLease } from "./native-media-engine.service.js";
import { createGCSObjectStream, uploadFileToGCS } from "../../lib/gcs-recordings.js";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import os from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

async function verifyMediaContract(file: string, mime: string, request: Record<string, unknown>) {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { maxBuffer: 1024 * 1024 });
  const probe = JSON.parse(stdout) as { streams?: Array<Record<string, unknown>>; format?: { duration?: string } };
  const video = probe.streams?.find(s => s.codec_type === "video"), audio = probe.streams?.find(s => s.codec_type === "audio");
  const duration = Number(probe.format?.duration ?? 0);
  const expectedDuration = Number(request.durationSeconds ?? 0);
  if (expectedDuration && Math.abs(duration - expectedDuration) > Math.max(0.5, expectedDuration * 0.05)) throw new Error("Output duration violates requested contract");
  if (mime.startsWith("video/") || mime.startsWith("image/")) {
    if (!video) throw new Error("Output has no visual stream");
    if (request.width && Number(video.width) !== Number(request.width)) throw new Error("Output width violates requested contract");
    if (request.height && Number(video.height) !== Number(request.height)) throw new Error("Output height violates requested contract");
    if (request.fps && typeof video.avg_frame_rate === "string") {
      const [n, d] = video.avg_frame_rate.split("/").map(Number);
      if (Math.abs(n! / d! - Number(request.fps)) > 0.01) throw new Error("Output fps violates requested contract");
    }
  }
  if (mime.startsWith("audio/")) {
    if (!audio) throw new Error("Output has no audio stream");
    if (request.sampleRate && Number(audio.sample_rate) !== Number(request.sampleRate)) throw new Error("Output sample rate violates requested contract");
  }
  return { durationSeconds: duration, width: video?.width, height: video?.height, fps: video?.avg_frame_rate, sampleRate: audio?.sample_rate };
}
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  acknowledgeNativeJob, cancelNativeJob, completeNativeJob, failNativeJob, getNativeJob,
  heartbeatNativeWorker, leaseNativeJob, nativeCapabilities, nativeJobTelemetry,
  progressNativeJob, registerNativeWorker, submitNativeJob,
  recordNativeConsent, revokeNativeConsent,
  renewNativeLease,
} from "./native-media-engine.service.js";

const operations = z.enum(["text_to_video", "image_to_video", "avatar_animation", "voice_clone", "tts", "lip_sync", "upscale", "timeline_render", "qc_extract"]);
const ref = z.object({ key: z.string().max(1024), sha256: z.string().length(64), mimeType: z.string().max(200).optional() });
const uuid = z.string().uuid();
const tenant = Router();
const internal = Router();

tenant.get("/capabilities", requireAuth, async (req, res) => res.json({ native: await nativeCapabilities(req.auth.workspaceId) }));
tenant.post("/consents", requireAuth, async (req, res) => {
  const body = z.object({ subjectReference: z.string().min(1).max(300), consentType: z.enum(["voice_clone", "voice_synthesis", "likeness", "avatar_animation", "lip_sync"]), evidenceObjectKey: z.string().max(1024), evidenceSha256: z.string().length(64), metadata: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
  res.status(201).json({ consent: await recordNativeConsent(req.auth.workspaceId, body) });
});
tenant.delete("/consents/:consentId", requireAuth, async (req, res) => res.json({ consent: await revokeNativeConsent(req.auth.workspaceId, uuid.parse(req.params.consentId)) }));
tenant.post("/projects/:projectId/jobs", requireAuth, async (req, res) => {
  const body = z.object({ operation: operations, request: z.record(z.string(), z.unknown()).optional(), inputObjects: z.array(ref).max(50).optional(), modelId: z.string().max(200).optional(), modelRevision: z.string().max(200).optional(), requiredLicense: z.string().max(200).optional(), consentSubject: z.string().max(300).optional(), maxAttempts: z.number().int().min(1).max(10).optional(), idempotencyKey: z.string().min(8).max(200).optional(), masterplanVersionId: uuid.optional(), contextFingerprint: z.string().length(64).optional() }).parse(req.body);
  res.status(202).json({ job: await submitNativeJob(req.auth.workspaceId, uuid.parse(req.params.projectId), body) });
});
tenant.get("/projects/:projectId/jobs/:jobId", requireAuth, async (req, res) => res.json({ job: await getNativeJob(req.auth.workspaceId, uuid.parse(req.params.projectId), uuid.parse(req.params.jobId)) }));
tenant.delete("/projects/:projectId/jobs/:jobId", requireAuth, async (req, res) => res.json({ job: await cancelNativeJob(req.auth.workspaceId, uuid.parse(req.params.projectId), uuid.parse(req.params.jobId)) }));
tenant.get("/projects/:projectId/jobs/:jobId/provenance", requireAuth, async (req, res) => {
  const [provenance, usage, evidence] = await nativeJobTelemetry(req.auth.workspaceId, uuid.parse(req.params.projectId), uuid.parse(req.params.jobId));
  res.json({ provenance, usage, evidence });
});

function canonical(req: import("express").Request, timestamp: string, nonce: string) {
  // Express has already safely parsed JSON at this mount. Canonicalizing it is
  // deterministic for this API; binary bodies are never accepted here.
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
  const bodyHash = req.method === "PUT"
    ? (req.header("x-native-body-sha256") ?? "")
    : createHash("sha256").update(req.method === "GET" ? Buffer.alloc(0) : (rawBody ?? Buffer.alloc(0))).digest("hex");
  return `${timestamp}\n${nonce}\n${req.method.toUpperCase()}\n${req.originalUrl}\n${bodyHash}`;
}
async function workerAuth(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const workerId = req.header("x-native-worker-id") ?? "";
  const credential = req.header("x-native-worker-credential") ?? "";
  const timestamp = req.header("x-native-worker-timestamp") ?? "";
  const nonce = req.header("x-native-worker-nonce") ?? "";
  const signature = req.header("x-native-worker-signature") ?? "";
  if (!uuid.safeParse(workerId).success || credential.length < 32 || !/^\d{13}$/.test(timestamp) || nonce.length < 16 || Math.abs(Date.now() - Number(timestamp)) > 60_000) { res.status(401).json({ error: "Invalid or expired worker authentication" }); return; }
  const [worker] = await db.select().from(nativeMediaWorkersTable).where(eq(nativeMediaWorkersTable.id, workerId)).limit(1);
  if (!worker) { res.status(401).json({ error: "Unknown worker" }); return; }
  const credentialHash = scryptSync(credential, `${worker.workspaceId}:${worker.workerName}`, 64).toString("hex");
  if (!timingSafeEqual(Buffer.from(credentialHash, "hex"), Buffer.from(worker.credentialHash, "hex"))) { res.status(401).json({ error: "Invalid worker authentication" }); return; }
  const expected = createHmac("sha256", credential).update(canonical(req, timestamp, nonce)).digest("hex");
  const supplied = Buffer.from(signature, "hex"); const expectedBytes = Buffer.from(expected, "hex");
  if (supplied.length !== expectedBytes.length || !timingSafeEqual(supplied, expectedBytes)) { res.status(401).json({ error: "Invalid worker authentication" }); return; }
  try {
    await db.insert(nativeMediaWorkerNoncesTable).values({ workspaceId: worker.workspaceId, workerId: worker.id, nonce, expiresAt: new Date(Date.now() + 60_000) });
  } catch { res.status(409).json({ error: "Worker request nonce was already used" }); return; }
  (req as any).nativeWorker = { id: worker.id, workspaceId: worker.workspaceId };
  next();
}
function bootstrapAuth(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const secret = process.env["NATIVE_MEDIA_BOOTSTRAP_SECRET"];
  const timestamp = req.header("x-native-worker-timestamp") ?? ""; const nonce = req.header("x-native-worker-nonce") ?? ""; const signature = req.header("x-native-worker-signature") ?? "";
  if (!secret || !/^\d{13}$/.test(timestamp) || nonce.length < 16 || Math.abs(Date.now() - Number(timestamp)) > 60_000) { res.status(401).json({ error: "Bootstrap authentication unavailable or expired" }); return; }
  const expected = createHmac("sha256", secret).update(canonical(req, timestamp, nonce)).digest("hex");
  const a = Buffer.from(signature, "hex"), b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(401).json({ error: "Invalid bootstrap authentication" }); return; } next();
}
internal.post("/register", bootstrapAuth, async (req, res) => {
  const body = z.object({ workspaceId: uuid, workerName: z.string().min(1).max(200), credential: z.string().min(32).max(1024), capabilities: z.array(z.object({ operation: operations, modelId: z.string().optional(), modelRevision: z.string().optional(), licenseApproved: z.literal(true), resolutions: z.array(z.string()).optional(), maxFps: z.number().positive().optional(), maxDurationSeconds: z.number().positive().optional(), vramMb: z.number().int().positive().optional() })), gpuInfo: z.record(z.string(), z.unknown()).default({}), runtimeInfo: z.record(z.string(), z.unknown()).default({}) }).parse(req.body);
  res.json({ worker: await registerNativeWorker(body.workspaceId, body.workerName, body.credential, body.capabilities, body.gpuInfo, body.runtimeInfo) });
});
internal.use(workerAuth);
function principal(req: import("express").Request) { return (req as any).nativeWorker as { id: string; workspaceId: string }; }
internal.post("/heartbeat", async (req, res) => { const p = principal(req); res.json({ worker: await heartbeatNativeWorker(p.workspaceId, p.id) }); });
internal.post("/lease", async (req, res) => {
  const p = principal(req); const job = await leaseNativeJob(p.workspaceId, p.id);
  // Object access grants are intentionally not minted here: the configured object
  // store cannot issue object-bound one-time grants. Returning only opaque keys is
  // fail-closed; workers must use a separately configured least-privilege broker.
  res.json({ job });
});
internal.get("/jobs/:jobId/inputs/:index", async (req, res) => {
  const p = principal(req);
  const token = req.header("x-native-lease-token") ?? "";
  const job = await assertNativeLease(p.workspaceId, p.id, uuid.parse(req.params.jobId), token);
  if (!["leased", "running"].includes(job.status)) throw new Error("Job is not active");
  const index = Number(req.params.index);
  const input = (job.inputObjects as Array<{ key: string; sha256: string; mimeType?: string }>)[index];
  const prefix = `native-media/${p.workspaceId}/`;
  if (!Number.isSafeInteger(index) || !input || !input.key.startsWith(prefix)) { res.status(404).json({ error: "Input object unavailable" }); return; }
  res.setHeader("Content-Type", input.mimeType ?? "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  createGCSObjectStream(input.key).on("error", () => res.destroy()).pipe(res);
});
internal.put("/jobs/:jobId/output", async (req, res) => {
  const p = principal(req); const jobId = uuid.parse(req.params.jobId);
  const token = req.header("x-native-lease-token") ?? "";
  const job = await assertNativeLease(p.workspaceId, p.id, jobId, token);
  if (!["leased", "running"].includes(job.status)) { res.status(409).json({ error: "Job is not active" }); return; }
  const mime = (req.header("content-type") ?? "").split(";")[0]!;
  const allowed = new Set(["video/mp4", "video/webm", "audio/wav", "audio/mpeg", "image/png", "image/jpeg"]);
  const length = Number(req.header("content-length") ?? "");
  const max = 2 * 1024 * 1024 * 1024;
  if (!allowed.has(mime) || !Number.isSafeInteger(length) || length <= 0 || length > max) { res.status(413).json({ error: "Output MIME or size is not allowed" }); return; }
  const temp = path.join(os.tmpdir(), `native-media-${jobId}-${randomUUID()}`);
  const hash = createHash("sha256"); let bytes = 0;
  const meter = new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; if (bytes > max) callback(new Error("Output too large")); else { hash.update(chunk); callback(null, chunk); } } });
  try {
    await pipeline(req, meter, createWriteStream(temp, { flags: "wx" }));
    if (bytes !== length) throw new Error("Content-Length mismatch");
    const sha256 = hash.digest("hex");
    const signedHash = req.header("x-native-body-sha256") ?? "";
    if (sha256 !== signedHash) { res.status(400).json({ error: "Output body hash mismatch" }); return; }
    const existing = (job.outputObjects as Array<{ key: string; sha256: string; size?: number; mimeType?: string }>)[0];
    if (existing) {
      if (existing.sha256 !== sha256) { res.status(409).json({ error: "A different output is already staged" }); return; }
      res.json({ output: existing }); return;
    }
    let evidence;
    try { evidence = await verifyMediaContract(temp, mime, job.request as Record<string, unknown>); }
    catch { res.status(422).json({ error: "Output does not satisfy the requested media contract" }); return; }
    await assertNativeLease(p.workspaceId, p.id, jobId, token);
    const key = `native-media/${p.workspaceId}/${job.videoProjectId}/${job.id}/output-${sha256.slice(0, 16)}`;
    await uploadFileToGCS(temp, key, mime, { sha256 });
    const staged = { key, sha256, size: bytes, mimeType: mime, evidence };
    const [updated] = await db.update(nativeMediaJobsTable).set({ outputObjects: [staged], updatedAt: new Date() }).where(and(eq(nativeMediaJobsTable.id, jobId), eq(nativeMediaJobsTable.workspaceId, p.workspaceId), eq(nativeMediaJobsTable.leasedWorkerId, p.id), eq(nativeMediaJobsTable.leaseToken, token))).returning({ id: nativeMediaJobsTable.id });
    if (!updated) { res.status(409).json({ error: "Lease expired during upload" }); return; }
    res.status(201).json({ output: staged });
  } finally { await rm(temp, { force: true }); }
});
const leaseBody = z.object({ jobId: uuid, leaseToken: uuid });
internal.post("/ack", async (req, res) => { const b = leaseBody.parse(req.body), p = principal(req); res.json({ job: await acknowledgeNativeJob(p.workspaceId, p.id, b.jobId, b.leaseToken) }); });
internal.post("/progress", async (req, res) => { const b = leaseBody.extend({ progress: z.number() }).parse(req.body), p = principal(req); await progressNativeJob(p.workspaceId, p.id, b.jobId, b.leaseToken, b.progress); res.status(204).end(); });
internal.post("/renew", async (req, res) => { const b = leaseBody.parse(req.body), p = principal(req); res.json({ job: await renewNativeLease(p.workspaceId, p.id, b.jobId, b.leaseToken) }); });
internal.post("/complete", async (req, res) => {
  const b = leaseBody.extend({ telemetry: z.object({ modelId: z.string(), modelRevision: z.string().optional(), modelLicense: z.string().optional(), gpu: z.record(z.string(), z.unknown()).optional(), runtime: z.record(z.string(), z.unknown()).optional(), executionBackend: z.enum(["cpu", "gpu"]), gpuSeconds: z.string(), estimatedGpuCost: z.string() }) }).strict().parse(req.body);
  const p = principal(req); res.json({ job: await completeNativeJob(p.workspaceId, p.id, b.jobId, b.leaseToken, b.telemetry) });
});
internal.post("/fail", async (req, res) => { const b = leaseBody.extend({ message: z.string().min(1).max(2000) }).parse(req.body), p = principal(req); await failNativeJob(p.workspaceId, p.id, b.jobId, b.leaseToken, b.message); res.status(204).end(); });

export { tenant as nativeMediaRouter, internal as nativeMediaInternalRouter };
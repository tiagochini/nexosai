/**
 * Native-only media control plane. It deliberately contains no provider client
 * and accepts only private object keys (never URLs, bytes, or credentials).
 */
import { and, desc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import {
  db, nativeMediaConsentsTable, nativeMediaJobEventsTable, nativeMediaJobsTable,
  nativeMediaProvenanceTable, nativeMediaUsageTable, nativeMediaWorkersTable,
  videoProjectsTable, type NativeMediaJob,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { randomUUID, scryptSync } from "node:crypto";
import { getGCSObjectMeta } from "../../lib/gcs-recordings.js";
import { getApprovedMasterplan } from "../masterplan/masterplan.service.js";

export type NativeOperation = "text_to_video" | "image_to_video" | "avatar_animation" | "voice_clone" | "tts" | "lip_sync" | "upscale" | "timeline_render" | "qc_extract";
type ObjectRef = { key: string; sha256: string; mimeType?: string };
type Capability = { operation: NativeOperation; modelId?: string; modelRevision?: string; licenseApproved?: boolean; resolutions?: string[]; maxFps?: number; maxDurationSeconds?: number; vramMb?: number };
const HEARTBEAT_MS = 90_000;
const hexHash = /^[a-f0-9]{64}$/i;
const privateKey = /^[a-z0-9][a-z0-9/_\-.]{2,1023}$/i;
let objectMetadataVerifier: typeof getGCSObjectMeta = getGCSObjectMeta;

/** Test-only seam: production always verifies metadata through configured GCS. */
export function setNativeObjectMetadataVerifierForTest(verifier: typeof getGCSObjectMeta | null) {
  if (process.env["NODE_ENV"] !== "test") throw new Error("Object metadata verifier may only be replaced in tests");
  objectMetadataVerifier = verifier ?? getGCSObjectMeta;
}

function validRef(ref: ObjectRef) { return privateKey.test(ref.key) && hexHash.test(ref.sha256) && !ref.key.includes("://"); }
function needsConsent(operation: NativeOperation) {
  return operation === "voice_clone" || operation === "tts" || operation === "avatar_animation" || operation === "lip_sync";
}
function consentTypesFor(operation: NativeOperation): Array<"voice_clone" | "voice_synthesis" | "likeness" | "avatar_animation" | "lip_sync"> {
  switch (operation) {
    case "voice_clone": return ["voice_clone"];
    case "tts": return ["voice_synthesis", "voice_clone"];
    case "avatar_animation": return ["avatar_animation", "likeness"];
    case "lip_sync": return ["lip_sync", "likeness"];
    default: return [];
  }
}
function capabilityMatches(c: Capability, j: NativeMediaJob, request: Record<string, unknown>) {
  if (c.operation !== j.operation || c.licenseApproved !== true) return false;
  if (j.requestedModelId && c.modelId !== j.requestedModelId) return false;
  if (j.requestedModelRevision && c.modelRevision !== j.requestedModelRevision) return false;
  if (request.resolution && !c.resolutions?.includes(String(request.resolution))) return false;
  if (request.fps && (!c.maxFps || Number(request.fps) > c.maxFps)) return false;
  if (request.durationSeconds && (!c.maxDurationSeconds || Number(request.durationSeconds) > c.maxDurationSeconds)) return false;
  if (request.minVramMb && (!c.vramMb || Number(request.minVramMb) > c.vramMb)) return false;
  return true;
}

export async function nativeCapabilities(workspaceId: string) {
  const cutoff = new Date(Date.now() - HEARTBEAT_MS);
  const workers = await db.select().from(nativeMediaWorkersTable).where(and(eq(nativeMediaWorkersTable.workspaceId, workspaceId), eq(nativeMediaWorkersTable.healthy, true), gt(nativeMediaWorkersTable.lastHeartbeatAt, cutoff), isNull(nativeMediaWorkersTable.disabledAt)));
  return { available: workers.length > 0, workers: workers.map(w => ({ id: w.id, name: w.workerName, capabilities: w.capabilities, gpu: w.gpuInfo, runtime: w.runtimeInfo, lastHeartbeatAt: w.lastHeartbeatAt })) };
}
export async function recordNativeConsent(workspaceId: string, input: { subjectReference: string; consentType: "voice_clone" | "voice_synthesis" | "likeness" | "avatar_animation" | "lip_sync"; evidenceObjectKey: string; evidenceSha256: string; metadata?: Record<string, unknown> }) {
  if (!privateKey.test(input.evidenceObjectKey) || !hexHash.test(input.evidenceSha256)) throw new AppError(400, "Consent evidence must be a private object key and SHA-256 hash", "INVALID_OBJECT_REFERENCE");
  const [consent] = await db.insert(nativeMediaConsentsTable).values({ workspaceId, ...input, metadata: input.metadata ?? {} }).returning();
  return consent!;
}
export async function revokeNativeConsent(workspaceId: string, consentId: string) {
  return db.transaction(async tx => {
    const [consent] = await tx.update(nativeMediaConsentsTable).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(nativeMediaConsentsTable.id, consentId), eq(nativeMediaConsentsTable.workspaceId, workspaceId), isNull(nativeMediaConsentsTable.revokedAt))).returning();
    if (!consent) throw new NotFoundError("Consentimento");
    const jobs = await tx.update(nativeMediaJobsTable).set({ status: "cancelled", cancelRequestedAt: new Date(), completedAt: new Date(), errorCode: "CONSENT_REVOKED" }).where(and(eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.consentId, consentId), inArray(nativeMediaJobsTable.status, ["queued", "leased", "running"]))).returning({ id: nativeMediaJobsTable.id, videoProjectId: nativeMediaJobsTable.videoProjectId });
    if (jobs.length) await tx.insert(nativeMediaJobEventsTable).values(jobs.map(job => ({ workspaceId, videoProjectId: job.videoProjectId, jobId: job.id, eventType: "cancelled" as const, details: { reason: "consent_revoked" } })));
    return consent;
  });
}

export async function submitNativeJob(workspaceId: string, videoProjectId: string, input: { operation: NativeOperation; request?: Record<string, unknown>; inputObjects?: ObjectRef[]; modelId?: string; modelRevision?: string; requiredLicense?: string; consentSubject?: string; maxAttempts?: number; idempotencyKey?: string; masterplanVersionId?: string; contextFingerprint?: string }) {
  if (input.idempotencyKey && !/^[a-zA-Z0-9:_-]{8,200}$/.test(input.idempotencyKey)) throw new AppError(400, "Idempotency key is invalid", "INVALID_IDEMPOTENCY_KEY");
  const [project] = await db.select({ id: videoProjectsTable.id, campaignId: videoProjectsTable.campaignId }).from(videoProjectsTable).where(and(eq(videoProjectsTable.id, videoProjectId), eq(videoProjectsTable.workspaceId, workspaceId))).limit(1);
  if (!project) throw new NotFoundError("Projeto de vídeo");
  if (input.idempotencyKey) {
    const [existing] = await db.select().from(nativeMediaJobsTable).where(and(eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.videoProjectId, videoProjectId), eq(nativeMediaJobsTable.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing) return existing;
  }
  // A campaign-bound render is an execution boundary, not planning output. It
  // must resolve the same approved dossier that authorized the operation.
  const approved = project.campaignId ? await getApprovedMasterplan(workspaceId, project.campaignId) : undefined;
  if (project.campaignId && !approved) throw new AppError(428, "A campaign video job requires an approved Masterplan snapshot", "MASTERPLAN_APPROVAL_REQUIRED");
  if (approved && ((input.masterplanVersionId && input.masterplanVersionId !== approved.id) || (input.contextFingerprint && input.contextFingerprint !== approved.contextFingerprint))) {
    throw new AppError(409, "Video job dossier binding does not match the approved snapshot", "MASTERPLAN_CONTEXT_MISMATCH");
  }
  const refs = input.inputObjects ?? [];
  if (!refs.every(validRef)) throw new AppError(400, "Inputs must be private object keys with SHA-256 hashes", "INVALID_OBJECT_REFERENCE");
  if (needsConsent(input.operation)) {
    if (!input.consentSubject) throw new AppError(403, "Explicit non-revoked likeness/voice consent is required", "CONSENT_REQUIRED");
    const consent = await db.select({ id: nativeMediaConsentsTable.id }).from(nativeMediaConsentsTable).where(and(eq(nativeMediaConsentsTable.workspaceId, workspaceId), eq(nativeMediaConsentsTable.subjectReference, input.consentSubject), inArray(nativeMediaConsentsTable.consentType, consentTypesFor(input.operation)), isNull(nativeMediaConsentsTable.revokedAt))).limit(1);
    if (!consent.length) throw new AppError(403, "Explicit non-revoked likeness/voice consent is required", "CONSENT_REQUIRED");
  }
  const capabilities = await nativeCapabilities(workspaceId);
  const probe = { operation: input.operation, requestedModelId: input.modelId ?? null, requestedModelRevision: input.modelRevision ?? null, request: input.request ?? {} } as NativeMediaJob;
  if (!capabilities.workers.some(w => (w.capabilities as Capability[]).some(c => capabilityMatches(c, probe, input.request ?? {})))) {
    throw new AppError(503, "No healthy native worker can satisfy this request", "NATIVE_WORKER_UNAVAILABLE");
  }
  return db.transaction(async tx => {
    const consentId = needsConsent(input.operation) ? (await tx.select({ id: nativeMediaConsentsTable.id }).from(nativeMediaConsentsTable).where(and(eq(nativeMediaConsentsTable.workspaceId, workspaceId), eq(nativeMediaConsentsTable.subjectReference, input.consentSubject!), inArray(nativeMediaConsentsTable.consentType, consentTypesFor(input.operation)), isNull(nativeMediaConsentsTable.revokedAt))).limit(1))[0]?.id : undefined;
    if (needsConsent(input.operation) && !consentId) throw new AppError(403, "Consent was revoked before enqueue", "CONSENT_REQUIRED");
    const [job] = await tx.insert(nativeMediaJobsTable).values({ workspaceId, videoProjectId, operation: input.operation, requestedModelId: input.modelId, requestedModelRevision: input.modelRevision, requiredLicense: input.requiredLicense, consentId, request: input.request ?? {}, inputObjects: refs, maxAttempts: input.maxAttempts ?? 3, idempotencyKey: input.idempotencyKey, masterplanVersionId: approved?.id, contextFingerprint: approved?.contextFingerprint }).returning();
    await tx.insert(nativeMediaJobEventsTable).values([
      { workspaceId, videoProjectId, jobId: job!.id, eventType: "planned", details: { evidenceState: "planned", masterplanVersionId: approved?.id ?? null, contextFingerprint: approved?.contextFingerprint ?? null } },
      { workspaceId, videoProjectId, jobId: job!.id, eventType: "submitted" },
    ]);
    return job!;
  });
}

export async function registerNativeWorker(workspaceId: string, workerName: string, credential: string, capabilities: Capability[], gpuInfo: Record<string, unknown>, runtimeInfo: Record<string, unknown>) {
  if (credential.length < 32) throw new AppError(400, "Worker credential must have at least 256 bits of entropy", "WEAK_WORKER_CREDENTIAL");
  const credentialHash = scryptSync(credential, `${workspaceId}:${workerName}`, 64).toString("hex");
  if (!capabilities.every(c => c.licenseApproved === true)) throw new AppError(400, "Workers may advertise only license-approved capabilities", "UNAPPROVED_LICENSE");
  const [worker] = await db.insert(nativeMediaWorkersTable).values({ workspaceId, workerName, credentialHash, capabilities, gpuInfo, runtimeInfo, healthy: true, lastHeartbeatAt: new Date() }).onConflictDoUpdate({ target: [nativeMediaWorkersTable.workspaceId, nativeMediaWorkersTable.workerName], set: { credentialHash, capabilities, gpuInfo, runtimeInfo, healthy: true, disabledAt: null, lastHeartbeatAt: new Date(), updatedAt: new Date() } }).returning();
  return worker!;
}
export async function heartbeatNativeWorker(workspaceId: string, workerId: string) {
  const [worker] = await db.update(nativeMediaWorkersTable).set({ healthy: true, lastHeartbeatAt: new Date(), updatedAt: new Date() }).where(and(eq(nativeMediaWorkersTable.id, workerId), eq(nativeMediaWorkersTable.workspaceId, workspaceId), isNull(nativeMediaWorkersTable.disabledAt))).returning();
  if (!worker) throw new NotFoundError("Worker");
  return worker;
}

export async function leaseNativeJob(workspaceId: string, workerId: string) {
  await heartbeatNativeWorker(workspaceId, workerId);
  const worker = await db.select().from(nativeMediaWorkersTable).where(and(eq(nativeMediaWorkersTable.id, workerId), eq(nativeMediaWorkersTable.workspaceId, workspaceId))).limit(1);
  // Recovery happens in the lease path rather than a scheduler: an idle worker
  // can safely reclaim an abandoned job even when background processes are off.
  const expired = await db.update(nativeMediaJobsTable).set({ status: "queued", leaseToken: null, leasedWorkerId: null, leaseExpiresAt: null })
    .where(and(eq(nativeMediaJobsTable.workspaceId, workspaceId), inArray(nativeMediaJobsTable.status, ["leased", "running"]), lt(nativeMediaJobsTable.leaseExpiresAt, new Date()), isNull(nativeMediaJobsTable.cancelRequestedAt))).returning();
  if (expired.length) await db.insert(nativeMediaJobEventsTable).values(expired.map(job => ({ workspaceId, videoProjectId: job.videoProjectId, jobId: job.id, eventType: "lease_expired" as const })));
  const candidates = await db.select().from(nativeMediaJobsTable).where(and(eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.status, "queued"))).orderBy(nativeMediaJobsTable.submittedAt).limit(20);
  for (const candidate of candidates) {
    const matchedCapability = (worker[0]?.capabilities as Capability[]).find(c => capabilityMatches(c, candidate, candidate.request as Record<string, unknown>));
    if (!matchedCapability) continue;
    const token = randomUUID(); const expires = new Date(Date.now() + 60_000);
    const [job] = await db.update(nativeMediaJobsTable).set({ status: "leased", leasedWorkerId: workerId, leaseToken: token, leaseExpiresAt: expires, attempt: candidate.attempt + 1, request: { ...(candidate.request as Record<string, unknown>), selectedCapability: matchedCapability } }).where(and(eq(nativeMediaJobsTable.id, candidate.id), eq(nativeMediaJobsTable.status, "queued"))).returning();
    if (job) { await db.insert(nativeMediaJobEventsTable).values({ workspaceId, videoProjectId: job.videoProjectId, jobId: job.id, workerId, eventType: "leased", details: { leaseExpiresAt: expires.toISOString() } }); return { ...job, leaseToken: token }; }
  }
  return null;
}

export async function assertNativeLease(workspaceId: string, workerId: string, jobId: string, leaseToken: string) {
  const [job] = await db.select().from(nativeMediaJobsTable).where(and(eq(nativeMediaJobsTable.id, jobId), eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.leasedWorkerId, workerId), eq(nativeMediaJobsTable.leaseToken, leaseToken), gt(nativeMediaJobsTable.leaseExpiresAt, new Date()))).limit(1);
  if (!job) throw new AppError(409, "Lease is invalid or expired", "INVALID_LEASE");
  if (job.consentId) {
    const [consent] = await db.select({ id: nativeMediaConsentsTable.id }).from(nativeMediaConsentsTable).where(and(eq(nativeMediaConsentsTable.id, job.consentId), eq(nativeMediaConsentsTable.workspaceId, workspaceId), isNull(nativeMediaConsentsTable.revokedAt))).limit(1);
    if (!consent) throw new AppError(409, "Job consent has been revoked", "CONSENT_REVOKED");
  }
  return job;
}
export async function acknowledgeNativeJob(workspaceId: string, workerId: string, jobId: string, token: string) {
  const job = await assertNativeLease(workspaceId, workerId, jobId, token);
  const [updated] = await db.update(nativeMediaJobsTable).set({ status: "running", startedAt: job.startedAt ?? new Date(), leaseExpiresAt: new Date(Date.now() + 60_000) }).where(and(eq(nativeMediaJobsTable.id, jobId), eq(nativeMediaJobsTable.status, "leased"), eq(nativeMediaJobsTable.leaseToken, token))).returning();
  if (!updated) throw new AppError(409, "Job is no longer leasable", "INVALID_LEASE");
  await db.insert(nativeMediaJobEventsTable).values([
    { workspaceId, videoProjectId: job.videoProjectId, jobId, workerId, eventType: "attempted", details: { evidenceState: "attempted" } },
    { workspaceId, videoProjectId: job.videoProjectId, jobId, workerId, eventType: "acknowledged" },
  ]); return updated;
}
export async function progressNativeJob(workspaceId: string, workerId: string, jobId: string, token: string, progress: number) {
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new AppError(400, "Progress must be a finite percentage between 0 and 100", "INVALID_PROGRESS");
  const job = await assertNativeLease(workspaceId, workerId, jobId, token); if (job.status !== "running") throw new AppError(409, "Job is not running", "INVALID_STATUS");
  await db.update(nativeMediaJobsTable).set({ leaseExpiresAt: new Date(Date.now() + 60_000) }).where(eq(nativeMediaJobsTable.id, jobId));
  await db.insert(nativeMediaJobEventsTable).values({ workspaceId, videoProjectId: job.videoProjectId, jobId, workerId, eventType: "progress", details: { progress } });
}
export async function renewNativeLease(workspaceId: string, workerId: string, jobId: string, token: string) {
  const job = await assertNativeLease(workspaceId, workerId, jobId, token);
  if (!["leased", "running"].includes(job.status)) throw new AppError(409, "Job is not active", "INVALID_STATUS");
  const expires = new Date(Date.now() + 60_000);
  const [updated] = await db.update(nativeMediaJobsTable).set({ leaseExpiresAt: expires, updatedAt: new Date() }).where(and(
    eq(nativeMediaJobsTable.id, jobId), eq(nativeMediaJobsTable.workspaceId, workspaceId),
    eq(nativeMediaJobsTable.leasedWorkerId, workerId), eq(nativeMediaJobsTable.leaseToken, token),
    gt(nativeMediaJobsTable.leaseExpiresAt, new Date()), inArray(nativeMediaJobsTable.status, ["leased", "running"]),
  )).returning();
  if (!updated) throw new AppError(409, "Lease expired before renewal", "INVALID_LEASE");
  return updated;
}
export async function completeNativeJob(workspaceId: string, workerId: string, jobId: string, token: string, telemetry: { modelId: string; modelRevision?: string; modelLicense?: string; gpu?: Record<string, unknown>; runtime?: Record<string, unknown>; executionBackend: "cpu" | "gpu"; gpuSeconds: string; estimatedGpuCost: string }) {
  const job = await assertNativeLease(workspaceId, workerId, jobId, token);
  const gpuSeconds = Number(telemetry.gpuSeconds);
  if (!Number.isFinite(gpuSeconds) || gpuSeconds < 0) throw new AppError(400, "gpuSeconds must be a non-negative number", "INVALID_GPU_TELEMETRY");
  const [worker] = await db.select({ gpuInfo: nativeMediaWorkersTable.gpuInfo }).from(nativeMediaWorkersTable).where(and(eq(nativeMediaWorkersTable.id, workerId), eq(nativeMediaWorkersTable.workspaceId, workspaceId))).limit(1);
  const workerHasCuda = (worker?.gpuInfo as Record<string, unknown> | undefined)?.["cuda"] === true;
  if ((telemetry.executionBackend === "gpu" && (!workerHasCuda || gpuSeconds <= 0)) || (telemetry.executionBackend === "cpu" && gpuSeconds !== 0)) {
    throw new AppError(409, "Execution backend conflicts with worker GPU evidence", "GPU_TRUTH_MISMATCH");
  }
  const output = job.outputObjects as ObjectRef[];
  const selected = (job.request as Record<string, unknown>).selectedCapability as Capability | undefined;
  if (!selected) throw new AppError(409, "Leased capability evidence is missing", "CAPABILITY_EVIDENCE_MISSING");
  const modelId = selected.modelId ?? "deterministic-local";
  const modelRevision = selected.modelRevision;
  const prefix = `native-media/${workspaceId}/${job.videoProjectId}/${job.id}/`;
  if (!output.length || !output.every(o => validRef(o) && o.key.startsWith(prefix))) throw new AppError(409, "No server-staged output is available", "OUTPUT_NOT_STAGED");
  // A worker cannot self-attest an output. The control plane reads GCS metadata
  // itself before it materializes anything into tenant-visible provenance.
  for (const object of output) {
    let metadata: { sha256?: string };
    try { metadata = await objectMetadataVerifier(object.key); }
    catch { throw new AppError(409, "Output object is not owned by configured private storage", "OUTPUT_NOT_MATERIALIZED"); }
    if (metadata.sha256?.toLowerCase() !== object.sha256.toLowerCase()) throw new AppError(409, "Output SHA-256 metadata verification failed", "OUTPUT_HASH_MISMATCH");
  }
  return db.transaction(async tx => {
    const [done] = await tx.update(nativeMediaJobsTable).set({ status: "succeeded", outputObjects: output, completedAt: new Date(), leaseExpiresAt: null }).where(and(eq(nativeMediaJobsTable.id, jobId), eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.leasedWorkerId, workerId), eq(nativeMediaJobsTable.status, "running"), eq(nativeMediaJobsTable.leaseToken, token), gt(nativeMediaJobsTable.leaseExpiresAt, new Date()))).returning();
    if (!done) throw new AppError(409, "Job completion was rejected", "INVALID_LEASE");
    const truth = { executionBackend: telemetry.executionBackend, gpuSeconds: telemetry.gpuSeconds, workerCudaAdvertised: workerHasCuda, serverVerifiedOutput: true };
    await tx.insert(nativeMediaProvenanceTable).values(output.map(o => ({ workspaceId, videoProjectId: job.videoProjectId, jobId, workerId, outputObjectKey: o.key, outputSha256: o.sha256, modelId, modelRevision, modelLicense: job.requiredLicense, gpu: telemetry.gpu ?? truth, runtime: { ...(telemetry.runtime ?? {}), ...truth }, sourceInputs: job.inputObjects })));
    await tx.insert(nativeMediaUsageTable).values({ workspaceId, videoProjectId: job.videoProjectId, jobId, workerId, modelId, gpuSeconds: telemetry.gpuSeconds, estimatedGpuCost: telemetry.estimatedGpuCost, telemetry: { ...truth, estimatedGpuCost: telemetry.estimatedGpuCost } });
    // Artifact verification is evidence of materialization only; QC and provider
    // confirmation are deliberately not implied by a successful local job.
    await tx.insert(nativeMediaJobEventsTable).values([
      { workspaceId, videoProjectId: job.videoProjectId, jobId, workerId, eventType: "artifact_qc", details: { evidenceState: "artifact_qc", status: "not_run", artifactServerVerified: true } },
      { workspaceId, videoProjectId: job.videoProjectId, jobId, workerId, eventType: "completed" },
    ]); return done;
  });
}
export async function failNativeJob(workspaceId: string, workerId: string, jobId: string, token: string, message: string) {
  const job = await assertNativeLease(workspaceId, workerId, jobId, token);
  if (!["leased", "running"].includes(job.status)) throw new AppError(409, "Job is not active", "INVALID_STATUS");
  const retry = job.attempt < job.maxAttempts && !job.cancelRequestedAt;
  await db.transaction(async tx => { await tx.update(nativeMediaJobsTable).set(retry ? { status: "queued", leaseToken: null, leasedWorkerId: null, leaseExpiresAt: null, errorMessage: message } : { status: "failed", errorMessage: message, completedAt: new Date() }).where(eq(nativeMediaJobsTable.id, jobId)); await tx.insert(nativeMediaJobEventsTable).values({ workspaceId, videoProjectId: job.videoProjectId, jobId, workerId, eventType: retry ? "retry_scheduled" : "failed", details: { message } }); });
}
export async function cancelNativeJob(workspaceId: string, videoProjectId: string, jobId: string) {
  const [job] = await db.update(nativeMediaJobsTable).set({ status: "cancelled", cancelRequestedAt: new Date(), completedAt: new Date() }).where(and(eq(nativeMediaJobsTable.id, jobId), eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.videoProjectId, videoProjectId), inArray(nativeMediaJobsTable.status, ["queued", "leased", "running"]))).returning();
  if (!job) throw new NotFoundError("Native media job"); await db.insert(nativeMediaJobEventsTable).values({ workspaceId, videoProjectId, jobId, eventType: "cancelled" }); return job;
}
export async function getNativeJob(workspaceId: string, videoProjectId: string, jobId: string) { const [job] = await db.select().from(nativeMediaJobsTable).where(and(eq(nativeMediaJobsTable.id, jobId), eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.videoProjectId, videoProjectId))).limit(1); if (!job) throw new NotFoundError("Native media job"); return job; }
/** Tenant-scoped evidence lineage. `provider_confirmed` is absent for native work
 * unless a provider adapter writes a receipt; completed never implies it. */
export async function nativeJobTelemetry(workspaceId: string, videoProjectId: string, jobId: string) {
  await getNativeJob(workspaceId, videoProjectId, jobId);
  return Promise.all([
    db.select().from(nativeMediaProvenanceTable).where(and(eq(nativeMediaProvenanceTable.workspaceId, workspaceId), eq(nativeMediaProvenanceTable.jobId, jobId))),
    db.select().from(nativeMediaUsageTable).where(and(eq(nativeMediaUsageTable.workspaceId, workspaceId), eq(nativeMediaUsageTable.jobId, jobId))),
    db.select().from(nativeMediaJobEventsTable).where(and(eq(nativeMediaJobEventsTable.workspaceId, workspaceId), eq(nativeMediaJobEventsTable.videoProjectId, videoProjectId), eq(nativeMediaJobEventsTable.jobId, jobId))).orderBy(nativeMediaJobEventsTable.createdAt),
  ]);
}
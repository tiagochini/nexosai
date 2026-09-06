/**
 * Database-backed control-plane regression coverage.  It creates only E2E_
 * fixtures and does not start schedulers, workers, model providers, or APIs.
 */
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  db, nativeMediaJobsTable, nativeMediaProvenanceTable, nativeMediaUsageTable,
  videoProjectsTable,
} from "@workspace/db";
import { AppError } from "../lib/errors.js";
import {
  acknowledgeNativeJob, cancelNativeJob, completeNativeJob, failNativeJob, getNativeJob,
  leaseNativeJob, nativeJobTelemetry, progressNativeJob, recordNativeConsent,
  registerNativeWorker, revokeNativeConsent, setNativeObjectMetadataVerifierForTest,
  submitNativeJob,
} from "../modules/video-production/native-media-engine.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

const hash = (letter: string) => letter.repeat(64);
const marker = markerFromSuffix(`native_media_${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const [primary, secondary] = fixtures.workspaces;
if (!primary || !secondary) throw new Error("native media fixture requires two workspaces");

const expectCode = async (code: string, fn: () => Promise<unknown>) => {
  await assert.rejects(fn, (error: unknown) => error instanceof AppError && error.code === code);
};
const project = async (workspaceId: string, title: string) => {
  const [row] = await db.insert(videoProjectsTable).values({
    workspaceId, title, format: "reels", config: {
      executionEngine: "native", hasUserFace: false, voiceStyle: "narrator", aspectRatio: "16:9",
      rhythm: "medium", tone: "inspirational", sourceMode: "hybrid",
      targetDurationsSeconds: [10], trailerPolicy: { enabled: false, durationsSeconds: [] }, totalCreditsUsed: 0,
    }, storyboard: [],
  }).returning();
  return row!;
};
const capability = {
  operation: "text_to_video" as const, modelId: "local-test", modelRevision: "r1",
  licenseApproved: true, resolutions: ["1920x1080"], maxFps: 30, maxDurationSeconds: 10, vramMb: 8192,
};

try {
  const p1 = await project(primary, `${marker} project one`);
  const p2 = await project(secondary, `${marker} project two`);

  // Availability is checked before an insert; this is the no-worker fail closed path.
  await expectCode("NATIVE_WORKER_UNAVAILABLE", () => submitNativeJob(primary, p1.id, {
    operation: "text_to_video", modelId: "local-test", modelRevision: "r1",
  }));
  assert.equal((await db.select().from(nativeMediaJobsTable).where(eq(nativeMediaJobsTable.videoProjectId, p1.id))).length, 0);

  const worker = await registerNativeWorker(primary, `${marker}-worker`, "a".repeat(32), [capability], { simulated: true }, { test: true });
  await expectCode("NATIVE_WORKER_UNAVAILABLE", () => submitNativeJob(primary, p1.id, {
    operation: "text_to_video", modelId: "wrong-model",
  }));
  const job = await submitNativeJob(primary, p1.id, {
    operation: "text_to_video", modelId: "local-test", modelRevision: "r1",
    request: { resolution: "1920x1080", fps: 30, durationSeconds: 10, minVramMb: 8192 },
  });
  assert.equal(job.status, "queued");

  // Tenant/project checks apply to jobs, status, cancellation, and provenance.
  await expectCode("NOT_FOUND", () => getNativeJob(secondary, p2.id, job.id));
  await expectCode("NOT_FOUND", () => cancelNativeJob(secondary, p2.id, job.id));
  await expectCode("NOT_FOUND", () => nativeJobTelemetry(secondary, p2.id, job.id));

  const leased = await leaseNativeJob(primary, worker.id);
  assert.equal(leased?.id, job.id);
  assert.ok(leased?.leaseToken);
  await acknowledgeNativeJob(primary, worker.id, job.id, leased!.leaseToken!);
  await expectCode("INVALID_PROGRESS", () => progressNativeJob(primary, worker.id, job.id, leased!.leaseToken!, 101));
  await progressNativeJob(primary, worker.id, job.id, leased!.leaseToken!, 50);

  // Prefix and hash are independently server-verified; neither can materialize usage.
  await expectCode("OUTPUT_NOT_STAGED", () => completeNativeJob(primary, worker.id, job.id, leased!.leaseToken!,
    { modelId: "local-test", gpuSeconds: "0", estimatedGpuCost: "0" }));
  setNativeObjectMetadataVerifierForTest(async () => ({ contentType: "video/mp4", size: 1, sha256: hash("b") }));
  const key = `native-media/${primary}/${p1.id}/${job.id}/result.mp4`;
  await db.update(nativeMediaJobsTable).set({ outputObjects: [{ key, sha256: hash("a") }] }).where(eq(nativeMediaJobsTable.id, job.id));
  await expectCode("OUTPUT_HASH_MISMATCH", () => completeNativeJob(primary, worker.id, job.id, leased!.leaseToken!,
    { modelId: "local-test", gpuSeconds: "0", estimatedGpuCost: "0" }));
  assert.equal((await nativeJobTelemetry(primary, p1.id, job.id))[0].length, 0);

  setNativeObjectMetadataVerifierForTest(async () => ({ contentType: "video/mp4", size: 1, sha256: hash("a") }));
  await completeNativeJob(primary, worker.id, job.id, leased!.leaseToken!,
    { modelId: "local-test", modelRevision: "r1", gpuSeconds: "0", estimatedGpuCost: "0" });
  const [provenance, usage] = await nativeJobTelemetry(primary, p1.id, job.id);
  assert.equal(provenance.length, 1); assert.equal(usage.length, 1);

  // Explicit operation-appropriate consent is required, and revocation takes effect.
  await expectCode("CONSENT_REQUIRED", () => submitNativeJob(primary, p1.id, { operation: "voice_clone", consentSubject: "actor" }));
  const consent = await recordNativeConsent(primary, {
    subjectReference: "actor", consentType: "voice_clone", evidenceObjectKey: `e2e/${marker}/consent.webm`, evidenceSha256: hash("c"),
  });
  await registerNativeWorker(primary, `${marker}-voice-worker`, "b".repeat(32), [{
    operation: "voice_clone", modelId: "local-voice", licenseApproved: true,
  }], { simulated: true }, { test: true });
  const voice = await submitNativeJob(primary, p1.id, { operation: "voice_clone", consentSubject: "actor" });
  assert.equal(voice.status, "queued");
  await revokeNativeConsent(primary, consent.id);
  await expectCode("CONSENT_REQUIRED", () => submitNativeJob(primary, p1.id, { operation: "voice_clone", consentSubject: "actor" }));

  // Two polling workers can only atomically acquire one queued job.
  const w2 = await registerNativeWorker(primary, `${marker}-worker-two`, "c".repeat(32), [capability], { simulated: true }, { test: true });
  const neverLeased = await submitNativeJob(primary, p1.id, { operation: "text_to_video", modelId: "local-test", modelRevision: "r1" });
  await cancelNativeJob(primary, p1.id, neverLeased.id);
  assert.equal((await getNativeJob(primary, p1.id, neverLeased.id)).status, "cancelled");
  const concurrent = await submitNativeJob(primary, p1.id, { operation: "text_to_video", modelId: "local-test", modelRevision: "r1" });
  const leases = await Promise.all([leaseNativeJob(primary, worker.id), leaseNativeJob(primary, w2.id)]);
  assert.equal(leases.filter((entry) => entry?.id === concurrent.id).length, 1);
  const active = leases.find((entry) => entry?.id === concurrent.id)!;
  await cancelNativeJob(primary, p1.id, concurrent.id);
  await expectCode("INVALID_STATUS", () => failNativeJob(primary, active!.leasedWorkerId!, concurrent.id, active!.leaseToken!, "cancelled worker"));

  // An expired lease is requeued from the polling path and may be retried.
  const retry = await submitNativeJob(primary, p1.id, { operation: "text_to_video", modelId: "local-test", modelRevision: "r1" });
  const first = await leaseNativeJob(primary, worker.id);
  assert.equal(first?.id, retry.id);
  await db.update(nativeMediaJobsTable).set({ leaseExpiresAt: new Date(Date.now() - 1_000) })
    .where(and(eq(nativeMediaJobsTable.id, retry.id), eq(nativeMediaJobsTable.workspaceId, primary)));
  const reclaimed = await leaseNativeJob(primary, w2.id);
  assert.equal(reclaimed?.id, retry.id);
  await failNativeJob(primary, w2.id, retry.id, reclaimed!.leaseToken!, "transient local failure");
  assert.equal((await getNativeJob(primary, p1.id, retry.id)).status, "queued");
  await cancelNativeJob(primary, p1.id, retry.id);

  assert.equal((await db.select().from(nativeMediaProvenanceTable).where(eq(nativeMediaProvenanceTable.jobId, job.id))).length, 1);
  assert.equal((await db.select().from(nativeMediaUsageTable).where(eq(nativeMediaUsageTable.jobId, job.id))).length, 1);
  console.log("native media control-plane integration passed");
} finally {
  setNativeObjectMetadataVerifierForTest(null);
  await cleanupE2eFixtures(fixtures);
}
import assert from "node:assert/strict";
import { nativeObjectGrants } from '../modules/video-production/native-object-grants.js';
import express from "express";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db, nativeMediaJobsTable, nativeMediaProvenanceTable, nativeMediaUsageTable, videoProjectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nativeMediaInternalRouter } from "../modules/video-production/native-media.routes.js";
import { registerNativeWorker, submitNativeJob } from "../modules/video-production/native-media-engine.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

const exec = promisify(execFile);
const marker = markerFromSuffix(`native_http_${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const workspaceId = fixtures.workspaces[0]!;
const root = await mkdtemp(path.join(os.tmpdir(), "native-http-"));
process.env.NODE_ENV = "test";
process.env.NATIVE_MEDIA_TEST_STORAGE_DIR = root;
const credential = randomBytes(32).toString("hex");

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function signed(method: string, url: string, workerId: string, body: Buffer) {
  const timestamp = String(Date.now()), nonce = randomBytes(18).toString("hex");
  const pathname = new URL(url).pathname;
  const digest = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", credential).update(`${timestamp}\n${nonce}\n${method}\n${pathname}\n${digest}`).digest("hex");
  return { timestamp, nonce, headers: { "x-native-worker-id": workerId, "x-native-worker-credential": credential, "x-native-worker-timestamp": timestamp, "x-native-worker-nonce": nonce, "x-native-worker-signature": signature, "x-native-body-sha256": digest } };
}
async function jsonCall(base: string, workerId: string, route: string, body: unknown, reuse?: ReturnType<typeof signed>) {
  const raw = Buffer.from(stable(body)); const auth = reuse ?? signed("POST", `${base}${route}`, workerId, raw);
  return fetch(`${base}${route}`, { method: "POST", headers: { ...auth.headers, "content-type": "application/json" }, body: raw });
}

let server: import("node:http").Server | undefined;
try {
  const [project] = await db.insert(videoProjectsTable).values({ workspaceId, title: `${marker} project`, format: "reels", config: { executionEngine: "native", hasUserFace: false, voiceStyle: "narrator", aspectRatio: "16:9", rhythm: "medium", tone: "cinematic", sourceMode: "synthetic", targetDurationsSeconds: [1], trailerPolicy: { enabled: false, durationsSeconds: [] }, totalCreditsUsed: 0 }, storyboard: [] }).returning();
  const capability = { operation: "text_to_video" as const, modelId: "http-local", modelRevision: "r1", licenseApproved: true, resolutions: ["16x16"], maxFps: 10, maxDurationSeconds: 2, vramMb: 1 };
  const worker = await registerNativeWorker(workspaceId, `${marker}-worker`, credential, [capability], {}, {});
  const otherCredential = randomBytes(32).toString("hex");
  const otherWorker = await registerNativeWorker(workspaceId, `${marker}-other`, otherCredential, [capability], {}, {});
  const inputKey = `native-media/${workspaceId}/fixture/input.bin`;
  const inputPath = path.join(root, inputKey); await mkdir(path.dirname(inputPath), { recursive: true }); await writeFile(inputPath, "tiny-input");
  const inputHash = createHash("sha256").update("tiny-input").digest("hex");
  const job = await submitNativeJob(workspaceId, project!.id, { operation: "text_to_video", modelId: "http-local", modelRevision: "r1", request: { width: 16, height: 16, fps: 10, durationSeconds: 1, resolution: "16x16" }, inputObjects: [{ key: inputKey, sha256: inputHash }] });
  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = Buffer.from(buf); } }));
  app.use("/internal/native-media", nativeMediaInternalRouter);
  app.use((err: any, _req: any, res: any, _next: any) => res.status(err.statusCode ?? 500).json({ error: err.message, code: err.code }));
  server = app.listen(0);
  await new Promise<void>(resolve => server!.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/internal/native-media`;

  const tamperRaw = Buffer.from(stable({ changed: true }));
  const tamperAuth = signed("POST", `${base}/lease`, worker.id, Buffer.from(stable({})));
  assert.equal((await fetch(`${base}/lease`, { method: "POST", headers: { ...tamperAuth.headers, "content-type": "application/json" }, body: tamperRaw })).status, 401);
  const pathAuth = signed("POST", `${base}/ack`, worker.id, Buffer.from(stable({})));
  assert.equal((await fetch(`${base}/lease`, { method: "POST", headers: { ...pathAuth.headers, "content-type": "application/json" }, body: Buffer.from(stable({})) })).status, 401);
  const staleRaw = Buffer.from(stable({})), staleNonce = randomBytes(18).toString("hex"), staleTimestamp = String(Date.now() - 120_000);
  const staleDigest = createHash("sha256").update(staleRaw).digest("hex");
  const staleSignature = createHmac("sha256", credential).update(`${staleTimestamp}\n${staleNonce}\nPOST\n${new URL(`${base}/lease`).pathname}\n${staleDigest}`).digest("hex");
  assert.equal((await fetch(`${base}/lease`, { method: "POST", headers: { "content-type": "application/json", "x-native-worker-id": worker.id, "x-native-worker-credential": credential, "x-native-worker-timestamp": staleTimestamp, "x-native-worker-nonce": staleNonce, "x-native-worker-signature": staleSignature }, body: staleRaw })).status, 401);

  const leaseRes = await jsonCall(base, worker.id, "/lease", {});
  assert.equal(leaseRes.status, 200); const leased = (await leaseRes.json() as any).job;
  const replayAuth = signed("POST", `${base}/ack`, worker.id, Buffer.from(stable({ jobId: job.id, leaseToken: leased.leaseToken })));
  assert.equal((await jsonCall(base, worker.id, "/ack", { jobId: job.id, leaseToken: leased.leaseToken }, replayAuth)).status, 200);
  assert.equal((await jsonCall(base, worker.id, "/ack", { jobId: job.id, leaseToken: leased.leaseToken }, replayAuth)).status, 409);
  assert.equal((await jsonCall(base, worker.id, "/renew", { jobId: job.id, leaseToken: leased.leaseToken })).status, 200);
  assert.equal((await jsonCall(base, worker.id, "/progress", { jobId: job.id, leaseToken: leased.leaseToken, progress: 25 })).status, 204);
  // A distinct authenticated worker cannot act on this lease.
  const otherRaw = Buffer.from(stable({ jobId: job.id, leaseToken: leased.leaseToken }));
  const ts = String(Date.now()), nonce = randomBytes(18).toString("hex"), digest = createHash("sha256").update(otherRaw).digest("hex");
  const sig = createHmac("sha256", otherCredential).update(`${ts}\n${nonce}\nPOST\n${new URL(`${base}/renew`).pathname}\n${digest}`).digest("hex");
  assert.equal((await fetch(`${base}/renew`, { method: "POST", headers: { "content-type": "application/json", "x-native-worker-id": otherWorker.id, "x-native-worker-credential": otherCredential, "x-native-worker-timestamp": ts, "x-native-worker-nonce": nonce, "x-native-worker-signature": sig }, body: otherRaw })).status, 409);

  const inputUrl = `${base}/jobs/${job.id}/inputs/0`; const getAuth = signed("GET", inputUrl, worker.id, Buffer.alloc(0));
  const grants = async () => (await (await jsonCall(base, worker.id, '/object-grants', { jobId: job.id, leaseToken: leased.leaseToken })).json() as any).objectAccess;
  const objectAccess = await grants();
  const [activeJob] = await db.select().from(nativeMediaJobsTable).where(eq(nativeMediaJobsTable.id, job.id)); assert.ok(activeJob);
  const download = (grant?: string) => fetch(inputUrl, { headers: { ...signed('GET', inputUrl, worker.id, Buffer.alloc(0)).headers,
    'x-native-lease-token': leased.leaseToken, ...(grant ? { 'x-native-object-grant': grant } : {}) } });
  assert.equal((await download()).status, 403);
  assert.equal((await download(nativeObjectGrants({ ...activeJob, leaseExpiresAt: new Date(Date.now() - 1) }).inputs[0]!.grant)).status, 403);
  assert.equal((await download(nativeObjectGrants({ ...activeJob, leasedWorkerId: otherWorker.id }).inputs[0]!.grant)).status, 403);
  assert.equal((await download(nativeObjectGrants({ ...activeJob, id: randomUUID() }).inputs[0]!.grant)).status, 403);
  assert.equal((await download(objectAccess.output.grant)).status, 403, 'write grants cannot read inputs');
  assert.equal((await download(objectAccess.inputs[0].grant + 'x')).status, 403);
  const inputRes = await download(objectAccess.inputs[0].grant);
  assert.equal(inputRes.status, 200); assert.equal(await inputRes.text(), "tiny-input");
  assert.equal((await download(objectAccess.inputs[0].grant)).status, 409, 'grant is consumed once');
  const simultaneousGrant = (await grants()).inputs[0].grant;
  const concurrent = await Promise.all([download(simultaneousGrant), download(simultaneousGrant)]);
  assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 409]);
  await Promise.all(concurrent.map(response => response.text()));

  const video = path.join(root, "fixture.mp4");
  await exec("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=black:s=16x16:r=10:d=1", "-pix_fmt", "yuv420p", video]);
  const bytes = await readFile(video); const outputUrl = `${base}/jobs/${job.id}/output`; const putAuth = signed("PUT", outputUrl, worker.id, bytes);
  const put = await fetch(outputUrl, { method: "PUT", headers: { ...putAuth.headers, "x-native-object-grant": (await grants()).output.grant, "x-native-lease-token": leased.leaseToken, "content-type": "video/mp4", "content-length": String(bytes.length) }, body: bytes });
  assert.equal(put.status, 201, await put.text());
  assert.equal((await jsonCall(base, worker.id, "/complete", { jobId: job.id, leaseToken: leased.leaseToken, telemetry: { modelId: "forged", executionBackend: "cpu", gpuSeconds: "0", estimatedGpuCost: "0" } })).status, 200);
  assert.equal((await db.select().from(nativeMediaJobsTable).where(eq(nativeMediaJobsTable.id, job.id)))[0]?.status, "succeeded");
  assert.equal((await db.select().from(nativeMediaProvenanceTable).where(eq(nativeMediaProvenanceTable.jobId, job.id))).length, 1);
  assert.equal((await db.select().from(nativeMediaUsageTable).where(eq(nativeMediaUsageTable.jobId, job.id))).length, 1);
  assert.equal((await jsonCall(base, worker.id, '/object-grants', { jobId: job.id, leaseToken: leased.leaseToken })).status, 409, 'completed jobs cannot mint grants');
  console.log("native media real HTTP canonical/streaming integration passed");
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await cleanupE2eFixtures(fixtures).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
}

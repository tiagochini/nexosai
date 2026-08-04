/**
 * Minimal GCS client for persisting recording videos.
 * Uses Replit sidecar authentication (no API key needed).
 */
import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR = "http://127.0.0.1:1106";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as any,
  projectId: "",
});

function bucketId(): string {
  const id = process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"] ?? "";
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return id;
}

/** GCS object key convention for recordings. */
export function recordingObjectKey(recordingId: string): string {
  return `recordings/${recordingId}.webm`;
}

/** Returns true if a videoPath value points to GCS (not local disk). */
export function isGCSKey(videoPath: string): boolean {
  return videoPath.startsWith("recordings/");
}

/**
 * Upload a local .webm file to GCS. Returns the object key.
 * Uses non-resumable upload (files are typically < 2 GB).
 */
export async function uploadRecordingToGCS(
  localPath: string,
  recordingId: string,
): Promise<string> {
  const key = recordingObjectKey(recordingId);
  await gcs.bucket(bucketId()).upload(localPath, {
    destination: key,
    contentType: "video/webm",
    resumable: false,
  });
  return key;
}

/** Get the total byte size of a GCS recording. */
export async function getGCSRecordingSize(objectKey: string): Promise<number> {
  const [meta] = await gcs.bucket(bucketId()).file(objectKey).getMetadata();
  return parseInt(meta.size as string, 10);
}

/** Create a byte-range read stream from GCS (for Range-header support). */
export function createGCSReadStream(
  objectKey: string,
  opts?: { start?: number; end?: number },
) {
  return gcs.bucket(bucketId()).file(objectKey).createReadStream(opts ?? {});
}

/** GCS object key convention for persona cloning media (training/consent videos). */
export function personaMediaObjectKey(workspaceId: string, kind: "training" | "consent"): string {
  return `persona-media/${workspaceId}/${kind}-${Date.now()}.webm`;
}

/** Upload a raw buffer to GCS at an arbitrary key. Returns the object key. */
export async function uploadBufferToGCS(
  buf: Buffer,
  key: string,
  contentType = "video/webm",
): Promise<string> {
  await gcs.bucket(bucketId()).file(key).save(buf, { contentType, resumable: false });
  return key;
}

/** GCS object key convention for presence-post storyboard frames (internal preview). */
export function presenceStoryboardObjectKey(workspaceId: string, postId: string, frameIndex: number): string {
  return `presence-storyboard/${workspaceId}/${postId}/frame-${frameIndex}.png`;
}

/** GCS object key convention for user-uploaded presence-post media. */
export function presenceMediaObjectKey(workspaceId: string, postId: string, filename: string): string {
  return `presence-media/${workspaceId}/${postId}/${filename}`;
}

/** Create a read stream for any GCS object key. */
export function createGCSObjectStream(
  objectKey: string,
  opts?: { start?: number; end?: number },
) {
  return gcs.bucket(bucketId()).file(objectKey).createReadStream(opts ?? {});
}

/** Get content type + size for a GCS object. */
export async function getGCSObjectMeta(objectKey: string): Promise<{ contentType: string; size: number }> {
  const [meta] = await gcs.bucket(bucketId()).file(objectKey).getMetadata();
  return {
    contentType: (meta.contentType as string) ?? "application/octet-stream",
    size: parseInt(meta.size as string, 10),
  };
}

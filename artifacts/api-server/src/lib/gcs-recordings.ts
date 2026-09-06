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

/**
 * GCS object key for persona cloning media (training/consent videos).
 * Intentionally stable — no timestamp — so recovery checks and retries can
 * always find the same key regardless of when they run.
 * Each new upload of the same kind overwrites the previous one.
 */
export function personaMediaObjectKey(workspaceId: string, kind: "training" | "consent"): string {
  return `persona-media/${workspaceId}/${kind}.webm`;
}

/**
 * Generate a GCS V4 Signed URL for a persona-media file so that external
 * providers (HeyGen) can download it directly from GCS without going through
 * our API server.  Returns null if the current credentials don't support signing
 * (e.g. Replit external_account sidecar without signBlob permission).
 */
export async function getPersonaMediaSignedUrl(
  objectKey: string,
  ttlSeconds = 7200,
): Promise<string | null> {
  try {
    const [url] = await gcs
      .bucket(bucketId())
      .file(objectKey)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + ttlSeconds * 1000,
      });
    return url;
  } catch {
    return null;
  }
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

/** Upload a local file without reading the complete file into application memory. */
export async function uploadFileToGCS(
  localPath: string,
  key: string,
  contentType = "application/octet-stream",
): Promise<string> {
  await gcs.bucket(bucketId()).upload(localPath, {
    destination: key,
    contentType,
    resumable: true,
  });
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

/**
 * Attempt to generate a GCS V4 Signed URL for a presence-media object.
 * Returns the signed URL string on success, or null if the GCS credentials
 * do not support signing (e.g. Replit external_account sidecar without
 * iam.serviceAccounts.signBlob permission).
 *
 * Callers should fall back to a server-issued short-lived token when null is returned.
 */
export async function getPresenceMediaSignedUrl(
  objectKey: string,
  ttlSeconds = 1800,
): Promise<string | null> {
  try {
    const [url] = await gcs
      .bucket(bucketId())
      .file(objectKey)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + ttlSeconds * 1000,
      });
    return url;
  } catch {
    // Signing not supported with current credentials — caller will use server token.
    return null;
  }
}

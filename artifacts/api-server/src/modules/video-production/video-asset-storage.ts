import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { open, rm } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import os from "node:os";
import path from "node:path";
import { uploadFileToGCS } from "../../lib/gcs-recordings.js";
import { AppError } from "../../lib/errors.js";
import { allowedMediaHost } from "../creatives/kairogen-runtime.js";

const MAX_GENERATED_VIDEO_BYTES = 1024 * 1024 * 1024;

export function videoProjectObjectKey(
  workspaceId: string,
  projectId: string,
  sceneId: string,
  variant: "preview" | "final",
  extension = "mp4",
  campaignId?: string | null,
): string {
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!safeExtension) throw new Error("Invalid video extension");
  const root = campaignId
    ? `campaigns/${workspaceId}/${campaignId}/video-projects/${projectId}`
    : `video-projects/${workspaceId}/${projectId}`;
  return `${root}/scenes/${sceneId}/${variant}.${safeExtension}`;
}

export function isStoredVideoKey(value: string | undefined): value is string {
  return Boolean(value && (value.startsWith("video-projects/") || value.startsWith("campaigns/") || value.startsWith("native-media/")));
}

export async function persistProviderVideo(
  sourceUrl: string,
  workspaceId: string,
  projectId: string,
  sceneId: string,
  variant: "preview" | "final",
  campaignId?: string | null,
): Promise<string> {
  let source: URL;
  try { source = new URL(sourceUrl); } catch { throw new AppError(502, "O provedor retornou uma URL de vídeo inválida", "VIDEO_OUTPUT_UNAVAILABLE"); }
  if (source.protocol !== "https:" || source.username || source.password || !allowedMediaHost(source.hostname)) {
    throw new AppError(502, "O provedor retornou um endereço de vídeo não autorizado", "VIDEO_OUTPUT_UNAVAILABLE");
  }
  const response = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(180_000) });
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() ?? "";
  if (!response.ok || !response.body || !["video/mp4", "video/webm", "application/octet-stream"].includes(contentType)) {
    await response.body?.cancel().catch(() => {});
    throw new AppError(502, "Não foi possível obter o vídeo final do provedor", "VIDEO_OUTPUT_UNAVAILABLE");
  }

  const extension = contentType === "video/webm" || (contentType === "application/octet-stream" && source.pathname.toLowerCase().endsWith(".webm")) ? "webm" : "mp4";
  const storedContentType = extension === "webm" ? "video/webm" : "video/mp4";
  const objectKey = videoProjectObjectKey(workspaceId, projectId, sceneId, variant, extension, campaignId);
  const tempPath = path.join(os.tmpdir(), `nexos-video-${randomUUID()}.${extension}`);
  const hash = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_GENERATED_VIDEO_BYTES) callback(new Error("Generated video exceeds the storage limit"));
      else { hash.update(chunk); callback(null, chunk); }
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), meter, createWriteStream(tempPath, { flags: "wx" }));
    if (!bytes) throw new Error("Generated video was empty");
    const file = await open(tempPath, "r");
    try {
      const signature = Buffer.alloc(12);
      const { bytesRead } = await file.read(signature, 0, signature.length, 0);
      const valid = extension === "webm"
        ? bytesRead >= 4 && signature.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
        : bytesRead >= 8 && signature.toString("ascii", 4, 8) === "ftyp";
      if (!valid) throw new Error("Generated video signature is invalid");
    } finally { await file.close(); }
    await uploadFileToGCS(tempPath, objectKey, storedContentType, { sha256: hash.digest("hex") });
    return objectKey;
  } finally {
    await rm(tempPath, { force: true });
  }
}

/**
 * The timeline is intentionally compiled, rather than interpreted piecemeal by
 * the renderer.  Keeping this module side-effect free makes its allow-list and
 * ffmpeg escaping testable without a database or a media worker.
 */
import { z } from "zod/v4";

const finite = z.number().finite();
const nonNegative = finite.min(0);
const bool = z.boolean();

export const trackSettingsSchema = z.object({
  mute: bool.optional(), solo: bool.optional(), visible: bool.optional(),
}).strict();
export const itemSettingsSchema = z.object({
  opacity: finite.min(0).max(1).optional(), volumeDb: finite.min(-96).max(24).optional(), pan: finite.min(-1).max(1).optional(),
  mute: bool.optional(), fadeInMs: nonNegative.optional(), fadeOutMs: nonNegative.optional(), playbackRate: finite.min(0.1).max(4).optional(),
  x: finite.optional(), y: finite.optional(), scale: finite.min(0.01).max(10).optional(), rotation: finite.min(-360).max(360).optional(),
  crop: z.object({ x: nonNegative, y: nonNegative, width: nonNegative.positive(), height: nonNegative.positive() }).strict().optional(),
  content: z.string().max(10_000).optional(), font: z.string().max(200).optional(), fontSize: finite.min(6).max(512).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  alignment: z.enum(["left", "center", "right"]).optional(), zOrder: z.number().int().min(-1000).max(1000).optional(),
  transition: z.enum(["cut", "crossfade", "dip-to-black"]).optional(), transitionDurationMs: nonNegative.max(10_000).optional(),
  exposure: finite.min(-3).max(3).optional(), contrast: finite.min(0).max(3).optional(), saturation: finite.min(0).max(3).optional(),
  temperature: finite.min(-1).max(1).optional(), tint: finite.min(-1).max(1).optional(),
}).strict();
export const timelineTrackSchema = z.object({
  id: z.string().uuid().optional(), trackType: z.enum(["video", "audio", "voiceover", "music", "graphics", "subtitles"]),
  name: z.string().trim().min(1).max(200), position: z.number().int().nonnegative(), settings: trackSettingsSchema.optional(),
}).strict();
export const timelineItemSchema = z.object({
  id: z.string().uuid().optional(), trackId: z.string().uuid(), assetId: z.string().uuid().optional(), position: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(), durationMs: z.number().int().positive(), trimStartMs: z.number().int().nonnegative().optional(),
  trimEndMs: z.number().int().nonnegative().optional(), settings: itemSettingsSchema.optional(),
}).strict();
export const projectRenderSchema = z.object({
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(50), z.literal(60)]).optional(),
  resolution: z.enum(["1920x1080", "1080x1920", "3840x2160", "2160x3840"]).optional(),
}).strict();

export function resolveRenderDimensions(resolution: unknown, aspectRatio: unknown) {
  const requested = resolution ?? (aspectRatio === "16:9" ? "1920x1080" : aspectRatio === "1:1" ? undefined : "1080x1920");
  if (!requested) throw new Error("Only 16:9 or 9:16 render aspect ratios are supported");
  if (!["1920x1080", "1080x1920", "3840x2160", "2160x3840"].includes(String(requested)))
    throw new Error(`Unsupported render resolution '${String(requested)}'; 8K is not supported`);
  const [width, height] = String(requested).split("x").map(Number);
  const ratio = width > height ? "16:9" : "9:16";
  if (aspectRatio && aspectRatio !== ratio) throw new Error(`Resolution ${requested} conflicts with project aspect ratio ${String(aspectRatio)}`);
  return { width, height, resolution: String(requested), is4k: width === 3840 || height === 3840 };
}
export const persistedTimelineSchema = z.object({
  expectedRevisionNumber: z.number().int().nonnegative().optional(),
  project: projectRenderSchema.optional(), tracks: z.array(timelineTrackSchema).max(100),
  items: z.array(timelineItemSchema).max(1000),
}).strict();

export type RenderTrack = z.infer<typeof timelineTrackSchema> & { id: string };
export type RenderItem = z.infer<typeof timelineItemSchema> & { id: string };
export type RenderAsset = { id: string; assetType: string; durationMs: number | null; localPath: string };

/** ffmpeg filter values use ':' and quotes as syntax, not shell syntax. */
export function escapeFilterText(value: string): string {
  // drawtext's nested quote grammar varies across supported ffmpeg builds.
  // A typographic apostrophe preserves readable caption text without allowing
  // a user quote to terminate the filter option.
  return value.replaceAll("\\", "\\\\").replaceAll("'", "’").replaceAll(":", "\\:").replaceAll(",", "\\,").replaceAll("\n", "\\n").replaceAll("\r", "");
}
const sec = (ms: number) => (ms / 1000).toFixed(3);

export function compileTimelineFilter(input: {
  tracks: RenderTrack[]; items: RenderItem[]; assets: RenderAsset[]; width: number; height: number; fps: number; durationMs: number; baseInput: number;
}) {
  const { tracks, items, assets, width, height, fps, durationMs, baseInput } = input;
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  for (const track of tracks) trackSettingsSchema.parse(track.settings ?? {});
  const solos = tracks.some((track) => track.settings?.solo);
  const enabled = (track: RenderTrack, visual: boolean) => !track.settings?.mute && (!solos || track.settings?.solo) && (!visual || track.settings?.visible !== false);
  const ordered = items.map((item, order) => ({ item, order, track: trackById.get(item.trackId) }))
    .sort((a, b) => (a.item.startMs - b.item.startMs) || (a.item.position - b.item.position) || a.order);
  const filters: string[] = [];
  let video = `v${baseInput}`;
  filters.push(`[${baseInput}:v]trim=duration=${sec(durationMs)},setpts=PTS-STARTPTS[${video}]`);
  const audio: string[] = [];
  const inputIndexByAsset = new Map(assets.map((asset, index) => [asset.id, baseInput + 1 + index]));
  let serial = 0;
  for (const { item, track } of ordered) {
    if (!track) throw new Error(`Timeline item ${item.id} references an unknown track`);
    // Revalidate persisted JSON. Older rows and internal callers must not be
    // able to bypass the public request schema and silently lose an effect.
    const settings = itemSettingsSchema.parse(item.settings ?? {});
    const isText = track.trackType === "subtitles" || (!item.assetId && (track.trackType === "graphics" || track.trackType === "video"));
    const asset = item.assetId ? assetById.get(item.assetId) : undefined;
    if (item.assetId && !asset) throw new Error(`Timeline item ${item.id} references an asset outside this project`);
    if (!asset && !isText) throw new Error(`Timeline item ${item.id} requires a source asset`);
    if (asset && ["video", "graphics"].includes(track.trackType) && !["video", "image", "graphic"].includes(asset.assetType))
      throw new Error(`Visual track item ${item.id} requires a video, image, or graphic asset`);
    if (asset && ["audio", "voiceover", "music"].includes(track.trackType) && !["audio", "video"].includes(asset.assetType))
      throw new Error(`Audio track item ${item.id} requires an audio or video asset`);
    if (asset && track.trackType === "subtitles") throw new Error(`Subtitle asset files are unsupported; use settings.content for item ${item.id}`);
    if (asset && asset.durationMs !== null && item.trimStartMs! + item.durationMs + item.trimEndMs! > asset.durationMs)
      throw new Error(`Timeline trim range exceeds asset duration for item ${item.id}`);
    if (isText) {
      if (!settings.content) throw new Error(`Text/caption item ${item.id} requires settings.content`);
      if (settings.font && !["Sans", "DejaVu Sans", "Arial"].includes(settings.font)) throw new Error(`Font '${settings.font}' is not available to the renderer`);
      if (!enabled(track, true)) continue;
      const fontSize = settings.fontSize ?? 48;
      const x = settings.alignment === "left" ? 48 : settings.alignment === "right" ? width - 48 : "(w-text_w)/2";
      const y = settings.y ?? height - fontSize * 2;
      const bg = settings.background ? `:box=1:boxcolor=${settings.background}@0.75:boxborderw=12` : "";
      const next = `v${serial++}`;
      // Never accept a user supplied file path in a filter.  This fixed
      // packaged font is used for every allowed family alias.
      filters.push(`[${video}]drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf':text='${escapeFilterText(settings.content)}':fontcolor=${settings.color ?? "#ffffff"}:fontsize=${fontSize}:x=${x}:y=${y}${bg}:enable=between(t\\,${sec(item.startMs)}\\,${sec(item.startMs + item.durationMs)})[${next}]`);
      video = next;
      continue;
    }
    const inputIndex = inputIndexByAsset.get(asset!.id)!;
    if (["video", "image", "graphic"].includes(asset!.assetType) && enabled(track, true)) {
      const label = `pv${serial++}`; const next = `v${serial++}`;
      const crop = settings.crop ? `,crop=${settings.crop.width}:${settings.crop.height}:${settings.crop.x}:${settings.crop.y}` : "";
      const rate = settings.playbackRate ?? 1;
      const color = `eq=brightness=${settings.exposure ?? 0}:contrast=${settings.contrast ?? 1}:saturation=${settings.saturation ?? 1},colorbalance=rs=${settings.temperature ?? 0}:bs=${-(settings.temperature ?? 0)}:gs=${settings.tint ?? 0}`;
      const transitionDuration = sec(settings.transitionDurationMs ?? 300);
      const transition = settings.transition === "crossfade"
        ? `,format=rgba,fade=t=in:st=0:d=${transitionDuration}:alpha=1`
        : settings.transition === "dip-to-black"
          ? `,format=rgba,fade=t=in:st=0:d=${transitionDuration}:alpha=1,fade=t=out:st=${sec(Math.max(0, item.durationMs - (settings.transitionDurationMs ?? 300)))}:d=${transitionDuration}:alpha=1`
          : "";
      const transform = `scale=iw*${settings.scale ?? 1}:ih*${settings.scale ?? 1}${crop},${color},rotate=${(settings.rotation ?? 0) * Math.PI / 180}:fillcolor=none${transition}`;
      const opacity = settings.opacity === undefined ? "" : `,format=rgba,colorchannelmixer=aa=${settings.opacity}`;
      filters.push(`[${inputIndex}:v]trim=start=${sec(item.trimStartMs ?? 0)}:duration=${sec(item.durationMs * rate)},setpts=(PTS-STARTPTS)/${rate},${transform}${opacity}[${label}]`);
      filters.push(`[${video}][${label}]overlay=x=${settings.x ?? "(W-w)/2"}:y=${settings.y ?? "(H-h)/2"}:eof_action=pass:enable=between(t\\,${sec(item.startMs)}\\,${sec(item.startMs + item.durationMs)})[${next}]`);
      video = next;
    }
    if (["audio", "voiceover", "music"].includes(track.trackType) && enabled(track, false) && !settings.mute) {
      const label = `a${serial++}`; const rate = settings.playbackRate ?? 1;
      const pan = settings.pan ?? 0; const left = Math.min(1, Math.max(0, 1 - pan)); const right = Math.min(1, Math.max(0, 1 + pan));
      const fadeIn = settings.fadeInMs ? `,afade=t=in:st=0:d=${sec(settings.fadeInMs)}` : "";
      const fadeOut = settings.fadeOutMs ? `,afade=t=out:st=${sec(Math.max(0, item.durationMs - settings.fadeOutMs))}:d=${sec(settings.fadeOutMs)}` : "";
      filters.push(`[${inputIndex}:a]atrim=start=${sec(item.trimStartMs ?? 0)}:duration=${sec(item.durationMs * rate)},asetpts=(PTS-STARTPTS)/${rate},volume=${settings.volumeDb ?? 0}dB,pan=stereo|c0=${left}*c0|c1=${right}*c1${fadeIn}${fadeOut},adelay=${item.startMs}|${item.startMs}[${label}]`);
      audio.push(label);
    }
  }
  const audioOutput = audio.length ? "amix" : undefined;
  if (audio.length) filters.push(`${audio.map((label) => `[${label}]`).join("")}amix=inputs=${audio.length}:duration=longest:dropout_transition=0,atrim=duration=${sec(durationMs)},loudnorm=I=-16:TP=-1.5:LRA=11[aout]`);
  filters.push(`[${video}]trim=duration=${sec(durationMs)},fps=${fps},format=yuv420p[vout]`);
  return { filter: filters.join(";"), audioOutput, durationMs };
}
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { compileTimelineFilter, escapeFilterText, resolveRenderDimensions } from "../modules/video-editor/timeline-render.compiler.js";

const run = (program: string, args: string[]) => new Promise<string>((resolve, reject) => {
  const child = spawn(program, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "", stdout = ""; child.stderr.on("data", (data) => { stderr += data; }); child.stdout.on("data", (data) => { stdout += data; });
  child.on("error", reject); child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${program} exited ${code}: ${stderr}`)));
});

const id = (n: string) => `00000000-0000-4000-8000-0000000000${n}`;
const temp = await mkdtemp(path.join(os.tmpdir(), "timeline-fixture-"));
try {
  assert.deepEqual(resolveRenderDimensions("1920x1080", "16:9"), { width: 1920, height: 1080, resolution: "1920x1080", is4k: false });
  assert.deepEqual(resolveRenderDimensions("1080x1920", "9:16"), { width: 1080, height: 1920, resolution: "1080x1920", is4k: false });
  assert.throws(() => resolveRenderDimensions("1920x1080", "9:16"), /conflicts/);
  assert.throws(() => resolveRenderDimensions("7680x4320", "16:9"), /Unsupported/);
  // Generated CPU-only fixtures: two colors and two independent sine sources.
  const videoA = path.join(temp, "a.mp4"), videoB = path.join(temp, "b.mp4");
  const audioA = path.join(temp, "a.wav"), audioB = path.join(temp, "b.wav");
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=red:s=320x180:r=30:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", videoA]);
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=30:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", videoB]);
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2", audioA]);
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000:duration=2", audioB]);
  const visual = id("01"), overlay = id("02"), voice = id("03"), music = id("04"), caption = id("05");
  const vt = id("11"), at = id("12"), mt = id("13"), st = id("14");
  const graph = compileTimelineFilter({
    width: 1920, height: 1080, fps: 30, durationMs: 2000, baseInput: 0,
    assets: [
      { id: visual, assetType: "video", durationMs: 2000, localPath: videoA }, { id: overlay, assetType: "video", durationMs: 2000, localPath: videoB },
      { id: voice, assetType: "audio", durationMs: 2000, localPath: audioA }, { id: music, assetType: "audio", durationMs: 2000, localPath: audioB },
    ],
    tracks: [
      { id: vt, trackType: "video", name: "V", position: 0, settings: {} }, { id: at, trackType: "voiceover", name: "VO", position: 1, settings: {} },
      { id: mt, trackType: "music", name: "Music", position: 2, settings: {} }, { id: st, trackType: "subtitles", name: "Captions", position: 3, settings: {} },
    ],
    items: [
      { id: id("21"), trackId: vt, assetId: visual, position: 0, startMs: 0, durationMs: 2000, trimStartMs: 0, trimEndMs: 0, settings: { exposure: 0.1, saturation: 0.8 } },
      { id: id("22"), trackId: vt, assetId: overlay, position: 1, startMs: 500, durationMs: 1000, trimStartMs: 0, trimEndMs: 0, settings: { x: 50, y: 50, scale: 1.1, opacity: 0.7 } },
      { id: id("23"), trackId: at, assetId: voice, position: 0, startMs: 0, durationMs: 2000, trimStartMs: 0, trimEndMs: 0, settings: { volumeDb: -3, pan: -0.2 } },
      { id: id("24"), trackId: mt, assetId: music, position: 0, startMs: 0, durationMs: 2000, trimStartMs: 0, trimEndMs: 0, settings: { volumeDb: -12 } },
      { id: id("25"), trackId: st, position: 0, startMs: 200, durationMs: 1500, trimStartMs: 0, trimEndMs: 0, settings: { content: "Safe: caption, it's real", fontSize: 42 } },
    ],
  });
  assert.match(graph.filter, /overlay=/); assert.match(graph.filter, /amix=inputs=2/); assert.match(graph.filter, /drawtext=/);
  assert.equal(escapeFilterText("a:b,'c'"), "a\\:b\\,’c’");
  const output = path.join(temp, "output.mp4");
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=black:s=1920x1080:r=30:d=2", "-i", videoA, "-i", videoB, "-i", audioA, "-i", audioB,
    "-filter_complex", graph.filter, "-map", "[vout]", "-map", "[aout]", "-t", "2.000", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", output]);
  const probe = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", output]);
  const evidence = JSON.parse(probe); const stream = evidence.streams.find((s: any) => s.codec_type === "video");
  assert.equal(stream.width, 1920); assert.equal(stream.height, 1080); assert.ok(Math.abs(Number(evidence.format.duration) - 2) < 0.15);
  assert.equal(evidence.streams.filter((s: any) => s.codec_type === "audio").length, 1);
  console.log("timeline compiler fixture passed");
} finally { await rm(temp, { recursive: true, force: true }); }
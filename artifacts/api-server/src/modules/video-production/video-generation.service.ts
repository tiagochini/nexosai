/**
 * Video Generation Service — provider abstraction layer
 *
 * These are NexOS's own AI infrastructure providers, paid for and operated by
 * NexOS — NOT customer-connectable integrations. Customers never bring their
 * own HeyGen/ElevenLabs/Runway/Kling keys; all usage is metered via the
 * platform credit system (deductCredits). Do not reintroduce a per-workspace
 * "bring your own key" path for these providers — it would let customers
 * bypass AI credit consumption entirely.
 *
 * Priority chain:
 *   1. Runway ML (RUNWAY_API_KEY)         — text → video, up to 10s, 720p/1080p
 *   2. Kling AI via fal.ai (FAL_API_KEY)  — text → video, up to 10s
 *   3. HeyGen (HEYGEN_API_KEY)            — avatar/talking-head only
 *
 * ElevenLabs (ELEVENLABS_API_KEY) — voice cloning (separate flow)
 *
 * When no provider is configured → returns { status: "provider_not_configured" }
 */

import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";

const log = logger.child({ component: "video-generation" });

export type VideoGenStatus = "submitted" | "processing" | "ready" | "failed" | "provider_not_configured";

export interface VideoClipResult {
  status: VideoGenStatus;
  clipUrl?: string;
  jobId?: string;
  provider?: string;
  durationSeconds?: number;
  error?: string;
  setupInstructions?: string;
}

export interface VideoClipRequest {
  prompt: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  resolution: "720p" | "1080p";
  negativePrompt?: string;
  imageUrl?: string;
}

export interface AvatarVideoRequest {
  voiceoverText: string;
  avatarId?: string;
  voiceId?: string;
  avatarType?: "talking_photo" | "stock" | "digital_twin";
  durationSeconds?: number;
  aspectRatio?: "16:9" | "9:16";
}

export interface VoiceCloneRequest {
  sampleAudioUrl: string;
  name: string;
}

// ─── Provider availability ───────────────────────────────────────────────────
// NexOS-operated infrastructure only — always the platform's own keys.

export function getAvailableVideoProvider(): string | null {
  if (env.RUNWAY_API_KEY) return "runway";
  if (env.FAL_API_KEY) return "kling";
  return null;
}

export function getAvailableAvatarProvider(): string | null {
  if (env.HEYGEN_API_KEY) return "heygen";
  return null;
}

export function getAvailableVoiceProvider(): string | null {
  if (env.ELEVENLABS_API_KEY) return "elevenlabs";
  return null;
}

const SETUP_INSTRUCTIONS = {
  video: "Provedor de vídeo da NexOS não configurado (RUNWAY_API_KEY / FAL_API_KEY). Contate o time técnico.",
  avatar: "Provedor de avatar da NexOS não configurado (HEYGEN_API_KEY). Contate o time técnico.",
  voice: "Provedor de voz da NexOS não configurado (ELEVENLABS_API_KEY). Contate o time técnico.",
};

// ─── Runway ML ───────────────────────────────────────────────────────────────

async function generateWithRunway(req: VideoClipRequest): Promise<VideoClipResult> {
  const baseUrl = "https://api.dev.runwayml.com/v1";
  const headers = {
    Authorization: `Bearer ${env.RUNWAY_API_KEY}`,
    "X-Runway-Version": env.RUNWAY_API_VERSION,
    "Content-Type": "application/json",
  };

  const body: Record<string, unknown> = {
    model: "gen3a_turbo",
    promptText: req.prompt,
    duration: req.durationSeconds <= 5 ? 5 : 10,
    ratio: req.aspectRatio === "9:16" ? "768:1280" : req.aspectRatio === "1:1" ? "1280:1280" : "1280:768",
  };
  if (req.negativePrompt) body.promptTextNegative = req.negativePrompt;
  if (req.imageUrl) {
    body.promptImage = req.imageUrl;
    body.model = "gen3a_turbo";
  }

  try {
    const res = await fetch(`${baseUrl}/image_to_video`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Runway API error ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as { id: string };
    log.info({ jobId: data.id }, "Runway job submitted");
    return { status: "submitted", jobId: data.id, provider: "runway" };
  } catch (err) {
    log.error({ err }, "Runway generation failed");
    return { status: "failed", error: String(err), provider: "runway" };
  }
}

async function pollRunwayJob(jobId: string): Promise<VideoClipResult> {
  const baseUrl = "https://api.dev.runwayml.com/v1";
  try {
    const res = await fetch(`${baseUrl}/tasks/${jobId}`, {
      headers: {
        Authorization: `Bearer ${env.RUNWAY_API_KEY}`,
        "X-Runway-Version": env.RUNWAY_API_VERSION,
      },
    });
    if (!res.ok) throw new Error(`Runway poll error ${res.status}`);
    const data = (await res.json()) as { status: string; output?: string[]; failure?: string };
    if (data.status === "SUCCEEDED" && data.output?.[0]) {
      return { status: "ready", clipUrl: data.output[0], provider: "runway" };
    }
    if (data.status === "FAILED") {
      return { status: "failed", error: data.failure ?? "Runway job failed", provider: "runway" };
    }
    return { status: "processing", jobId, provider: "runway" };
  } catch (err) {
    return { status: "failed", error: String(err), provider: "runway" };
  }
}

// ─── Kling via fal.ai ────────────────────────────────────────────────────────

async function generateWithKling(req: VideoClipRequest): Promise<VideoClipResult> {
  try {
    const res = await fetch("https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video", {
      method: "POST",
      headers: {
        Authorization: `Key ${env.FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: req.prompt,
        negative_prompt: req.negativePrompt ?? "text, subtitles, watermark, blurry, low quality",
        duration: req.durationSeconds <= 5 ? "5" : "10",
        aspect_ratio: req.aspectRatio === "9:16" ? "9:16" : req.aspectRatio === "1:1" ? "1:1" : "16:9",
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Kling API error ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as { request_id: string; status: string };
    log.info({ jobId: data.request_id }, "Kling job submitted");
    return { status: "submitted", jobId: data.request_id, provider: "kling" };
  } catch (err) {
    log.error({ err }, "Kling generation failed");
    return { status: "failed", error: String(err), provider: "kling" };
  }
}

async function pollKlingJob(jobId: string): Promise<VideoClipResult> {
  try {
    const res = await fetch(`https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${jobId}`, {
      headers: { Authorization: `Key ${env.FAL_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Kling poll error ${res.status}`);
    const data = (await res.json()) as { status: string; video?: { url: string }; error?: string };
    if (data.status === "COMPLETED" && data.video?.url) {
      return { status: "ready", clipUrl: data.video.url, provider: "kling" };
    }
    if (data.status === "FAILED") {
      return { status: "failed", error: data.error ?? "Kling job failed", provider: "kling" };
    }
    return { status: "processing", jobId, provider: "kling" };
  } catch (err) {
    return { status: "failed", error: String(err), provider: "kling" };
  }
}

// ─── HeyGen Avatar ───────────────────────────────────────────────────────────

export async function generateAvatarVideo(req: AvatarVideoRequest): Promise<VideoClipResult> {
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) {
    return { status: "provider_not_configured", setupInstructions: SETUP_INSTRUCTIONS.avatar };
  }

  if (!req.avatarId || !req.voiceId) {
    return {
      status: "failed",
      error: "Avatar/voz não configurados — grave ou selecione um avatar antes de gerar vídeo com apresentador.",
      provider: "heygen",
    };
  }

  try {
    // v3 API — migrado de v2/video/generate (sunset 2026-10-31)
    const character =
      req.avatarType === "talking_photo"
        ? { type: "talking_photo", talking_photo_id: req.avatarId, talking_photo_style: "square" }
        : { type: "avatar", avatar_id: req.avatarId, avatar_style: "normal" };

    // v3 usa dimension (width/height) em vez de aspect_ratio
    const dimensionMap: Record<string, { width: number; height: number }> = {
      "9:16": { width: 720, height: 1280 },
      "1:1":  { width: 1080, height: 1080 },
      "16:9": { width: 1280, height: 720 },
    };
    const dimension = dimensionMap[req.aspectRatio ?? "16:9"] ?? { width: 1280, height: 720 };

    const res = await fetch("https://api.heygen.com/v3/videos", {
      method: "POST",
      headers: {
        "X-Api-Key": heygenKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character,
            voice: {
              type: "text",
              input_text: req.voiceoverText,
              voice_id: req.voiceId,
            },
            background: { type: "color", value: "#000000" },
          },
        ],
        dimension,
        test: false,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      // Avatar not found → mensagem clara para o usuário reselecionar
      if (res.status === 404 || errText.includes("look not found") || errText.includes("avatar not found")) {
        return {
          status: "failed",
          error: "Avatar HeyGen não encontrado — o avatar configurado foi removido ou é inválido. Vá em Configurações → Persona e selecione um novo avatar.",
          provider: "heygen",
        };
      }
      throw new Error(`HeyGen API error ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as { data: { video_id: string } };
    return { status: "submitted", jobId: data.data.video_id, provider: "heygen" };
  } catch (err) {
    log.error({ err }, "HeyGen generation failed");
    return { status: "failed", error: String(err), provider: "heygen" };
  }
}

export async function pollHeyGenJob(jobId: string): Promise<VideoClipResult> {
  try {
    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${jobId}`, {
      headers: { "X-Api-Key": env.HEYGEN_API_KEY ?? "" },
    });
    if (!res.ok) throw new Error(`HeyGen poll error ${res.status}`);
    const data = (await res.json()) as { data: { status: string; video_url?: string; error?: string } };
    if (data.data.status === "completed" && data.data.video_url) {
      return { status: "ready", clipUrl: data.data.video_url, provider: "heygen" };
    }
    if (data.data.status === "failed") {
      return { status: "failed", error: data.data.error ?? "HeyGen failed", provider: "heygen" };
    }
    return { status: "processing", jobId, provider: "heygen" };
  } catch (err) {
    return { status: "failed", error: String(err), provider: "heygen" };
  }
}

// ─── ElevenLabs Voice Clone ──────────────────────────────────────────────────

export async function cloneVoice(req: VoiceCloneRequest): Promise<{ voiceId?: string; error?: string }> {
  const elKey = env.ELEVENLABS_API_KEY;
  if (!elKey) {
    return { error: SETUP_INSTRUCTIONS.voice };
  }

  try {
    const formData = new FormData();
    formData.append("name", req.name);
    formData.append("files", req.sampleAudioUrl);

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": elKey },
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs error ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as { voice_id: string };
    return { voiceId: data.voice_id };
  } catch (err) {
    return { error: String(err) };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateVideoClip(req: VideoClipRequest): Promise<VideoClipResult> {
  const provider = getAvailableVideoProvider();
  if (!provider) {
    return { status: "provider_not_configured", setupInstructions: SETUP_INSTRUCTIONS.video };
  }
  if (provider === "runway") return generateWithRunway(req);
  return generateWithKling(req);
}

export async function pollVideoJob(jobId: string, provider: string): Promise<VideoClipResult> {
  if (provider === "runway") return pollRunwayJob(jobId);
  if (provider === "kling") return pollKlingJob(jobId);
  if (provider === "heygen") return pollHeyGenJob(jobId);
  return { status: "failed", error: `Unknown provider: ${provider}` };
}

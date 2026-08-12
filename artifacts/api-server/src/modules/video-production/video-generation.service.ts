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

export type VideoGenStatus = "submitted" | "processing" | "ready" | "failed" | "provider_not_configured" | "avatar_still_processing" | "avatar_consent_required";

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
  video: "Provedor de vídeo da NexOS não configurado (HeyGen). Configure seu avatar em Configurações → Persona.",
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

  // ── Pre-flight: verificar se o look já terminou de processar no HeyGen ──────
  // Igual ao endpoint de demo — evita submeter a geração para um look não pronto
  // (que resulta em vídeo travado ou com erro silencioso no render).
  try {
    const lookRes = await fetch(`https://api.heygen.com/v3/avatars/looks/${req.avatarId}`, {
      headers: { "X-Api-Key": heygenKey },
    });
    if (lookRes.ok) {
      const lookData = (await lookRes.json()) as { data?: { status?: string } };
      const lookStatus = lookData.data?.status;
      log.info({ avatarId: req.avatarId, lookStatus }, "HeyGen pre-flight look check");
      if (lookStatus && lookStatus !== "completed") {
        return {
          status: "avatar_still_processing",
          error: `O HeyGen ainda está processando o avatar (status: ${lookStatus}). Aguarde alguns minutos e tente novamente.`,
          provider: "heygen",
        };
      }
    }
  } catch (preflightErr) {
    // Pre-flight não bloqueante — continua mesmo se a verificação falhar
    log.warn({ err: preflightErr, avatarId: req.avatarId }, "HeyGen pre-flight check failed — proceeding anyway");
  }

  try {
    const aspectRatio = req.aspectRatio ?? "9:16";

    // Truncar o script: HeyGen tem limite de ~2500 chars por vídeo.
    // Scripts muito longos causam falha silenciosa no render.
    const MAX_SCRIPT_CHARS = 2000;
    const rawScript = req.voiceoverText?.trim() ?? "";
    const script = rawScript.length > MAX_SCRIPT_CHARS
      ? rawScript.slice(0, MAX_SCRIPT_CHARS - 3) + "..."
      : rawScript;

    // v3 API — formato plano. Campo correto é "input_text" (não "script").
    // "script" era o campo antigo v1/v2; HeyGen v3 o ignora silenciosamente,
    // o que fazia o render falhar sem mensagem de erro clara.
    const payload = {
      avatar_id: req.avatarId,
      voice_id: req.voiceId,
      input_text: script,
      aspect_ratio: aspectRatio,
      resolution: "720p",
      test: false,
      title: "NexOS Social Reel",
    };

    log.info({ avatarId: req.avatarId, voiceId: req.voiceId, scriptLen: script.length, aspectRatio }, "HeyGen v3 video submit");

    const res = await fetch("https://api.heygen.com/v3/videos", {
      method: "POST",
      headers: {
        "X-Api-Key": heygenKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      log.warn({ status: res.status, errText, avatarId: req.avatarId }, "HeyGen v3 submit failed");
      // Avatar ou look inválido → mensagem clara para o usuário reselecionar
      if (
        res.status === 404 ||
        errText.includes("look not found") ||
        errText.includes("avatar not found") ||
        errText.includes("does not support")
      ) {
        return {
          status: "failed",
          error: "Avatar HeyGen inválido ou expirado — vá em Configurações → Persona e selecione um novo avatar da lista atualizada.",
          provider: "heygen",
        };
      }
      // Avatar look ainda em processamento interno — erro temporário, não uma falha permanente
      if (
        errText.includes("still processing") ||
        errText.includes("cannot be used to create")
      ) {
        return {
          status: "avatar_still_processing",
          error: "O HeyGen ainda está finalizando o processamento interno do avatar. Aguarde alguns minutos e tente novamente.",
          provider: "heygen",
        };
      }
      // Consentimento do grupo pendente — o usuário precisa completar o fluxo de consent no HeyGen
      if (
        errText.includes("avatar_consent_required") ||
        errText.includes("requires consent") ||
        errText.includes("consent to start")
      ) {
        return {
          status: "avatar_consent_required",
          error: "O HeyGen exige que o consentimento do avatar seja gravado diretamente pela plataforma deles antes de gerar vídeos.",
          provider: "heygen",
        };
      }
      throw new Error(`HeyGen API error ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as { data: { video_id: string } };
    const videoId = data.data?.video_id;
    if (!videoId) {
      log.error({ responseBody: JSON.stringify(data) }, "HeyGen v3 submit: video_id ausente na resposta");
      throw new Error(`HeyGen não retornou video_id. Resposta: ${JSON.stringify(data)}`);
    }
    log.info({ videoId }, "HeyGen v3 video submitted ✓");
    return { status: "submitted", jobId: videoId, provider: "heygen" };
  } catch (err) {
    log.error({ err }, "HeyGen generation failed");
    return { status: "failed", error: String(err), provider: "heygen" };
  }
}

export async function pollHeyGenJob(jobId: string): Promise<VideoClipResult> {
  try {
    // v3 endpoint — GET /v3/videos/{id}
    // data.status: "waiting" | "processing" | "completed" | "failed"
    const res = await fetch(`https://api.heygen.com/v3/videos/${jobId}`, {
      headers: { "X-Api-Key": env.HEYGEN_API_KEY ?? "" },
    });
    if (!res.ok) throw new Error(`HeyGen poll error ${res.status}`);
    const raw = (await res.json()) as Record<string, unknown>;
    const videoData = (raw.data ?? raw) as Record<string, unknown>;

    // Log completo para diagnóstico — removível após estabilizar
    log.info({ jobId, status: videoData.status, keys: Object.keys(videoData) }, "HeyGen poll response");

    const status = String(videoData.status ?? "");
    // video_url pode vir como video_url ou url dependendo da versão do endpoint
    const clipUrl = (videoData.video_url ?? videoData.url ?? videoData.download_url) as string | undefined;
    const failureMsg = (videoData.failure_message ?? videoData.error ?? videoData.message) as string | undefined;

    if (status === "completed" && clipUrl) {
      log.info({ jobId, clipUrl }, "HeyGen video completed ✓");
      return { status: "ready", clipUrl, provider: "heygen" };
    }
    if (status === "failed") {
      log.warn({ jobId, failureMsg, videoData: JSON.stringify(videoData) }, "HeyGen video failed");
      return { status: "failed", error: failureMsg ?? "HeyGen video render failed", provider: "heygen" };
    }
    // "completed" sem URL — tratar como failed (evita loop infinito)
    if (status === "completed" && !clipUrl) {
      log.error({ jobId, videoData: JSON.stringify(videoData) }, "HeyGen completed but no video_url");
      return { status: "failed", error: "HeyGen retornou completed sem URL de vídeo", provider: "heygen" };
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

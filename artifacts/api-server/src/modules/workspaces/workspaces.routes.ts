import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod/v4";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../auth/auth.middleware.js";
import { db, workspacesTable, workspaceIntegrationsTable } from "@workspace/db";
import { AppError } from "../../lib/errors.js";
import { testIntegrationCredential } from "../integrations/integration-validator.js";
import { TelegramBotAdapter } from "../community/telegram.adapter.js";
import {
  integrationPurpose,
  metadataForPurpose,
  type IntegrationPurpose,
} from "../integrations/integration-purpose.js";
import {
  assertSocialAccountEntitlement,
  canonicalNetworkForProvider,
} from "../auth/workspace-entitlements.service.js";

const router = Router();
router.use(requireAuth);
const execFileAsync = promisify(execFile);

const VOICE_SAMPLE_CONSENT_VERSION = "voice-sample-storage-v1";
const MAX_VOICE_SAMPLE_BYTES = 10 * 1024 * 1024;
const MAX_VOICE_SAMPLES = 20;
const VOICE_SAMPLE_MIME_TYPES: Record<string, { extension: string; providerExtension: string; formatPattern: RegExp }> = {
  "audio/webm": { extension: "webm", providerExtension: "webm", formatPattern: /webm|matroska/i },
  "audio/ogg": { extension: "ogg", providerExtension: "ogg", formatPattern: /ogg/i },
  "audio/mp4": { extension: "m4a", providerExtension: "m4a", formatPattern: /mp4|m4a|mov/i },
  "audio/mpeg": { extension: "mp3", providerExtension: "mp3", formatPattern: /mp3/i },
};

type VoiceSampleMetadata = {
  sampleId: string;
  name: string;
  durationSeconds: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  consentVersion: string;
  consentedAt: string;
  cloneConsentVersion?: string;
  cloneConsentedAt?: string;
};

function voiceSamplesFromSettings(settings: Record<string, unknown>): VoiceSampleMetadata[] {
  const persona = (settings["persona"] ?? {}) as Record<string, unknown>;
  const rawSamples = Array.isArray(persona["voiceSamples"]) ? persona["voiceSamples"] : [];
  return rawSamples.filter((sample): sample is VoiceSampleMetadata => {
    if (!sample || typeof sample !== "object") return false;
    const item = sample as Partial<VoiceSampleMetadata>;
    return typeof item.sampleId === "string" && /^[0-9a-f-]{36}$/i.test(item.sampleId)
      && typeof item.name === "string" && typeof item.durationSeconds === "number"
      && typeof item.mimeType === "string" && typeof item.sizeBytes === "number"
      && typeof item.createdAt === "string" && typeof item.consentVersion === "string"
      && typeof item.consentedAt === "string";
  });
}

const AVATAR_SAMPLE_CONSENT_VERSION = "avatar-sample-storage-v1";
const MAX_AVATAR_SAMPLE_BYTES = 300 * 1024 * 1024;
const MAX_AVATAR_SAMPLES = 20;
const AVATAR_SAMPLE_MIME_TYPES: Record<string, { extension: string; formatPattern: RegExp }> = {
  "video/webm": { extension: "webm", formatPattern: /webm|matroska/i },
  "video/mp4": { extension: "mp4", formatPattern: /mp4|mov/i },
};

type AvatarSampleMetadata = {
  sampleId: string;
  name: string;
  durationSeconds: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  consentVersion: string;
  consentedAt: string;
};

function avatarSamplesFromSettings(settings: Record<string, unknown>): AvatarSampleMetadata[] {
  const persona = (settings["persona"] ?? {}) as Record<string, unknown>;
  const rawSamples = Array.isArray(persona["avatarSamples"]) ? persona["avatarSamples"] : [];
  return rawSamples.filter((sample): sample is AvatarSampleMetadata => {
    if (!sample || typeof sample !== "object") return false;
    const item = sample as Partial<AvatarSampleMetadata>;
    return typeof item.sampleId === "string" && /^[0-9a-f-]{36}$/i.test(item.sampleId)
      && typeof item.name === "string" && typeof item.durationSeconds === "number"
      && typeof item.mimeType === "string" && typeof item.sizeBytes === "number"
      && typeof item.createdAt === "string" && typeof item.consentVersion === "string"
      && typeof item.consentedAt === "string";
  });
}

class AvatarSampleUploadError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}

async function persistAvatarSample(workspaceId: string, name: string, video: Buffer, contentType: string): Promise<AvatarSampleMetadata> {
  const format = AVATAR_SAMPLE_MIME_TYPES[contentType];
  if (!format || video.length < 1024 || video.length > MAX_AVATAR_SAMPLE_BYTES) {
    throw new AvatarSampleUploadError("Envie um vídeo WebM ou MP4 válido de até 300 MB.", 400, "AVATAR_SAMPLE_INVALID_FILE");
  }
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "nexos-avatar-sample-"));
  try {
    const tempFile = path.join(tempDir, `sample.${format.extension}`);
    await writeFile(tempFile, video, { flag: "wx" });
    let probe: { streams?: Array<Record<string, unknown>>; format?: { duration?: string; format_name?: string } };
    try {
      const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", tempFile], { maxBuffer: 1024 * 1024 });
      probe = JSON.parse(stdout) as typeof probe;
    } catch {
      throw new AvatarSampleUploadError("O arquivo enviado não contém vídeo válido no formato informado.", 400, "AVATAR_SAMPLE_INVALID_VIDEO");
    }
    const streams = probe.streams ?? [];
    const durationSeconds = Number(probe.format?.duration ?? 0);
    if (!format.formatPattern.test(probe.format?.format_name ?? "")
      || !streams.some((stream) => stream.codec_type === "video")
      || !streams.some((stream) => stream.codec_type === "audio")) {
      throw new AvatarSampleUploadError("O arquivo precisa corresponder ao formato informado e conter áudio e vídeo.", 400, "AVATAR_SAMPLE_INVALID_VIDEO");
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds < 5 || durationSeconds > 120) {
      throw new AvatarSampleUploadError("A gravação do avatar precisa durar entre 5 segundos e 2 minutos.", 400, "AVATAR_SAMPLE_INVALID_VIDEO");
    }

    const [ws] = await db.select({ settings: workspacesTable.settings })
      .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
    const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
    const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
    const currentSamples = avatarSamplesFromSettings(existingSettings);
    if (currentSamples.length >= MAX_AVATAR_SAMPLES) {
      throw new AvatarSampleUploadError("Limite de 20 gravações de avatar atingido. Exclua uma para continuar.", 409, "AVATAR_SAMPLE_LIMIT");
    }
    const sampleId = randomUUID();
    const { avatarSampleObjectKey, uploadBufferToGCS, deleteGCSObject } = await import("../../lib/gcs-recordings.js");
    const objectKey = avatarSampleObjectKey(workspaceId, sampleId, format.extension);
    await uploadBufferToGCS(video, objectKey, contentType);
    const now = new Date().toISOString();
    const sample: AvatarSampleMetadata = {
      sampleId, name, durationSeconds: Math.round(durationSeconds * 10) / 10,
      mimeType: contentType, sizeBytes: video.length, createdAt: now,
      consentVersion: AVATAR_SAMPLE_CONSENT_VERSION, consentedAt: now,
    };
    try {
      await db.update(workspacesTable)
        .set({ settings: { ...existingSettings, persona: { ...existingPersona, avatarSamples: [...currentSamples, sample] } } as any })
        .where(eq(workspacesTable.id, workspaceId));
    } catch {
      await deleteGCSObject(objectKey).catch(() => {});
      throw new Error("Avatar sample metadata persistence failed");
    }
    return sample;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).optional(),
  brandName: z.string().optional(),
  logoUrl: z.string().optional(),
});

router.get("/me", async (req, res): Promise<void> => {
  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);

  if (!workspace) {
    res.status(404).json({ error: "Workspace not found", code: "NOT_FOUND" });
    return;
  }

  const integrations = await db
    .select({
      id: workspaceIntegrationsTable.id,
      provider: workspaceIntegrationsTable.provider,
      status: workspaceIntegrationsTable.status,
      accountName: workspaceIntegrationsTable.accountName,
      isPaymentGateway: workspaceIntegrationsTable.isPaymentGateway,
      blocksExecution: workspaceIntegrationsTable.blocksExecution,
    })
    .from(workspaceIntegrationsTable)
    .where(eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId));

  res.json({ workspace, integrations });
});

router.patch("/me", async (req, res): Promise<void> => {
  const parsed = updateWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name) updates["name"] = parsed.data.name;
  if (parsed.data.brandName !== undefined) updates["brandName"] = parsed.data.brandName;
  if (parsed.data.logoUrl !== undefined) updates["logoUrl"] = parsed.data.logoUrl;

  const [updated] = await db
    .update(workspacesTable)
    .set(updates)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .returning();

  res.json({ workspace: updated });
});

router.get("/me/integrations", async (req, res): Promise<void> => {
  const integrations = await db
    .select({
      id: workspaceIntegrationsTable.id,
      provider: workspaceIntegrationsTable.provider,
      status: workspaceIntegrationsTable.status,
      accountId: workspaceIntegrationsTable.accountId,
      accountName: workspaceIntegrationsTable.accountName,
      metadata: workspaceIntegrationsTable.metadata,
      isPaymentGateway: workspaceIntegrationsTable.isPaymentGateway,
      blocksExecution: workspaceIntegrationsTable.blocksExecution,
      createdAt: workspaceIntegrationsTable.createdAt,
    })
    .from(workspaceIntegrationsTable)
    .where(eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId));

  res.json({ integrations });
});

router.post("/me/integrations", async (req, res): Promise<void> => {
  const schema = z.object({
    provider: z.enum([
      "meta_ads", "instagram", "facebook", "tiktok", "tiktok_ads", "google_ads", "linkedin_ads",
      "whatsapp_business", "telegram",
      "rd_station", "activecampaign", "mailchimp", "resend",
      "stripe", "paypal", "mercado_pago", "pagarme", "asaas",
      "hotmart", "eduzz", "kiwify", "hubspot",
      "crypto_native", "custom_webhook",
    ]),
    accountId: z.string().optional(),
    accountName: z.string().optional(),
    accessToken: z.string().optional(),
    webhookUrl: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  // "tiktok" (organic, front-end only) shares the "tiktok_ads" DB enum value —
  // there is no separate organic-tiktok DB provider (see oauth.routes.ts dbProvider mapping).
  const dbProvider = parsed.data.provider === "tiktok" ? "tiktok_ads" : parsed.data.provider;
  // Telegram community credentials are secret *references*, not raw bot tokens.
  // Do this before the legacy generic credential flow so a token cannot be
  // written into workspace_integrations.access_token.
  if (dbProvider === "telegram" && parsed.data.accessToken) {
    res.status(400).json({ error: "Telegram bot tokens must be configured as a server secret reference, never submitted or stored.", code: "TELEGRAM_TOKEN_REFERENCE_REQUIRED" });
    return;
  }
  const purpose: IntegrationPurpose = parsed.data.provider === "tiktok"
    ? "organic_social"
    : (parsed.data.provider === "meta_ads" || parsed.data.provider === "tiktok_ads")
      ? "paid_media"
      : "organic_social";

  const PAYMENT_GATEWAYS = ["stripe", "paypal", "mercado_pago", "pagarme", "asaas", "hotmart", "eduzz", "kiwify", "crypto_native"];
  const isPaymentGateway = PAYMENT_GATEWAYS.includes(dbProvider);

  // C1: Live credential validation — ping the real provider API before saving.
  // Only mark "connected" when the ping returns valid=true.
  // validationSkipped providers (webhook receivers, complex OAuth) are accepted
  // but flagged in metadata so we never silently pretend they're verified.
  let pingAccountName = parsed.data.accountName;
  let pingAccountId = parsed.data.accountId;
  let validationDetail: string | undefined;
  let status: "connected" | "disconnected" = "disconnected";
  if (dbProvider === "telegram") {
    const metadata = parsed.data.metadata ?? {};
    try {
      const bot = await new TelegramBotAdapter({
        id: "unsaved", workspaceId: req.auth.workspaceId, status: "pending_approval", accountId: null, metadata,
      }).getMe();
      status = "connected";
      pingAccountId = String(bot.id);
      pingAccountName = bot.username ? `@${bot.username}` : bot.first_name;
      validationDetail = "Telegram bot verified with getMe; bot token is held only by the configured secret reference.";
      parsed.data.metadata = { ...metadata, _validationSkipped: false, _validatedAt: new Date().toISOString() };
    } catch {
      res.status(422).json({ error: "Telegram bot secret reference could not be verified with getMe", code: "INTEGRATION_VALIDATION_FAILED", provider: dbProvider });
      return;
    }
  }

  if (dbProvider !== "telegram" && (parsed.data.accessToken || parsed.data.accountId)) {
    const pingResult = await testIntegrationCredential(dbProvider, {
      accessToken: parsed.data.accessToken,
      accountId: parsed.data.accountId,
      webhookUrl: parsed.data.webhookUrl,
      metadata: parsed.data.metadata as Record<string, unknown> | undefined,
    });

    if (!pingResult.valid) {
      // Hard reject — do NOT save as connected
      res.status(422).json({
        error: pingResult.error ?? "Credencial inválida — a plataforma recusou o token",
        code: "INTEGRATION_VALIDATION_FAILED",
        provider: dbProvider,
      });
      return;
    }

    // Valid (or skipped) — promote to connected
    status = "connected";
    if (pingResult.accountName) pingAccountName = pingResult.accountName;
    if (pingResult.accountId) pingAccountId = pingResult.accountId;
    validationDetail = pingResult.detail;

    // Flag skipped validations explicitly in metadata
    if (pingResult.validationSkipped) {
      parsed.data.metadata = {
        ...(parsed.data.metadata ?? {}),
        _validationSkipped: true,
        _validationSkippedReason: pingResult.detail,
      };
    } else {
      parsed.data.metadata = {
        ...(parsed.data.metadata ?? {}),
        _validationSkipped: false,
        _validatedAt: new Date().toISOString(),
      };
    }
  }

  const candidates = await db
    .select({
      id: workspaceIntegrationsTable.id,
      metadata: workspaceIntegrationsTable.metadata,
      accountId: workspaceIntegrationsTable.accountId,
    })
    .from(workspaceIntegrationsTable)
    .where(and(
      eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId),
      eq(workspaceIntegrationsTable.provider, dbProvider),
    ));
  const existing = candidates.find((row) =>
    integrationPurpose((row.metadata ?? null) as Record<string, unknown> | null) === purpose
    && (row.accountId ?? null) === (pingAccountId ?? null),
  );
  const network = canonicalNetworkForProvider(dbProvider);
  if (network) {
    await assertSocialAccountEntitlement(req.auth.workspaceId, network, pingAccountId);
  }

  const values = {
    workspaceId: req.auth.workspaceId,
    provider: dbProvider,
    status,
    accessToken: dbProvider === "telegram" ? null : parsed.data.accessToken,
    accountId: pingAccountId,
    accountName: pingAccountName,
    webhookUrl: parsed.data.webhookUrl,
    metadata: metadataForPurpose(purpose, parsed.data.metadata ?? {}),
    isPaymentGateway,
    blocksExecution: false,
  } as const;

  const [integration] = existing
    ? await db
        .update(workspaceIntegrationsTable)
        .set(values)
        .where(eq(workspaceIntegrationsTable.id, existing.id))
        .returning()
    : await db.insert(workspaceIntegrationsTable).values(values).returning();

  // Credentials are write-only. Never echo a submitted or stored token.
  const { accessToken: _accessToken, refreshToken: _refreshToken, ...safeIntegration } = integration;
  res.status(existing ? 200 : 201).json({ integration: safeIntegration, validationDetail });
});

// ── Profile picture proxy ─────────────────────────────────────────────────────
// GET /workspaces/me/integrations/:id/profile-picture
// Proxies the stored igProfilePictureUrl through our server so the image loads
// on all devices regardless of Facebook CDN geographic routing.
router.get("/me/integrations/:id/profile-picture", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };

  const [integration] = await db
    .select({ metadata: workspaceIntegrationsTable.metadata })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.id, id),
        eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId),
      ),
    )
    .limit(1);

  const meta = integration?.metadata as Record<string, unknown> | null;
  const picUrl = meta?.igProfilePictureUrl as string | undefined;

  if (!picUrl) {
    res.status(404).end();
    return;
  }

  try {
    const imgRes = await fetch(picUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NexOS/1.0)" },
    });
    if (!imgRes.ok) {
      res.status(502).end();
      return;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h cache
    res.send(buf);
  } catch {
    res.status(502).end();
  }
});

// ── Test saved integration ────────────────────────────────────────────────────
// POST /workspaces/me/integrations/:id/test
// Re-pings the provider API using the stored token and returns a ValidationResult.
// The accessToken is never exposed to the client — only the result detail/error.
router.post("/me/integrations/:id/test", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };

  const [integration] = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.id, id),
        eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId),
      ),
    )
    .limit(1);

  if (!integration) {
    res.status(404).json({ error: "Integração não encontrada." });
    return;
  }

  const result = await testIntegrationCredential(integration.provider, {
    accessToken: integration.accessToken ?? undefined,
    accountId: integration.accountId ?? undefined,
    webhookUrl: integration.webhookUrl ?? undefined,
    metadata: (integration.metadata as Record<string, unknown> | null) ?? undefined,
  });

  // Never echo the token back — return only the human-readable result.
  res.json({
    valid: result.valid,
    detail: result.detail,
    error: result.error,
    validationSkipped: result.validationSkipped ?? false,
    accountName: result.accountName,
    rows: result.rows ?? [],
  });
});

// NOTE: HeyGen/ElevenLabs/Runway/Kling are NexOS-operated AI infrastructure,
// never customer-connectable integrations — there is intentionally no
// "bring your own API key" endpoint for them here. Do not re-add one; it
// would let customers bypass the platform's AI credit consumption model.

// ── Persona / Voice Clone endpoints ───────────────────────────────────────────

// GET /workspaces/me/persona — return current persona settings
router.get("/me/persona", async (req, res): Promise<void> => {
  const [ws] = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  const settings = (ws?.settings ?? {}) as Record<string, unknown>;
  res.json({ persona: (settings.persona ?? {}) as Record<string, unknown> });
});

// PATCH /workspaces/me/persona — save trejeitos, avatar ID, speaking style
router.patch("/me/persona", async (req, res): Promise<void> => {
  const schema = z.object({
    voiceName:       z.string().max(80).optional(),
    heygenAvatarId:  z.string().max(200).optional(),
    heygenVoiceId:   z.string().max(200).optional(),
    speakingStyle: z.object({
      energia:    z.enum(["baixa","moderada","alta","muito_alta"]).optional(),
      velocidade: z.enum(["lenta","moderada","rapida","variavel"]).optional(),
      pausas:     z.enum(["frequentes","estrategicas","minimas"]).optional(),
      gestos:     z.enum(["discretos","moderados","expressivos","muito_expressivos"]).optional(),
      tom:        z.string().max(200).optional(),
    }).optional(),
    trejeitos:     z.string().max(1500).optional(),
    brandPresence: z.string().max(800).optional(),
    reelStyle:     z.string().max(800).optional(),
    lifestylePreferences: z.object({
      hobbies:     z.string().max(600).optional(),
      gastronomy:  z.string().max(600).optional(),
      vehicles:    z.string().max(600).optional(),
      scenarios:   z.string().max(600).optional(),
      accessories: z.string().max(600).optional(),
      countries:   z.string().max(600).optional(),
      other:       z.string().max(600).optional(),
    }).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const [ws] = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const existingPersona  = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (parsed.data.voiceName             !== undefined) patch["voiceName"]             = parsed.data.voiceName;
  if (parsed.data.heygenAvatarId        !== undefined) patch["heygenAvatarId"]        = parsed.data.heygenAvatarId;
  if (parsed.data.heygenVoiceId         !== undefined) patch["heygenVoiceId"]         = parsed.data.heygenVoiceId;
  if (parsed.data.speakingStyle         !== undefined) patch["speakingStyle"]         = parsed.data.speakingStyle;
  if (parsed.data.trejeitos             !== undefined) patch["trejeitos"]             = parsed.data.trejeitos;
  if (parsed.data.brandPresence         !== undefined) patch["brandPresence"]         = parsed.data.brandPresence;
  if (parsed.data.reelStyle             !== undefined) patch["reelStyle"]             = parsed.data.reelStyle;
  if (parsed.data.lifestylePreferences  !== undefined) patch["lifestylePreferences"]  = parsed.data.lifestylePreferences;
  const updatedPersona = { ...existingPersona, ...patch, updatedAt: new Date().toISOString() };
  await db
    .update(workspacesTable)
    .set({ settings: { ...existingSettings, persona: updatedPersona } as any })
    .where(eq(workspacesTable.id, req.auth.workspaceId));
  res.json({ persona: updatedPersona });
});

// ── Private voice sample library ────────────────────────────────────────────

router.get("/me/persona/voice-samples", async (req, res): Promise<void> => {
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, req.auth.workspaceId)).limit(1);
  const settings = (ws?.settings ?? {}) as Record<string, unknown>;
  res.json({ samples: voiceSamplesFromSettings(settings) });
});

router.post(
  "/me/persona/voice-samples",
  express.raw({ type: "*/*", limit: MAX_VOICE_SAMPLE_BYTES }),
  async (req, res): Promise<void> => {
    const schema = z.object({
      name: z.string().trim().min(1).max(80),
      consent: z.literal(true),
      consentVersion: z.literal(VOICE_SAMPLE_CONSENT_VERSION),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Informe um nome e confirme o consentimento para armazenar esta amostra.", code: "VOICE_SAMPLE_CONSENT_REQUIRED" });
      return;
    }
    const contentType = String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
    const audioFormat = VOICE_SAMPLE_MIME_TYPES[contentType];
    const audio = Buffer.isBuffer(req.body) ? req.body : null;
    if (!audioFormat || !audio || audio.length < 1024 || audio.length > MAX_VOICE_SAMPLE_BYTES) {
      res.status(400).json({ error: "Envie um áudio WebM, OGG, MP4 ou MP3 válido de até 10 MB.", code: "VOICE_SAMPLE_INVALID_FILE" });
      return;
    }

    let tempDir: string | undefined;
    try {
      tempDir = await mkdtemp(path.join(os.tmpdir(), "nexos-voice-sample-"));
      const tempFile = path.join(tempDir, `sample.${audioFormat.extension}`);
      await writeFile(tempFile, audio, { flag: "wx" });
      let probe: { streams?: Array<Record<string, unknown>>; format?: { duration?: string; format_name?: string } };
      try {
        const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", tempFile], { maxBuffer: 1024 * 1024 });
        probe = JSON.parse(stdout) as typeof probe;
      } catch {
        res.status(400).json({ error: "O arquivo enviado não contém um áudio válido no formato informado.", code: "VOICE_SAMPLE_INVALID_AUDIO" });
        return;
      }
      const streams = probe.streams ?? [];
      const durationSeconds = Number(probe.format?.duration ?? 0);
      if (!audioFormat.formatPattern.test(probe.format?.format_name ?? "")
        || !streams.some((stream) => stream.codec_type === "audio") || streams.some((stream) => stream.codec_type === "video")) {
        res.status(400).json({ error: "O conteúdo do arquivo não corresponde ao formato de áudio informado.", code: "VOICE_SAMPLE_INVALID_AUDIO" });
        return;
      }
      if (!Number.isFinite(durationSeconds) || durationSeconds < 5 || durationSeconds > 120) {
        res.status(400).json({ error: "A amostra precisa durar entre 5 segundos e 2 minutos.", code: "VOICE_SAMPLE_INVALID_AUDIO" });
        return;
      }

      const workspaceId = req.auth.workspaceId;
      const [ws] = await db.select({ settings: workspacesTable.settings })
        .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
      const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
      const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
      const currentSamples = voiceSamplesFromSettings(existingSettings);
      if (currentSamples.length >= MAX_VOICE_SAMPLES) {
        res.status(409).json({ error: "Limite de 20 amostras por workspace atingido. Exclua uma amostra para continuar.", code: "VOICE_SAMPLE_LIMIT" });
        return;
      }

      const sampleId = randomUUID();
      const objectKey = (await import("../../lib/gcs-recordings.js")).voiceSampleObjectKey(workspaceId, sampleId, audioFormat.extension);
      const { uploadBufferToGCS } = await import("../../lib/gcs-recordings.js");
      await uploadBufferToGCS(audio, objectKey, contentType);
      const now = new Date().toISOString();
      const sample: VoiceSampleMetadata = {
        sampleId,
        name: parsed.data.name,
        durationSeconds: Math.round(durationSeconds * 10) / 10,
        mimeType: contentType,
        sizeBytes: audio.length,
        createdAt: now,
        consentVersion: VOICE_SAMPLE_CONSENT_VERSION,
        consentedAt: now,
      };
      try {
        await db.update(workspacesTable)
          .set({ settings: { ...existingSettings, persona: { ...existingPersona, voiceSamples: [...currentSamples, sample] } } as any })
          .where(eq(workspacesTable.id, workspaceId));
      } catch (error) {
        const { deleteGCSObject } = await import("../../lib/gcs-recordings.js");
        await deleteGCSObject(objectKey).catch(() => {});
        throw error;
      }
      req.log.info({ workspaceId, sampleId, sizeBytes: audio.length, durationSeconds: sample.durationSeconds }, "Private voice sample saved");
      res.status(201).json({ sample });
    } catch {
      req.log.error({ workspaceId: req.auth.workspaceId }, "Private voice sample upload failed");
      res.status(500).json({ error: "Não foi possível salvar a amostra. Tente novamente.", code: "VOICE_SAMPLE_SAVE_FAILED" });
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  },
);

router.get("/me/persona/voice-samples/:sampleId/audio", async (req, res): Promise<void> => {
  const sampleId = String(req.params.sampleId);
  if (!/^[0-9a-f-]{36}$/i.test(sampleId)) {
    res.status(404).json({ error: "Amostra não encontrada.", code: "VOICE_SAMPLE_NOT_FOUND" });
    return;
  }
  const { createGCSObjectStream, voiceSampleObjectKey } = await import("../../lib/gcs-recordings.js");
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, req.auth.workspaceId)).limit(1);
  const settings = (ws?.settings ?? {}) as Record<string, unknown>;
  const sample = voiceSamplesFromSettings(settings).find((item) => item.sampleId === sampleId);
  if (!sample) {
    res.status(404).json({ error: "Amostra não encontrada.", code: "VOICE_SAMPLE_NOT_FOUND" });
    return;
  }
  const extension = VOICE_SAMPLE_MIME_TYPES[sample.mimeType]?.extension;
  if (!extension) {
    res.status(404).json({ error: "Amostra não encontrada.", code: "VOICE_SAMPLE_NOT_FOUND" });
    return;
  }
  res.setHeader("Content-Type", sample.mimeType);
  res.setHeader("Content-Length", String(sample.sizeBytes));
  res.setHeader("Cache-Control", "private, no-store");
  const stream = createGCSObjectStream(voiceSampleObjectKey(req.auth.workspaceId, sampleId, extension));
  stream.on("error", () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
  stream.pipe(res);
});

router.delete("/me/persona/voice-samples/:sampleId", async (req, res): Promise<void> => {
  const sampleId = String(req.params.sampleId);
  const workspaceId = req.auth.workspaceId;
  if (!/^[0-9a-f-]{36}$/i.test(sampleId)) {
    res.status(404).json({ error: "Amostra não encontrada.", code: "VOICE_SAMPLE_NOT_FOUND" });
    return;
  }
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
  const samples = voiceSamplesFromSettings(existingSettings);
  const sample = samples.find((item) => item.sampleId === sampleId);
  const extension = sample ? VOICE_SAMPLE_MIME_TYPES[sample.mimeType]?.extension : undefined;
  if (!sample || !extension) {
    res.status(404).json({ error: "Amostra não encontrada.", code: "VOICE_SAMPLE_NOT_FOUND" });
    return;
  }
  const remaining = samples.filter((item) => item.sampleId !== sampleId);
  await db.update(workspacesTable)
    .set({ settings: { ...existingSettings, persona: { ...existingPersona, voiceSamples: remaining } } as any })
    .where(eq(workspacesTable.id, workspaceId));
  const { deleteGCSObject, voiceSampleObjectKey } = await import("../../lib/gcs-recordings.js");
  try {
    await deleteGCSObject(voiceSampleObjectKey(workspaceId, sampleId, extension));
  } catch {
    // Restore the metadata so the user can retry removal if object deletion fails.
    await db.update(workspacesTable)
      .set({ settings: { ...existingSettings, persona: { ...existingPersona, voiceSamples: samples } } as any })
      .where(eq(workspacesTable.id, workspaceId)).catch(() => {});
    res.status(500).json({ error: "Não foi possível remover a amostra. Tente novamente.", code: "VOICE_SAMPLE_DELETE_FAILED" });
    return;
  }
  req.log.info({ workspaceId, sampleId }, "Private voice sample deleted");
  res.json({ success: true });
});

router.post("/me/persona/voice-samples/:sampleId/clone", async (req, res): Promise<void> => {
  const consentSchema = z.object({ consent: z.literal(true), consentVersion: z.literal("voice-clone-v1") });
  if (!consentSchema.safeParse(req.body).success) {
    res.status(400).json({ error: "Confirme que autoriza o uso desta amostra para criar um clone de voz.", code: "VOICE_CLONE_CONSENT_REQUIRED" });
    return;
  }
  const sampleId = String(req.params.sampleId);
  if (!/^[0-9a-f-]{36}$/i.test(sampleId)) {
    res.status(404).json({ error: "Amostra não encontrada.", code: "VOICE_SAMPLE_NOT_FOUND" });
    return;
  }
  const { env } = await import("../../lib/env.js");
  if (!env.ELEVENLABS_API_KEY) {
    res.status(422).json({ error: "O serviço de clonagem está indisponível no momento. A amostra continua salva.", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }
  const workspaceId = req.auth.workspaceId;
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
  const sample = voiceSamplesFromSettings(existingSettings).find((item) => item.sampleId === sampleId);
  const format = sample ? VOICE_SAMPLE_MIME_TYPES[sample.mimeType] : undefined;
  if (!sample || !format) {
    res.status(404).json({ error: "Amostra não encontrada.", code: "VOICE_SAMPLE_NOT_FOUND" });
    return;
  }
  try {
    const cloneConsentedAt = new Date().toISOString();
    const updatedSamples = voiceSamplesFromSettings(existingSettings).map((item) => item.sampleId === sampleId
      ? { ...item, cloneConsentVersion: "voice-clone-v1", cloneConsentedAt }
      : item);
    await db.update(workspacesTable)
      .set({ settings: { ...existingSettings, persona: { ...existingPersona, voiceSamples: updatedSamples } } as any })
      .where(eq(workspacesTable.id, workspaceId));
    const { createGCSObjectStream, voiceSampleObjectKey } = await import("../../lib/gcs-recordings.js");
    const chunks: Buffer[] = [];
    for await (const chunk of createGCSObjectStream(voiceSampleObjectKey(workspaceId, sampleId, format.extension))) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const audio = Buffer.concat(chunks);
    if (!audio.length || audio.length > MAX_VOICE_SAMPLE_BYTES) throw new Error("Stored voice sample size is invalid");
    const formData = new FormData();
    formData.append("name", sample.name);
    formData.append("files", new Blob([audio], { type: sample.mimeType }), `voice-sample.${format.providerExtension}`);
    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
      body: formData,
    });
    if (!response.ok) {
      req.log.warn({ workspaceId, status: response.status }, "Voice sample provider request failed");
      res.status(502).json({ error: "Não foi possível criar o clone agora. Sua amostra continua salva.", code: "VOICE_CLONE_ERROR" });
      return;
    }
    const data = (await response.json()) as { voice_id?: string };
    if (!data.voice_id || data.voice_id.length > 200) throw new Error("Voice provider returned an invalid identifier");
    const now = new Date().toISOString();
    await db.update(workspacesTable).set({
      settings: {
        ...existingSettings,
        persona: { ...existingPersona, voiceCloneId: data.voice_id, voiceCloneUpdatedAt: now, voiceName: sample.name },
        cloneSessionId: data.voice_id,
        hasClone: true,
      } as any,
    }).where(eq(workspacesTable.id, workspaceId));
    req.log.info({ workspaceId, sampleId }, "Voice clone created from saved sample");
    res.json({ voiceCloneId: data.voice_id, success: true });
  } catch {
    req.log.error({ workspaceId, sampleId }, "Voice clone from saved sample failed");
    res.status(500).json({ error: "Não foi possível criar o clone agora. Sua amostra continua salva.", code: "VOICE_CLONE_ERROR" });
  }
});

// POST /workspaces/me/persona/clone-voice — receive base64 audio → ElevenLabs → save voice_id
router.post("/me/persona/clone-voice", async (req, res): Promise<void> => {
  const schema = z.object({
    audioBase64: z.string().min(10),
    mimeType:    z.string().default("audio/webm"),
    voiceName:   z.string().max(80).default("Minha Voz NexOS"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "audioBase64 obrigatório", code: "VALIDATION_ERROR" });
    return;
  }
  const { env } = await import("../../lib/env.js");
  const elKey = env.ELEVENLABS_API_KEY;
  if (!elKey) {
    res.status(422).json({ error: "ElevenLabs não configurado — adicione ELEVENLABS_API_KEY", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }
  try {
    const buf = Buffer.from(parsed.data.audioBase64, "base64");
    const ext = parsed.data.mimeType.includes("mpeg") || parsed.data.mimeType.includes("mp3") ? "mp3"
              : parsed.data.mimeType.includes("mp4") ? "mp4"
              : "webm";
    const formData = new FormData();
    formData.append("name", parsed.data.voiceName);
    formData.append("files", new Blob([buf], { type: parsed.data.mimeType }), `voice-sample.${ext}`);
    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": elKey },
      body: formData,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs ${response.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await response.json()) as { voice_id: string };
    const voiceCloneId = data.voice_id;
    const [ws] = await db.select({ settings: workspacesTable.settings })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, req.auth.workspaceId))
      .limit(1);
    const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
    const existingPersona  = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
    await db.update(workspacesTable)
      .set({ settings: { ...existingSettings, persona: { ...existingPersona, voiceCloneId, voiceCloneUpdatedAt: new Date().toISOString() } } as any })
      .where(eq(workspacesTable.id, req.auth.workspaceId));
    req.log.info({ workspaceId: req.auth.workspaceId, voiceCloneId }, "Voice clone created");
    res.json({ voiceCloneId, success: true });
  } catch (err) {
    req.log.error({ err }, "Voice clone failed");
    res.status(500).json({ error: String(err), code: "VOICE_CLONE_ERROR" });
  }
});

// POST /workspaces/me/persona/clone-voice-multi
// Receives multiple base64-encoded audio takes → ElevenLabs voices/add (multi-sample) → saves voiceCloneId.
// Also saves sessionId to workspace.settings so the UI can confirm the session completed.
router.post("/me/persona/clone-voice-multi", async (req, res): Promise<void> => {
  const schema = z.object({
    samples:   z.array(z.object({ data: z.string().min(10), mimeType: z.string().default("audio/webm") })).min(1).max(10),
    voiceName: z.string().max(80).default("Minha Voz NexOS"),
    sessionId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "samples[] obrigatório", code: "VALIDATION_ERROR" });
    return;
  }
  const { env } = await import("../../lib/env.js");
  const elKey = env.ELEVENLABS_API_KEY;
  if (!elKey) {
    res.status(422).json({ error: "ElevenLabs não configurado — adicione ELEVENLABS_API_KEY", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }
  try {
    const formData = new FormData();
    formData.append("name", parsed.data.voiceName);
    // Enviar cada take como um arquivo de amostra separado
    for (let i = 0; i < parsed.data.samples.length; i++) {
      const s = parsed.data.samples[i]!;
      const buf = Buffer.from(s.data, "base64");
      const ext = s.mimeType.includes("mp3") || s.mimeType.includes("mpeg") ? "mp3" : "webm";
      formData.append("files", new Blob([buf], { type: s.mimeType }), `take-${i + 1}.${ext}`);
    }
    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": elKey },
      body: formData,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs ${response.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await response.json()) as { voice_id: string };
    const voiceCloneId = data.voice_id;

    // Salvar voiceCloneId + cloneSessionId no workspace
    const workspaceId = req.auth.workspaceId;
    const [ws] = await db.select({ settings: workspacesTable.settings })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId))
      .limit(1);
    const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
    const existingPersona  = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
    await db.update(workspacesTable)
      .set({
        settings: {
          ...existingSettings,
          // Persona: salva voiceCloneId
          persona: { ...existingPersona, voiceCloneId, voiceCloneUpdatedAt: new Date().toISOString() },
          // Top-level: salva cloneSessionId para o painel de settings reconhecer
          cloneSessionId: parsed.data.sessionId ?? voiceCloneId,
          hasClone: true,
        } as never,
      })
      .where(eq(workspacesTable.id, workspaceId));
    req.log.info({ workspaceId, voiceCloneId, sampleCount: parsed.data.samples.length }, "Voice clone (multi-sample) created");
    res.json({ voiceCloneId, success: true });
  } catch (err) {
    req.log.error({ err }, "Voice clone multi failed");
    res.status(500).json({ error: String(err), code: "VOICE_CLONE_ERROR" });
  }
});

// ── Avatar (HeyGen) endpoints ────────────────────────────────────────────────
// NexOS-operated infra only — always env.HEYGEN_API_KEY, never a customer key.

// A small curated set of NexOS-provided ready-made HeyGen public avatars, so a
// customer can pick a face without recording their own video.
// Avatars obtidos dinamicamente da HeyGen API v3 (GET /v3/avatars/looks).
// Retorna UUIDs de looks — únicos identificadores válidos para POST /v3/videos.
// Twins privados do usuário aparecem primeiro; avatars de estoque depois.
// Nunca hardcoded: o catálogo HeyGen muda sem aviso.
router.get("/me/persona/stock-avatars", async (req, res): Promise<void> => {
  const { env } = await import("../../lib/env.js");
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) {
    res.json({ avatars: [] });
    return;
  }

  type HeyGenLook = {
    id: string;
    name: string;
    gender?: string;
    avatar_type?: string;
    preview_image_url?: string;
    preview_video_url?: string;
    preferred_orientation?: string;
    supported_api_engines?: string[];
    group_id?: string;
    default_voice_id?: string;
  };

  async function fetchLooks(params: string): Promise<HeyGenLook[]> {
    const all: HeyGenLook[] = [];
    let nextToken: string | null = null;
    do {
      const url = `https://api.heygen.com/v3/avatars/looks?limit=50${params}${nextToken ? `&next_token=${encodeURIComponent(nextToken)}` : ""}`;
      const r = await fetch(url, { headers: { "X-Api-Key": heygenKey! } });
      if (!r.ok) break;
      const d = (await r.json()) as { data: HeyGenLook[]; has_more: boolean; next_token?: string };
      all.push(...(d.data ?? []));
      nextToken = d.has_more && d.next_token ? d.next_token : null;
    } while (nextToken && all.length < 200);
    return all;
  }

  try {
    // 1. Buscar twins privados do workspace (digital_twin + photo_avatar ownership=private)
    const [privateTwins, stockLooks] = await Promise.all([
      fetchLooks("&ownership=private").catch(() => [] as HeyGenLook[]),
      fetchLooks("").catch(() => [] as HeyGenLook[]),
    ]);

    // Construir set de IDs privados para marcar no frontend
    const privateIds = new Set(privateTwins.map((a) => a.id));

    // Combinar: privados primeiro, depois estoque (sem duplicatas)
    const combined = [
      ...privateTwins,
      ...stockLooks.filter((a) => !privateIds.has(a.id)),
    ];

    const avatars = combined
      .filter((a) => a.id && a.name)
      .map((a) => ({
        id: a.id,                                          // UUID do look — usar como heygenAvatarId
        label: a.name,
        gender: a.gender ?? "unknown",
        avatarType: a.avatar_type ?? "photo_avatar",      // "photo_avatar" | "digital_twin"
        isPrivate: privateIds.has(a.id),                  // twin do próprio usuário
        previewUrl: a.preview_image_url ?? null,
        previewVideoUrl: a.preview_video_url ?? null,
        orientation: a.preferred_orientation ?? "landscape",
        defaultVoiceId: a.default_voice_id ?? null,
      }));

    req.log.info({ total: avatars.length, private: privateTwins.length }, "HeyGen looks fetched (v3)");
    res.json({ avatars });
  } catch (err) {
    res.json({ avatars: [], error: String(err) });
  }
});

// POST /workspaces/me/persona/clone-avatar — receive base64 image (frame from the
// user's recording) → HeyGen Photo Avatar (v3) → save heygenAvatarId (look UUID).
// v3: POST /v3/avatars type:photo replaces deprecated /v1/talking_photo (404) and
// the old /v1/asset upload-then-save-image_key anti-pattern.
router.post("/me/persona/clone-avatar", async (req, res): Promise<void> => {
  const schema = z.object({
    imageBase64: z.string().min(10),
    mimeType: z.string().default("image/jpeg"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "imageBase64 obrigatório", code: "VALIDATION_ERROR" });
    return;
  }
  const { env } = await import("../../lib/env.js");
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) {
    res.status(422).json({ error: "HeyGen não configurado — adicione HEYGEN_API_KEY", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }
  try {
    // v3: POST /v3/avatars type:photo — returns avatar_item.id (look UUID) synchronously.
    // base64 file input accepted directly; no separate asset-upload step needed.
    const avatarRes = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "photo",
        name: `Avatar NexOS ${req.auth.workspaceId.slice(0, 8)}`,
        file: { type: "base64", data: parsed.data.imageBase64, media_type: parsed.data.mimeType },
      }),
    });
    if (!avatarRes.ok) {
      const errText = await avatarRes.text();
      throw new Error(`HeyGen photo avatar ${avatarRes.status}: ${errText.slice(0, 300)}`);
    }
    const avatarData = (await avatarRes.json()) as {
      data: { avatar_item?: { id: string }; avatar_group?: { id: string } };
    };
    // avatar_item.id is the look UUID used in POST /v3/videos as avatar_id
    const lookId = avatarData.data.avatar_item?.id ?? avatarData.data.avatar_group?.id;
    if (!lookId) {
      throw new Error("HeyGen photo avatar: look ID não retornado — tente novamente");
    }

    const [ws] = await db.select({ settings: workspacesTable.settings })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, req.auth.workspaceId))
      .limit(1);
    const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
    const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
    await db.update(workspacesTable)
      .set({
        settings: {
          ...existingSettings,
          persona: {
            ...existingPersona,
            heygenAvatarId: lookId,
            avatarType: "photo",
            avatarUpdatedAt: new Date().toISOString(),
          },
        } as any,
      })
      .where(eq(workspacesTable.id, req.auth.workspaceId));
    req.log.info({ workspaceId: req.auth.workspaceId, lookId }, "Photo avatar created (v3 look UUID saved)");
    res.json({ heygenAvatarId: lookId, avatarType: "photo", success: true });
  } catch (err) {
    req.log.error({ err }, "Avatar clone failed");
    res.status(500).json({ error: String(err), code: "AVATAR_CLONE_ERROR" });
  }
});

// ── Private avatar training sample library ──────────────────────────────────

router.get("/me/persona/avatar-samples", async (req, res): Promise<void> => {
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, req.auth.workspaceId)).limit(1);
  res.json({ samples: avatarSamplesFromSettings((ws?.settings ?? {}) as Record<string, unknown>) });
});

router.post(
  "/me/persona/avatar-samples",
  express.raw({ type: "*/*", limit: MAX_AVATAR_SAMPLE_BYTES }),
  async (req, res): Promise<void> => {
    const parsed = z.object({
      name: z.string().trim().min(1).max(80),
      consent: z.literal(true),
      consentVersion: z.literal(AVATAR_SAMPLE_CONSENT_VERSION),
    }).safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Informe um nome e confirme o consentimento para guardar esta gravação de avatar.", code: "AVATAR_SAMPLE_CONSENT_REQUIRED" });
      return;
    }
    const contentType = String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
    const format = AVATAR_SAMPLE_MIME_TYPES[contentType];
    const video = Buffer.isBuffer(req.body) ? req.body : null;
    if (!format || !video || video.length < 1024 || video.length > MAX_AVATAR_SAMPLE_BYTES) {
      res.status(400).json({ error: "Envie um vídeo WebM ou MP4 válido de até 300 MB.", code: "AVATAR_SAMPLE_INVALID_FILE" });
      return;
    }

    let tempDir: string | undefined;
    try {
      tempDir = await mkdtemp(path.join(os.tmpdir(), "nexos-avatar-sample-"));
      const tempFile = path.join(tempDir, `sample.${format.extension}`);
      await writeFile(tempFile, video, { flag: "wx" });
      let probe: { streams?: Array<Record<string, unknown>>; format?: { duration?: string; format_name?: string } };
      try {
        const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", tempFile], { maxBuffer: 1024 * 1024 });
        probe = JSON.parse(stdout) as typeof probe;
      } catch {
        res.status(400).json({ error: "O arquivo enviado não contém vídeo válido no formato informado.", code: "AVATAR_SAMPLE_INVALID_VIDEO" });
        return;
      }
      const streams = probe.streams ?? [];
      const durationSeconds = Number(probe.format?.duration ?? 0);
      if (!format.formatPattern.test(probe.format?.format_name ?? "")
        || !streams.some((stream) => stream.codec_type === "video")
        || !streams.some((stream) => stream.codec_type === "audio")) {
        res.status(400).json({ error: "O arquivo precisa corresponder ao formato informado e conter áudio e vídeo.", code: "AVATAR_SAMPLE_INVALID_VIDEO" });
        return;
      }
      if (!Number.isFinite(durationSeconds) || durationSeconds < 5 || durationSeconds > 120) {
        res.status(400).json({ error: "A gravação do avatar precisa durar entre 5 segundos e 2 minutos.", code: "AVATAR_SAMPLE_INVALID_VIDEO" });
        return;
      }

      const workspaceId = req.auth.workspaceId;
      const [ws] = await db.select({ settings: workspacesTable.settings })
        .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
      const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
      const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
      const currentSamples = avatarSamplesFromSettings(existingSettings);
      if (currentSamples.length >= MAX_AVATAR_SAMPLES) {
        res.status(409).json({ error: "Limite de 20 gravações de avatar atingido. Exclua uma para continuar.", code: "AVATAR_SAMPLE_LIMIT" });
        return;
      }

      const sampleId = randomUUID();
      const { avatarSampleObjectKey, uploadBufferToGCS, deleteGCSObject } = await import("../../lib/gcs-recordings.js");
      const objectKey = avatarSampleObjectKey(workspaceId, sampleId, format.extension);
      await uploadBufferToGCS(video, objectKey, contentType);
      const now = new Date().toISOString();
      const sample: AvatarSampleMetadata = {
        sampleId,
        name: parsed.data.name,
        durationSeconds: Math.round(durationSeconds * 10) / 10,
        mimeType: contentType,
        sizeBytes: video.length,
        createdAt: now,
        consentVersion: AVATAR_SAMPLE_CONSENT_VERSION,
        consentedAt: now,
      };
      try {
        await db.update(workspacesTable)
          .set({ settings: { ...existingSettings, persona: { ...existingPersona, avatarSamples: [...currentSamples, sample] } } as any })
          .where(eq(workspacesTable.id, workspaceId));
      } catch {
        await deleteGCSObject(objectKey).catch(() => {});
        throw new Error("Avatar sample metadata persistence failed");
      }
      req.log.info({ workspaceId, sampleId, bytes: video.length, durationSeconds: sample.durationSeconds }, "Private avatar sample saved");
      res.status(201).json({ sample });
    } catch {
      req.log.error({ workspaceId: req.auth.workspaceId }, "Private avatar sample upload failed");
      res.status(500).json({ error: "Não foi possível guardar a gravação. Tente novamente.", code: "AVATAR_SAMPLE_SAVE_FAILED" });
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  },
);

router.get("/me/persona/avatar-samples/:sampleId/video", async (req, res): Promise<void> => {
  const sampleId = String(req.params.sampleId);
  if (!/^[0-9a-f-]{36}$/i.test(sampleId)) {
    res.status(404).json({ error: "Gravação não encontrada.", code: "AVATAR_SAMPLE_NOT_FOUND" });
    return;
  }
  const { avatarSampleObjectKey, createGCSObjectStream } = await import("../../lib/gcs-recordings.js");
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, req.auth.workspaceId)).limit(1);
  const sample = avatarSamplesFromSettings((ws?.settings ?? {}) as Record<string, unknown>).find((item) => item.sampleId === sampleId);
  const format = sample ? AVATAR_SAMPLE_MIME_TYPES[sample.mimeType] : undefined;
  if (!sample || !format) {
    res.status(404).json({ error: "Gravação não encontrada.", code: "AVATAR_SAMPLE_NOT_FOUND" });
    return;
  }
  res.setHeader("Content-Type", sample.mimeType);
  res.setHeader("Content-Length", String(sample.sizeBytes));
  res.setHeader("Cache-Control", "private, no-store");
  const stream = createGCSObjectStream(avatarSampleObjectKey(req.auth.workspaceId, sampleId, format.extension));
  stream.on("error", () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
  stream.pipe(res);
});

router.delete("/me/persona/avatar-samples/:sampleId", async (req, res): Promise<void> => {
  const sampleId = String(req.params.sampleId);
  const workspaceId = req.auth.workspaceId;
  if (!/^[0-9a-f-]{36}$/i.test(sampleId)) {
    res.status(404).json({ error: "Gravação não encontrada.", code: "AVATAR_SAMPLE_NOT_FOUND" });
    return;
  }
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
  const samples = avatarSamplesFromSettings(existingSettings);
  const sample = samples.find((item) => item.sampleId === sampleId);
  const format = sample ? AVATAR_SAMPLE_MIME_TYPES[sample.mimeType] : undefined;
  if (!sample || !format) {
    res.status(404).json({ error: "Gravação não encontrada.", code: "AVATAR_SAMPLE_NOT_FOUND" });
    return;
  }
  const remaining = samples.filter((item) => item.sampleId !== sampleId);
  await db.update(workspacesTable)
    .set({ settings: { ...existingSettings, persona: { ...existingPersona, avatarSamples: remaining } } as any })
    .where(eq(workspacesTable.id, workspaceId));
  const { avatarSampleObjectKey, deleteGCSObject } = await import("../../lib/gcs-recordings.js");
  try {
    await deleteGCSObject(avatarSampleObjectKey(workspaceId, sampleId, format.extension));
  } catch {
    await db.update(workspacesTable)
      .set({ settings: { ...existingSettings, persona: { ...existingPersona, avatarSamples: samples } } as any })
      .where(eq(workspacesTable.id, workspaceId)).catch(() => {});
    res.status(500).json({ error: "Não foi possível remover a gravação. Tente novamente.", code: "AVATAR_SAMPLE_DELETE_FAILED" });
    return;
  }
  req.log.info({ workspaceId, sampleId }, "Private avatar sample deleted");
  res.json({ success: true });
});

// POST /workspaces/me/persona/upload-video/:kind — raw binary upload for large video files.
// Bypasses the global 10 MB JSON body limit via express.raw() applied inline.
// kind: "training" | "consent"
// Content-Type: video/webm or video/mp4
// Returns: { key: string } — the stable GCS key for this video.
router.post(
  "/me/persona/upload-video/:kind",
  express.raw({ type: "*/*", limit: "300mb" }),
  async (req, res): Promise<void> => {
    const kind = req.params["kind"];
    if (kind !== "training" && kind !== "consent") {
      res.status(400).json({ error: "kind deve ser 'training' ou 'consent'", code: "VALIDATION_ERROR" });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "Body vazio — envie o arquivo de vídeo como binário raw", code: "EMPTY_BODY" });
      return;
    }
    const contentType = (req.headers["content-type"] ?? "video/webm").split(";")[0]!.trim();
    try {
      const { personaMediaObjectKey, uploadBufferToGCS } = await import("../../lib/gcs-recordings.js");
      const key = personaMediaObjectKey(req.auth.workspaceId, kind as "training" | "consent");
      await uploadBufferToGCS(req.body as Buffer, key, contentType);
      req.log.info({ workspaceId: req.auth.workspaceId, kind, bytes: req.body.length, key }, "Persona video uploaded to GCS");
      res.json({ key, bytes: req.body.length });
    } catch (err) {
      req.log.error({ err }, "Persona video GCS upload failed");
      res.status(500).json({ error: String(err), code: "GCS_UPLOAD_ERROR" });
    }
  },
);

// ── In-memory chunk buffer for large video uploads ────────────────────────────
// Keyed by `${workspaceId}:${kind}`. Cleared when all chunks received + assembled.
const _uploadChunks = new Map<string, { chunks: (Buffer | null)[]; total: number; contentType: string }>();
const _avatarSampleChunks = new Map<string, { chunks: (Buffer | null)[]; total: number; contentType: string; name: string; startedAt: number }>();

router.post(
  "/me/persona/avatar-samples/chunk",
  express.raw({ type: "*/*", limit: "9mb" }),
  async (req, res): Promise<void> => {
    const parsed = z.object({
      name: z.string().trim().min(1).max(80),
      consent: z.literal("true"),
      consentVersion: z.literal(AVATAR_SAMPLE_CONSENT_VERSION),
    }).safeParse(req.query);
    const uploadId = String(req.headers["x-upload-id"] ?? "");
    const chunkIndex = Number(req.headers["x-chunk-index"] ?? NaN);
    const totalChunks = Number(req.headers["x-total-chunks"] ?? NaN);
    const contentType = String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
    const videoChunk = Buffer.isBuffer(req.body) ? req.body : null;
    if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(uploadId) || !AVATAR_SAMPLE_MIME_TYPES[contentType]
      || !videoChunk || videoChunk.length === 0 || videoChunk.length > 8 * 1024 * 1024
      || !Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 38
      || chunkIndex < 0 || chunkIndex >= totalChunks) {
      res.status(400).json({ error: "Chunk ou consentimento inválido para a gravação de avatar.", code: "AVATAR_SAMPLE_INVALID_CHUNK" });
      return;
    }
    const workspaceId = req.auth.workspaceId;
    for (const [key, session] of _avatarSampleChunks) {
      if (Date.now() - session.startedAt > 15 * 60 * 1000) _avatarSampleChunks.delete(key);
    }
    const sessionKey = `${workspaceId}:${uploadId}`;
    if (chunkIndex === 0 || !_avatarSampleChunks.has(sessionKey)) {
      const activeForWorkspace = [..._avatarSampleChunks.keys()].filter((key) => key.startsWith(`${workspaceId}:`)).length;
      if (activeForWorkspace >= 2 || _avatarSampleChunks.size >= 8) {
        res.status(429).json({ error: "Já há gravações sendo enviadas. Aguarde a conclusão e tente novamente.", code: "AVATAR_SAMPLE_UPLOAD_BUSY" });
        return;
      }
      _avatarSampleChunks.set(sessionKey, { chunks: new Array(totalChunks).fill(null), total: totalChunks, contentType, name: parsed.data.name, startedAt: Date.now() });
    }
    const session = _avatarSampleChunks.get(sessionKey)!;
    if (session.total !== totalChunks || session.contentType !== contentType || session.name !== parsed.data.name) {
      _avatarSampleChunks.delete(sessionKey);
      res.status(400).json({ error: "Os dados da gravação mudaram durante o envio. Tente novamente.", code: "AVATAR_SAMPLE_INVALID_CHUNK" });
      return;
    }
    session.chunks[chunkIndex] = videoChunk;
    const receivedBytes = session.chunks.reduce((total, chunk) => total + (chunk?.length ?? 0), 0);
    if (receivedBytes > MAX_AVATAR_SAMPLE_BYTES) {
      _avatarSampleChunks.delete(sessionKey);
      res.status(413).json({ error: "A gravação excede o limite de 300 MB.", code: "AVATAR_SAMPLE_TOO_LARGE" });
      return;
    }
    if (session.chunks.some((chunk) => !chunk)) {
      res.json({ complete: false, received: session.chunks.filter(Boolean).length, totalChunks });
      return;
    }
    _avatarSampleChunks.delete(sessionKey);
    const video = Buffer.concat(session.chunks as Buffer[]);
    if (video.length > MAX_AVATAR_SAMPLE_BYTES) {
      res.status(413).json({ error: "A gravação excede o limite de 300 MB.", code: "AVATAR_SAMPLE_TOO_LARGE" });
      return;
    }
    try {
      const sample = await persistAvatarSample(workspaceId, session.name, video, session.contentType);
      req.log.info({ workspaceId, sampleId: sample.sampleId, bytes: sample.sizeBytes }, "Private avatar sample saved from chunks");
      res.status(201).json({ complete: true, sample });
    } catch (error) {
      if (error instanceof AvatarSampleUploadError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      req.log.error({ workspaceId }, "Avatar sample chunk upload failed");
      res.status(500).json({ error: "Não foi possível guardar a gravação. Tente novamente.", code: "AVATAR_SAMPLE_SAVE_FAILED" });
    }
  },
);

// POST /workspaces/me/persona/upload-chunk/:kind — chunked upload endpoint for large videos.
// The Replit deployment proxy blocks single requests > ~32 MB (413).
// Clients split the video into ≤8 MB pieces and POST each chunk separately.
// Headers: X-Chunk-Index (0-based), X-Total-Chunks, optional X-Workspace-Id.
// When the last chunk arrives the server reassembles and uploads to GCS.
router.post(
  "/me/persona/upload-chunk/:kind",
  express.raw({ type: "*/*", limit: "9mb" }),
  async (req, res): Promise<void> => {
    const kind = req.params["kind"];
    if (kind !== "training" && kind !== "consent") {
      res.status(400).json({ error: "kind deve ser 'training' ou 'consent'" });
      return;
    }
    const chunkIndex  = parseInt((req.headers["x-chunk-index"]  as string) ?? "0", 10);
    const totalChunks = parseInt((req.headers["x-total-chunks"] as string) ?? "1", 10);
    const contentType = ((req.headers["content-type"] ?? "video/webm") as string).split(";")[0]!.trim();
    const workspaceId = req.auth.workspaceId;
    const bufKey      = `${workspaceId}:${kind}`;

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "Chunk vazio — envie o binário raw no body" });
      return;
    }

    // Initialise or extend the buffer array
    if (chunkIndex === 0 || !_uploadChunks.has(bufKey)) {
      _uploadChunks.set(bufKey, { chunks: new Array(totalChunks).fill(null), total: totalChunks, contentType });
    }
    const session = _uploadChunks.get(bufKey)!;
    session.chunks[chunkIndex] = req.body as Buffer;

    const received = session.chunks.filter(Boolean).length;
    req.log.info({ workspaceId, kind, chunkIndex, totalChunks, received, bytes: (req.body as Buffer).length }, "upload-chunk: received");

    if (received < totalChunks) {
      res.json({ chunkIndex, totalChunks, received, complete: false });
      return;
    }

    // All chunks received — reassemble and push to GCS
    _uploadChunks.delete(bufKey);
    const combined = Buffer.concat(session.chunks as Buffer[]);
    try {
      const { personaMediaObjectKey, uploadBufferToGCS } = await import("../../lib/gcs-recordings.js");
      const key = personaMediaObjectKey(workspaceId, kind as "training" | "consent");
      await uploadBufferToGCS(combined, key, session.contentType);
      req.log.info({ workspaceId, kind, bytes: combined.length, key }, "upload-chunk: GCS upload complete");
      res.json({ key, bytes: combined.length, complete: true });
    } catch (err) {
      req.log.error({ err }, "upload-chunk: GCS upload failed");
      res.status(500).json({ error: String(err), code: "GCS_UPLOAD_ERROR" });
    }
  },
);

// POST /workspaces/me/persona/clone-avatar-video — create HeyGen avatar from already-uploaded GCS videos.
// Accepts { trainingKey, consentKey, frameBase64?, avatarName? } — videos must already be in GCS
// via POST /me/persona/upload-video/:kind.  No base64 video in body (avoids 10 MB JSON limit).
// Falls back to talking_photo when HeyGen Digital Twin is unavailable (non-Enterprise plan).
router.post("/me/persona/clone-avatar-video", async (req, res): Promise<void> => {
  const schema = z.object({
    // trainingKey is optional — when absent the backend uses the stable GCS key
    // (persona-media/{workspaceId}/training.webm) so the caller can omit it when
    // the training video was already uploaded in a previous step.
    trainingKey: z.string().min(5).optional(),
    trainingSampleId: z.string().uuid().optional(),
    consentKey:  z.string().min(5),
    frameBase64: z.string().min(10).optional(),
    avatarName:  z.string().max(80).default("Meu Avatar NexOS"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "consentKey obrigatório (use o endpoint upload-video antes)", code: "VALIDATION_ERROR" });
    return;
  }
  const { env } = await import("../../lib/env.js");
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) {
    res.status(422).json({ error: "HeyGen não configurado — adicione HEYGEN_API_KEY", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }

  const workspaceId = req.auth.workspaceId;

  const { avatarSampleObjectKey, personaMediaObjectKey } = await import("../../lib/gcs-recordings.js");
  const stableTrainingKey = personaMediaObjectKey(workspaceId, "training");
  const stableConsentKey = personaMediaObjectKey(workspaceId, "consent");
  if ((parsed.data.trainingSampleId && parsed.data.trainingKey)
    || (parsed.data.trainingKey && parsed.data.trainingKey !== stableTrainingKey)
    || parsed.data.consentKey !== stableConsentKey) {
    res.status(400).json({ error: "Os vídeos enviados não pertencem ao fluxo autenticado deste workspace.", code: "INVALID_PERSONA_MEDIA_KEY" });
    return;
  }
  let savedTrainingSample: AvatarSampleMetadata | undefined;
  if (parsed.data.trainingSampleId) {
    const [ws] = await db.select({ settings: workspacesTable.settings })
      .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
    savedTrainingSample = avatarSamplesFromSettings((ws?.settings ?? {}) as Record<string, unknown>)
      .find((sample) => sample.sampleId === parsed.data.trainingSampleId);
    if (!savedTrainingSample) {
      res.status(404).json({ error: "Gravação de avatar não encontrada.", code: "AVATAR_SAMPLE_NOT_FOUND" });
      return;
    }
  }

  async function savePersona(fields: Record<string, unknown>) {
    const [ws] = await db.select({ settings: workspacesTable.settings })
      .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
    const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
    const existingPersona  = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
    await db.update(workspacesTable)
      .set({ settings: { ...existingSettings, persona: { ...existingPersona, ...fields, avatarUpdatedAt: new Date().toISOString() } } as any })
      .where(eq(workspacesTable.id, workspaceId));
  }

  async function talkingPhotoFallback(frameBase64: string): Promise<string> {
    // v3 photo avatar creation — replaces deprecated /v1/talking_photo (404).
    // Returns look UUID (avatar_item.id) for use in POST /v3/videos as avatar_id.
    const r = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: { "X-Api-Key": heygenKey!, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "photo",
        name: `Avatar NexOS ${workspaceId.slice(0, 8)}`,
        file: { type: "base64", data: frameBase64, media_type: "image/jpeg" },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`HeyGen photo avatar ${r.status}: ${t.slice(0, 300)}`);
    }
    const d = (await r.json()) as { data: { avatar_item?: { id: string }; avatar_group?: { id: string } } };
    const lookId = d.data.avatar_item?.id ?? d.data.avatar_group?.id;
    if (!lookId) throw new Error("HeyGen photo avatar: look ID não retornado");
    return lookId;
  }

  try {
    const { getPersonaMediaSignedUrl } = await import("../../lib/gcs-recordings.js");
    const { signAccess }               = await import("../auth/auth.service.js");

    // Prefer GCS V4 signed URLs (HeyGen downloads directly from GCS, no proxy hop).
    // Fall back to our persona-media endpoint with a long-lived JWT when signing is
    // unavailable (Replit external_account sidecar without signBlob permission).
    const base = env.APP_URL;

    async function buildDownloadUrl(key: string, sampleId?: string): Promise<string> {
      const signed = await getPersonaMediaSignedUrl(key, 7200);
      if (signed) return signed;
      // Fallback: stream through our server using a long-lived token.
      const token    = signAccess({ userId: req.auth.userId, workspaceId, email: req.auth.email });
      if (sampleId) return `${base}/api/workspaces/persona-avatar-sample/${workspaceId}/${sampleId}?token=${token}`;
      const filename = key.split("/").pop()!;
      return `${base}/api/workspaces/persona-media/${workspaceId}/${filename}?token=${token}`;
    }

    // Resolve the training key — fall back to stable GCS key when not supplied
    const resolvedTrainingKey = savedTrainingSample
      ? avatarSampleObjectKey(workspaceId, savedTrainingSample.sampleId, AVATAR_SAMPLE_MIME_TYPES[savedTrainingSample.mimeType]!.extension)
      : parsed.data.trainingKey ?? stableTrainingKey;

    const [trainingUrl, consentUrl] = await Promise.all([
      buildDownloadUrl(resolvedTrainingKey, savedTrainingSample?.sampleId),
      buildDownloadUrl(stableConsentKey),
    ]);

    req.log.info({ workspaceId }, "Calling HeyGen Digital Twin (v3)");

    // ── Attempt Digital Twin via v3 API ────────────────────────────────────
    // POST /v3/avatars type:digital_twin — replaces deprecated /v2/video_avatar (405).
    // Consent is a separate call: POST /v3/avatars/{group_id}/consent.
    const dtRes = await fetch("https://api.heygen.com/v3/avatars", {
      method: "POST",
      headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "digital_twin",
        name: parsed.data.avatarName,
        file: { type: "url", url: trainingUrl },
      }),
    });

    if (dtRes.ok) {
      const dtData = (await dtRes.json()) as {
        data: { avatar_group?: { id: string; status?: string }; id?: string };
      };
      // v3 returns the avatar group (identity), not the look yet (async training)
      const groupId = dtData.data.avatar_group?.id ?? dtData.data.id;
      if (!groupId) throw new Error("HeyGen digital twin: group ID não retornado");

      // Submit consent video (Enterprise plan) OR initiate webcam consent flow
      let consentPageUrl: string | undefined;
      try {
        const consentRes = await fetch(`https://api.heygen.com/v3/avatars/${groupId}/consent`, {
          method: "POST",
          headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
          body: JSON.stringify({ consent_video: { type: "url", url: consentUrl } }),
        });
        if (!consentRes.ok) {
          // Non-Enterprise: consent video rejected → initiate webcam consent flow
          req.log.warn({ workspaceId, groupId, status: consentRes.status }, "Consent video upload rejected — initiating webcam consent");
          const webcamRes = await fetch(`https://api.heygen.com/v3/avatars/${groupId}/consent`, {
            method: "POST",
            headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
            body: JSON.stringify({ reroute_url: `${env.APP_URL}/configuracoes/persona` }),
          });
          if (webcamRes.ok) {
            const webcamData = (await webcamRes.json()) as { data: { url?: string } };
            consentPageUrl = webcamData.data?.url;
          }
        } else {
          req.log.info({ workspaceId, groupId }, "Consent video submitted (Enterprise)");
        }
      } catch (consentErr) {
        req.log.warn({ err: consentErr, workspaceId, groupId }, "Consent submission error (non-fatal)");
      }

      const trainingStatus = consentPageUrl ? "pending_consent" : "pending";
      // Salvar consentUrl no persona para exibição persistente na UI
      await savePersona({
        digitalTwinId: groupId,
        ...(savedTrainingSample ? { avatarTrainingSampleId: savedTrainingSample.sampleId } : {}),
        avatarType: "digital_twin",
        avatarTrainingStatus: trainingStatus,
        ...(consentPageUrl ? { heygenConsentUrl: consentPageUrl } : {}),
      });
      req.log.info({ workspaceId, digitalTwinId: groupId, trainingStatus }, "Digital twin training started (v3)");
      res.json({
        digitalTwinId: groupId,
        avatarTrainingStatus: trainingStatus,
        avatarType: "digital_twin",
        ...(consentPageUrl ? { consentUrl: consentPageUrl } : {}),
        success: true,
      });
      return;
    }

    const dtStatus  = dtRes.status;
    const dtErrText = await dtRes.text();
      req.log.warn({ workspaceId, dtStatus }, "Digital Twin rejected — trying photo avatar fallback");

    if (!parsed.data.frameBase64) {
      res.status(422).json({
        error: `HeyGen rejeitou Digital Twin (HTTP ${dtStatus}). Forneça frameBase64 para criar um avatar de foto.`,
        code:  "HEYGEN_ENTERPRISE_REQUIRED",
        heygenStatus: dtStatus,
        heygenError:  dtErrText.slice(0, 200),
      });
      return;
    }

    // ── Fallback: photo avatar from webcam frame (v3) ──────────────────────
    const photoLookId = await talkingPhotoFallback(parsed.data.frameBase64);
    await savePersona({ heygenAvatarId: photoLookId, avatarType: "photo" });
    req.log.info({ workspaceId, photoLookId }, "Photo avatar (v3) created as fallback — look UUID saved");
    res.json({ heygenAvatarId: photoLookId, avatarType: "photo", fallback: true, success: true });

  } catch (err) {
    req.log.error({ err }, "Avatar clone failed");
    res.status(500).json({ error: String(err), code: "AVATAR_CLONE_ERROR" });
  }
});

// GET /workspaces/me/persona/avatar-training-status — poll HeyGen digital twin training;
// once complete, resolves the real avatar_id via v3 avatars/looks and saves heygenAvatarId.
router.get("/me/persona/avatar-training-status", async (req, res): Promise<void> => {
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
  const digitalTwinId = existingPersona["digitalTwinId"] as string | undefined;
  if (!digitalTwinId) {
    res.status(404).json({ error: "Nenhum treinamento de avatar em andamento", code: "NOT_FOUND" });
    return;
  }
  if (existingPersona["avatarTrainingStatus"] === "complete" && existingPersona["heygenAvatarId"]) {
    res.json({ status: "complete", heygenAvatarId: existingPersona["heygenAvatarId"] });
    return;
  }
  const { env } = await import("../../lib/env.js");
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) {
    res.status(422).json({ error: "HeyGen não configurado", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }
  try {
    // v3: GET /v3/avatars/{group_id} — status: "pending"|"processing"|"completed"|"failed"
    // Replaces deprecated /v2/video_avatar/{id} poll endpoint.
    const statusRes = await fetch(`https://api.heygen.com/v3/avatars/${digitalTwinId}`, {
      headers: { "X-Api-Key": heygenKey },
    });
    if (!statusRes.ok) {
      const errText = await statusRes.text();
      throw new Error(`HeyGen status ${statusRes.status}: ${errText.slice(0, 300)}`);
    }
    const statusData = (await statusRes.json()) as {
      data: { status: string; consent_status?: string; looks_count?: number };
    };
    const heygenStatus = statusData.data.status; // "pending"|"processing"|"completed"|"failed"
    // Map v3 status to legacy frontend values for backward compat
    const legacyStatus = heygenStatus === "completed" ? "complete"
      : heygenStatus === "processing" ? "in_progress"
      : heygenStatus;

    if (heygenStatus === "failed") {
      await db.update(workspacesTable)
        .set({ settings: { ...existingSettings, persona: { ...existingPersona, avatarTrainingStatus: "failed" } } as any })
        .where(eq(workspacesTable.id, req.auth.workspaceId));
      res.json({ status: "failed" });
      return;
    }
    if (heygenStatus !== "completed") {
      await db.update(workspacesTable)
        .set({ settings: { ...existingSettings, persona: { ...existingPersona, avatarTrainingStatus: legacyStatus } } as any })
        .where(eq(workspacesTable.id, req.auth.workspaceId));
      res.json({ status: legacyStatus, consentStatus: statusData.data.consent_status });
      return;
    }

    // Completed — resolve the look UUID via v3 looks endpoint filtered by group_id.
    // digitalTwinId IS the avatar group_id in v3 terminology.
    // Look items have field "id" (look UUID, used in POST /v3/videos) and "group_id" (avatar identity).
    const looksRes = await fetch(
      `https://api.heygen.com/v3/avatars/looks?group_id=${digitalTwinId}&ownership=private&limit=50`,
      { headers: { "X-Api-Key": heygenKey } },
    );
    if (!looksRes.ok) {
      const errText = await looksRes.text();
      throw new Error(`HeyGen looks ${looksRes.status}: ${errText.slice(0, 300)}`);
    }
    const looksData = (await looksRes.json()) as { data: { id: string; group_id?: string }[] };
    // Match by group_id first; fall back to first look if filter not supported
    const match =
      looksData.data.find((a) => a.group_id === digitalTwinId) ??
      looksData.data[0];
    if (!match) {
      throw new Error("Digital twin marcado como completo mas nenhum look encontrado na HeyGen");
    }
    // match.id is the v3 look UUID — the correct avatar_id for POST /v3/videos
    const heygenAvatarId = match.id;

    await db.update(workspacesTable)
      .set({
        settings: {
          ...existingSettings,
          persona: {
            ...existingPersona,
            heygenAvatarId,
            avatarType: "digital_twin",
            avatarTrainingStatus: "complete",
            avatarUpdatedAt: new Date().toISOString(),
          },
        } as any,
      })
      .where(eq(workspacesTable.id, req.auth.workspaceId));
    req.log.info({ workspaceId: req.auth.workspaceId, heygenAvatarId, groupId: digitalTwinId }, "Digital twin complete — look UUID saved (v3)");
    res.json({ status: "complete", heygenAvatarId });
  } catch (err) {
    req.log.error({ err }, "Digital twin status check failed");
    res.status(500).json({ error: String(err), code: "AVATAR_STATUS_ERROR" });
  }
});

// POST /workspaces/me/persona/avatar-consent-url
// Regenera (ou recupera) o link de consentimento por webcam do HeyGen para o digital twin atual.
// Útil quando o consentUrl foi perdido ou expirou.
router.post("/me/persona/avatar-consent-url", async (req, res): Promise<void> => {
  const { env } = await import("../../lib/env.js");
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) { res.status(422).json({ error: "HeyGen não configurado", code: "PROVIDER_NOT_CONFIGURED" }); return; }

  const workspaceId = req.auth.workspaceId;
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const persona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;

  const digitalTwinId = persona["digitalTwinId"] as string | undefined;
  if (!digitalTwinId) {
    res.status(404).json({ error: "Nenhum digital twin encontrado — grave os vídeos primeiro", code: "NO_DIGITAL_TWIN" });
    return;
  }

  // Se já temos um URL salvo, retorná-lo diretamente
  if (persona["heygenConsentUrl"]) {
    res.json({ consentUrl: persona["heygenConsentUrl"], cached: true });
    return;
  }

  try {
    const { env: envLib } = await import("../../lib/env.js");
    const appUrl = envLib.APP_URL ?? "https://agencianexos.vip";
    const webcamRes = await fetch(`https://api.heygen.com/v3/avatars/${digitalTwinId}/consent`, {
      method: "POST",
      headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
      body: JSON.stringify({ reroute_url: `${appUrl}/configuracoes/persona` }),
    });
    if (!webcamRes.ok) {
      const errText = await webcamRes.text();
      throw new Error(`HeyGen consent ${webcamRes.status}: ${errText.slice(0, 300)}`);
    }
    const webcamData = (await webcamRes.json()) as { data: { url?: string } };
    const consentUrl = webcamData.data?.url;
    if (!consentUrl) throw new Error("HeyGen não retornou URL de consentimento");

    // Salvar para não perder novamente
    await db.update(workspacesTable)
      .set({ settings: { ...existingSettings, persona: { ...persona, heygenConsentUrl: consentUrl } } as any })
      .where(eq(workspacesTable.id, workspaceId));

    req.log.info({ workspaceId, digitalTwinId }, "HeyGen consent URL regenerated");
    res.json({ consentUrl, cached: false });
  } catch (err) {
    req.log.error({ err }, "Failed to regenerate HeyGen consent URL");
    res.status(500).json({ error: String(err), code: "CONSENT_URL_ERROR" });
  }
});

// GET /workspaces/me/persona/avatar-recovery-status
// Returns full avatar state from DB + which GCS videos exist (checked independently).
// hasTrainingVideo + hasConsentVideo let the frontend restore the correct recording step.
router.get("/me/persona/avatar-recovery-status", async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const persona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;

  let hasTrainingVideo = false;
  let hasConsentVideo  = false;
  try {
    const { personaMediaObjectKey, getGCSObjectMeta } = await import("../../lib/gcs-recordings.js");
    await Promise.allSettled([
      getGCSObjectMeta(personaMediaObjectKey(workspaceId, "training")).then(() => { hasTrainingVideo = true; }),
      getGCSObjectMeta(personaMediaObjectKey(workspaceId, "consent")).then(()  => { hasConsentVideo  = true; }),
    ]);
  } catch { /* ignore — GCS unavailable */ }

  res.json({
    heygenAvatarId:       persona["heygenAvatarId"]       ?? null,
    digitalTwinId:        persona["digitalTwinId"]         ?? null,
    avatarTrainingStatus: persona["avatarTrainingStatus"]  ?? null,
    avatarType:           persona["avatarType"]            ?? null,
    heygenConsentUrl:     persona["heygenConsentUrl"]      ?? null,
    hasTrainingVideo,
    hasConsentVideo,
    hasGCSVideos: hasTrainingVideo || hasConsentVideo,
  });
});

// ─── Demonstração do avatar: gera vídeo curto com o avatar do workspace ──────

// Helper: busca o primeiro voice_id português disponível no HeyGen
async function getDefaultHeygenVoiceId(heygenKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.heygen.com/v2/voices?limit=100", {
      headers: { "X-Api-Key": heygenKey },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { voices?: { voice_id: string; language?: string; name?: string }[] } };
    const voices = data.data?.voices ?? [];
    // Preferir voz brasileira (pt-BR), depois portuguesa, depois qualquer uma
    const ptBr = voices.find(v => v.language?.toLowerCase().includes("pt-br") || v.name?.toLowerCase().includes("brasil"));
    const pt   = voices.find(v => v.language?.toLowerCase().includes("pt"));
    return (ptBr ?? pt ?? voices[0])?.voice_id ?? null;
  } catch {
    return null;
  }
}

// POST /workspaces/me/persona/generate-avatar-demo
// Gera um vídeo demonstração curto com o avatar digital do workspace.
// Retorna { jobId, status: "generating" }. Frontend faz polling via avatar-demo-status.
router.post("/me/persona/generate-avatar-demo", async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;
  const { env } = await import("../../lib/env.js");
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) {
    res.status(422).json({ error: "HeyGen não configurado (HEYGEN_API_KEY ausente)", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }

  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const persona = (((ws?.settings ?? {}) as Record<string, unknown>)["persona"] ?? {}) as Record<string, unknown>;
  const heygenAvatarId  = persona["heygenAvatarId"]  as string | undefined;
  const heygenVoiceId   = persona["heygenVoiceId"]   as string | undefined;
  const digitalTwinId   = persona["digitalTwinId"]   as string | undefined;

  if (!heygenAvatarId) {
    res.status(400).json({ error: "Avatar ainda não está configurado. Aguarde o término do treinamento.", code: "AVATAR_NOT_READY" });
    return;
  }

  // Pre-flight 1: verificar se o look específico já terminou de processar no HeyGen.
  // O HeyGen salva o look UUID quando o grupo fica "completed", mas o look individual
  // pode ainda estar em processamento interno por vários minutos.
  // GET /v3/avatars/looks/{lookId} retorna { data: { id, status: "processing"|"completed"|"failed" } }
  try {
    const lookStatusRes = await fetch(`https://api.heygen.com/v3/avatars/looks/${heygenAvatarId}`, {
      headers: { "X-Api-Key": heygenKey },
    });
    if (lookStatusRes.ok) {
      const lookStatusData = (await lookStatusRes.json()) as { data?: { status?: string } };
      const lookStatus = lookStatusData.data?.status;
      req.log.info({ workspaceId, heygenAvatarId, lookStatus }, "Avatar demo: pre-flight look status check");
      if (lookStatus && lookStatus !== "completed") {
        res.status(202).json({
          error: "O HeyGen ainda está finalizando o processamento interno do avatar. Aguarde alguns minutos e tente novamente.",
          code: "AVATAR_STILL_PROCESSING",
          retryAfterSeconds: 60,
          lookStatus,
        });
        return;
      }
    }
  } catch (lookErr) {
    req.log.warn({ lookErr, heygenAvatarId }, "Avatar demo: pre-flight look check failed — proceeding anyway");
  }

  // Pre-flight 2: verificar se o consentimento do grupo já foi aprovado no HeyGen.
  // Digital twins requerem que o titular grave consent via HeyGen antes de gerar vídeos.
  // GET /v3/avatars/{group_id} retorna { data: { status, consent_status } }
  if (digitalTwinId) {
    try {
      const groupRes = await fetch(`https://api.heygen.com/v3/avatars/${digitalTwinId}`, {
        headers: { "X-Api-Key": heygenKey },
      });
      if (groupRes.ok) {
        const groupData = (await groupRes.json()) as { data?: { status?: string; consent_status?: string } };
        const consentStatus = groupData.data?.consent_status;
        req.log.info({ workspaceId, digitalTwinId, consentStatus }, "Avatar demo: pre-flight consent status check");
        if (consentStatus && consentStatus !== "approved") {
          res.status(202).json({
            error: "O consentimento do avatar ainda não foi aprovado pelo HeyGen. Grave novamente para completar o fluxo.",
            code: "AVATAR_CONSENT_REQUIRED",
            consentStatus,
          });
          return;
        }
      }
    } catch (consentErr) {
      req.log.warn({ consentErr, digitalTwinId }, "Avatar demo: pre-flight consent check failed — proceeding anyway");
    }
  }

  // Resolver voice ID: usar o configurado ou buscar voz padrão PT-BR
  let voiceId = heygenVoiceId;
  if (!voiceId) {
    voiceId = (await getDefaultHeygenVoiceId(heygenKey)) ?? undefined;
  }
  if (!voiceId) {
    res.status(400).json({
      error: "Voz não configurada. Vá em Configurações → Persona e selecione uma voz para o avatar.",
      code: "VOICE_NOT_CONFIGURED",
    });
    return;
  }

  try {
    const { generateAvatarVideo } = await import("../video-production/video-generation.service.js");
    const result = await generateAvatarVideo({
      voiceoverText:
        "Olá! Sou seu avatar digital criado com inteligência artificial pela NexOS AI. " +
        "Estou pronto para aparecer nos seus reels, anúncios e campanhas automaticamente — " +
        "sem você precisar gravar cada vídeo.",
      avatarId: heygenAvatarId,
      voiceId,
      aspectRatio: "9:16",
    });

    if (result.status === "submitted" && result.jobId) {
      req.log.info({ workspaceId, jobId: result.jobId }, "Avatar demo: geração iniciada ✓");
      res.json({ jobId: result.jobId, status: "generating" });
      return;
    }
    // Avatar ainda em processamento interno no HeyGen — erro temporário, não permanente
    if (result.status === "avatar_still_processing") {
      req.log.info({ workspaceId }, "Avatar demo: look ainda em processamento no HeyGen");
      res.status(202).json({
        error: "O HeyGen ainda está finalizando o processamento interno do avatar. Aguarde alguns minutos e tente novamente.",
        code: "AVATAR_STILL_PROCESSING",
        retryAfterSeconds: 60,
      });
      return;
    }
    // Consentimento do grupo pendente — exige que o usuário re-grave o avatar para completar o consent flow
    if (result.status === "avatar_consent_required") {
      req.log.info({ workspaceId }, "Avatar demo: consentimento do grupo pendente no HeyGen");
      res.status(202).json({
        error: "O consentimento do avatar ainda não foi aprovado pelo HeyGen. Grave novamente para completar o fluxo.",
        code: "AVATAR_CONSENT_REQUIRED",
      });
      return;
    }
    res.status(500).json({ error: result.error ?? "Falha ao iniciar geração do demo", code: "GENERATION_FAILED" });
  } catch (err) {
    req.log.error({ err }, "generate-avatar-demo: erro");
    res.status(500).json({ error: String(err), code: "INTERNAL_ERROR" });
  }
});

// GET /workspaces/me/persona/avatar-demo-status?jobId=xxx
// Verifica o status do vídeo demo no HeyGen. Retorna { status, videoUrl? }.
router.get("/me/persona/avatar-demo-status", async (req, res): Promise<void> => {
  const jobId = (req.query as { jobId?: string }).jobId ?? "";
  if (!jobId) {
    res.status(400).json({ error: "jobId obrigatório", code: "MISSING_PARAM" });
    return;
  }
  try {
    const { pollHeyGenJob } = await import("../video-production/video-generation.service.js");
    const result = await pollHeyGenJob(jobId);
    if (result.status === "ready" && result.clipUrl) {
      res.json({ status: "ready", videoUrl: result.clipUrl });
      return;
    }
    if (result.status === "failed") {
      res.json({ status: "failed", error: result.error });
      return;
    }
    res.json({ status: "generating" });
  } catch (err) {
    res.status(500).json({ error: String(err), code: "POLL_ERROR" });
  }
});

// GET /workspaces/me/persona/voice-clone-progress
// Returns in-progress voice clone session so the UI can offer "Resume (X/5 takes)" on reload.
router.get("/me/persona/voice-clone-progress", async (req, res): Promise<void> => {
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, req.auth.workspaceId)).limit(1);
  const persona = (((ws?.settings ?? {}) as Record<string, unknown>)["persona"] ?? {}) as Record<string, unknown>;
  const progress = persona["voiceCloneProgress"] as
    | { recordingId?: string; completedTakeIds?: string[] }
    | null
    | undefined;
  if (!progress?.recordingId) {
    res.json({ inProgress: false });
    return;
  }
  res.json({
    inProgress:       true,
    recordingId:      progress.recordingId,
    completedTakeIds: progress.completedTakeIds ?? [],
  });
});

// POST /workspaces/me/persona/voice-clone-progress
// Saves or clears in-progress voice clone session.
// Pass recordingId: null to clear (after completion or cancellation).
router.post("/me/persona/voice-clone-progress", async (req, res): Promise<void> => {
  const schema = z.object({
    recordingId:      z.string().nullable(),
    completedTakeIds: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, req.auth.workspaceId)).limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const existingPersona  = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
  const newProgress = parsed.data.recordingId
    ? { recordingId: parsed.data.recordingId, completedTakeIds: parsed.data.completedTakeIds ?? [] }
    : null;
  await db.update(workspacesTable)
    .set({ settings: { ...existingSettings, persona: { ...existingPersona, voiceCloneProgress: newProgress } } as any })
    .where(eq(workspacesTable.id, req.auth.workspaceId));
  res.json({ ok: true });
});

// POST /workspaces/me/persona/retry-avatar-from-gcs
// Retry avatar creation without re-recording: reuses the GCS training+consent videos
// that were already uploaded. Accepts optional frameBase64 (JPEG snapshot from webcam)
// used as talking_photo fallback when HeyGen Digital Twin is not available on the plan.
router.post("/me/persona/retry-avatar-from-gcs", async (req, res): Promise<void> => {
  const schema = z.object({
    frameBase64: z.string().min(10).optional(),
    avatarName:  z.string().max(80).default("Meu Avatar NexOS"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", code: "VALIDATION_ERROR" });
    return;
  }
  const { env } = await import("../../lib/env.js");
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) {
    res.status(422).json({ error: "HeyGen não configurado", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }
  const workspaceId = req.auth.workspaceId;

  try {
    const { personaMediaObjectKey, getGCSObjectMeta } = await import("../../lib/gcs-recordings.js");
    const { signAccess } = await import("../auth/auth.service.js");
    const trainingKey = personaMediaObjectKey(workspaceId, "training");
    const consentKey  = personaMediaObjectKey(workspaceId, "consent");

    try { await getGCSObjectMeta(trainingKey); } catch {
      res.status(404).json({ error: "Vídeos de treino não encontrados no storage. Grave novamente.", code: "GCS_VIDEOS_NOT_FOUND" });
      return;
    }

    const [ws] = await db.select({ settings: workspacesTable.settings })
      .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
    const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
    const existingPersona  = (existingSettings["persona"] ?? {}) as Record<string, unknown>;

    async function savePersona(fields: Record<string, unknown>) {
      await db.update(workspacesTable)
        .set({ settings: { ...existingSettings, persona: { ...existingPersona, ...fields, avatarUpdatedAt: new Date().toISOString() } } as any })
        .where(eq(workspacesTable.id, workspaceId));
    }

    // Build signed GCS URLs so HeyGen can fetch the videos
    const mediaToken  = signAccess({ userId: req.auth.userId, workspaceId, email: req.auth.email });
    const base        = env.APP_URL;
    const trainingUrl = `${base}/api/workspaces/persona-media/${workspaceId}/${trainingKey.split("/").pop()!}?token=${mediaToken}`;
    const consentUrl  = `${base}/api/workspaces/persona-media/${workspaceId}/${consentKey.split("/").pop()!}?token=${mediaToken}`;

    // Try Digital Twin (Enterprise plans only)
    const dtRes = await fetch("https://api.heygen.com/v2/video_avatar", {
      method: "POST",
      headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_name: parsed.data.avatarName, training_footage_url: trainingUrl, video_consent_url: consentUrl }),
    });
    if (dtRes.ok) {
      const dtData = (await dtRes.json()) as { data: { avatar_id: string } };
      const digitalTwinId = dtData.data.avatar_id;
      await savePersona({ digitalTwinId, avatarType: "digital_twin", avatarTrainingStatus: "pending" });
      req.log.info({ workspaceId, digitalTwinId }, "Avatar retry: digital twin started");
      res.json({ digitalTwinId, avatarTrainingStatus: "pending", avatarType: "digital_twin", success: true });
      return;
    }

    // Fallback to talking_photo using webcam snapshot
    if (!parsed.data.frameBase64) {
      res.status(422).json({
        error: "Plano HeyGen não suporta Digital Twin. Tire uma foto (frameBase64) para criar o avatar básico.",
        code: "HEYGEN_ENTERPRISE_REQUIRED",
      });
      return;
    }
    const buf       = Buffer.from(parsed.data.frameBase64, "base64");
    const uploadRes = await fetch("https://upload.heygen.com/v1/asset", {
      method: "POST",
      headers: { "X-Api-Key": heygenKey, "Content-Type": "image/jpeg" },
      body: buf,
    });
    if (!uploadRes.ok) {
      const t = await uploadRes.text();
      throw new Error(`HeyGen asset upload ${uploadRes.status}: ${t.slice(0, 200)}`);
    }
    const uploadData  = (await uploadRes.json()) as { data: { image_key: string } };
    const talkingPhotoId = uploadData.data.image_key;
    await savePersona({ heygenAvatarId: talkingPhotoId, avatarType: "talking_photo" });
    req.log.info({ workspaceId, talkingPhotoId }, "Avatar retry: talking_photo created");
    res.json({ heygenAvatarId: talkingPhotoId, avatarType: "talking_photo", fallback: true, success: true });

  } catch (err) {
    req.log.error({ err }, "Avatar retry from GCS failed");
    res.status(500).json({ error: String(err), code: "AVATAR_RETRY_ERROR" });
  }
});

// POST /workspaces/me/persona/select-stock-avatar — pick a ready-made avatar (no recording)
// Also accepts voiceId to set a HeyGen stock voice for reel generation (saved as heygenVoiceId)
router.post("/me/persona/select-stock-avatar", async (req, res): Promise<void> => {
  const schema = z.object({
    avatarId: z.string().min(1),
    voiceId: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "avatarId inválido", code: "VALIDATION_ERROR" });
    return;
  }
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
  await db.update(workspacesTable)
    .set({
      settings: {
        ...existingSettings,
        persona: {
          ...existingPersona,
          heygenAvatarId: parsed.data.avatarId,
          avatarType: "stock",
          avatarUpdatedAt: new Date().toISOString(),
          ...(parsed.data.voiceId ? { heygenVoiceId: parsed.data.voiceId } : {}),
        },
      } as any,
    })
    .where(eq(workspacesTable.id, req.auth.workspaceId));
  res.json({ heygenAvatarId: parsed.data.avatarId, avatarType: "stock", heygenVoiceId: parsed.data.voiceId, success: true });
});

// GET /workspaces/me/persona/heygen-voices — list Portuguese voices from HeyGen for reel narration
router.get("/me/persona/heygen-voices", async (req, res): Promise<void> => {
  const { env } = await import("../../lib/env.js");
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) {
    res.status(422).json({ error: "HeyGen não configurado", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }
  try {
    const r = await fetch("https://api.heygen.com/v2/voices?limit=500", {
      headers: { "X-Api-Key": heygenKey, Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`HeyGen voices ${r.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await r.json() as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = data?.data?.voices ?? [];
    // Filter for Portuguese (Brazil) voices — HeyGen uses "Portuguese" or contains "pt"
    const ptVoices = all
      .filter((v) => {
        const lang = (v.language ?? v.locale ?? "").toLowerCase();
        return lang.includes("portuguese") || lang.includes("portugu") || lang.startsWith("pt");
      })
      .slice(0, 12)
      .map((v) => ({
        voice_id: v.voice_id,
        name: v.display_name ?? v.name ?? v.voice_id,
        language: v.language ?? v.locale ?? "pt",
        gender: v.gender ?? "neutral",
        preview_audio: v.preview_audio ?? null,
      }));
    // Fallback: if no pt voices found return top 6 generic voices
    const voices = ptVoices.length > 0 ? ptVoices : all.slice(0, 6).map((v) => ({
      voice_id: v.voice_id,
      name: v.display_name ?? v.name ?? v.voice_id,
      language: v.language ?? "",
      gender: v.gender ?? "neutral",
      preview_audio: v.preview_audio ?? null,
    }));
    res.json({ voices });
  } catch (err) {
    req.log.error({ err }, "heygen-voices fetch failed");
    res.status(500).json({ error: String(err), code: "FETCH_ERROR" });
  }
});

// ── Compliance / Full Identification endpoints ─────────────────────────────

const complianceSchema = z.object({
  // Personal
  cpf:           z.string().max(20).optional(),
  phone:         z.string().max(30).optional(),
  whatsapp:      z.string().max(30).optional(),
  birthdate:     z.string().max(20).optional(),
  nationality:   z.string().max(80).optional(),
  maritalStatus: z.enum(["single","married","divorced","widowed","other"]).optional(),
  gender:        z.enum(["male","female","non_binary","prefer_not_to_say"]).optional(),
  // Business
  personType:    z.enum(["pf","pj"]).optional(),
  cnpj:          z.string().max(20).optional(),
  razaoSocial:   z.string().max(200).optional(),
  nomeFantasia:  z.string().max(200).optional(),
  inscEstadual:  z.string().max(50).optional(),
  // Address
  cep:           z.string().max(10).optional(),
  logradouro:    z.string().max(300).optional(),
  numero:        z.string().max(20).optional(),
  complemento:   z.string().max(100).optional(),
  bairro:        z.string().max(100).optional(),
  cidade:        z.string().max(100).optional(),
  estado:        z.string().max(2).optional(),
  pais:          z.string().max(80).optional(),
  // LGPD consents
  consentDataProcessing: z.boolean().optional(),
  consentMarketing:      z.boolean().optional(),
  consentAnalytics:      z.boolean().optional(),
});

// GET /workspaces/me/compliance
router.get("/me/compliance", async (req, res): Promise<void> => {
  const [ws] = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  const settings = (ws?.settings ?? {}) as Record<string, unknown>;
  res.json({ compliance: (settings["compliance"] ?? {}) as Record<string, unknown> });
});

// PATCH /workspaces/me/compliance
router.patch("/me/compliance", async (req, res): Promise<void> => {
  const parsed = complianceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const [ws] = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);
  const existingSettings    = (ws?.settings ?? {}) as Record<string, unknown>;
  const existingCompliance  = (existingSettings["compliance"] ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) {
      if ((k === "consentDataProcessing" || k === "consentMarketing" || k === "consentAnalytics") && v === true) {
        patch[k] = v;
        patch[`${k}At`] = existingCompliance[`${k}At`] ?? new Date().toISOString();
      } else if (k === "consentDataProcessing" || k === "consentMarketing" || k === "consentAnalytics") {
        patch[k] = v;
      } else {
        patch[k] = v;
      }
    }
  }
  const updatedCompliance = { ...existingCompliance, ...patch, updatedAt: new Date().toISOString() };
  await db
    .update(workspacesTable)
    .set({ settings: { ...existingSettings, compliance: updatedCompliance } as any })
    .where(eq(workspacesTable.id, req.auth.workspaceId));
  req.log.info({ workspaceId: req.auth.workspaceId }, "Compliance data updated");
  res.json({ compliance: updatedCompliance });
});

// GET /workspaces/me/identity — Longitudinal strategic profile
router.get("/me/identity", async (req, res): Promise<void> => {
  const { getIdentityProfile } = await import("../campaign-brain/identity-memory.service.js");
  const profile = await getIdentityProfile(req.auth.workspaceId);
  res.json({ profile });
});

// POST /workspaces/me/identity/refresh — Rebuild profile from campaign history
router.post("/me/identity/refresh", async (req, res): Promise<void> => {
  const { refreshIdentityProfile } = await import("../campaign-brain/identity-memory.service.js");
  const profile = await refreshIdentityProfile(req.auth.workspaceId, req.log);
  res.json({ profile });
});

export default router;

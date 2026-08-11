import { Router } from "express";
import { z } from "zod/v4";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../auth/auth.middleware.js";
import { db, workspacesTable, workspaceIntegrationsTable } from "@workspace/db";
import { AppError } from "../../lib/errors.js";
import { testIntegrationCredential } from "../integrations/integration-validator.js";

const router = Router();
router.use(requireAuth);

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

  if (parsed.data.accessToken || parsed.data.accountId) {
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

  const [existing] = await db
    .select({ id: workspaceIntegrationsTable.id })
    .from(workspaceIntegrationsTable)
    .where(and(
      eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId),
      eq(workspaceIntegrationsTable.provider, dbProvider),
    ))
    .limit(1);

  const values = {
    workspaceId: req.auth.workspaceId,
    provider: dbProvider,
    status,
    accessToken: parsed.data.accessToken,
    accountId: pingAccountId,
    accountName: pingAccountName,
    webhookUrl: parsed.data.webhookUrl,
    metadata: parsed.data.metadata ?? {},
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

  res.status(existing ? 200 : 201).json({ integration, validationDetail });
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

// ── Avatar (HeyGen) endpoints ────────────────────────────────────────────────
// NexOS-operated infra only — always env.HEYGEN_API_KEY, never a customer key.

// A small curated set of NexOS-provided ready-made HeyGen public avatars, so a
// customer can pick a face without recording their own video.
const STOCK_AVATARS = [
  { id: "Daisy-inskirt-20220818", label: "Daisy — Casual", gender: "female" },
  { id: "Kayla-inblackskirt-20220818", label: "Kayla — Executiva", gender: "female" },
  { id: "Wayne_20240711", label: "Wayne — Profissional", gender: "male" },
  { id: "Tyler-incasualsuit-20220721", label: "Tyler — Casual Suit", gender: "male" },
];

router.get("/me/persona/stock-avatars", async (_req, res): Promise<void> => {
  res.json({ avatars: STOCK_AVATARS });
});

// POST /workspaces/me/persona/clone-avatar — receive base64 image (frame from the
// user's recording) → HeyGen Talking Photo → save heygenAvatarId
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
    const buf = Buffer.from(parsed.data.imageBase64, "base64");
    const uploadRes = await fetch("https://upload.heygen.com/v1/asset", {
      method: "POST",
      headers: { "X-Api-Key": heygenKey, "Content-Type": parsed.data.mimeType },
      body: buf,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`HeyGen upload ${uploadRes.status}: ${errText.slice(0, 300)}`);
    }
    const uploadData = (await uploadRes.json()) as { data: { image_key: string } };
    const talkingPhotoId = uploadData.data.image_key;

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
            heygenAvatarId: talkingPhotoId,
            avatarType: "talking_photo",
            avatarUpdatedAt: new Date().toISOString(),
          },
        } as any,
      })
      .where(eq(workspacesTable.id, req.auth.workspaceId));
    req.log.info({ workspaceId: req.auth.workspaceId, talkingPhotoId }, "Avatar clone created (talking_photo)");
    res.json({ heygenAvatarId: talkingPhotoId, avatarType: "talking_photo", success: true });
  } catch (err) {
    req.log.error({ err }, "Avatar clone failed");
    res.status(500).json({ error: String(err), code: "AVATAR_CLONE_ERROR" });
  }
});

// POST /workspaces/me/persona/clone-avatar-video — receive base64 training + consent videos
// → tries HeyGen Digital Twin first (Enterprise plan); on 403 falls back to talking_photo
//   using the frameBase64 (extracted by the client from the training video).
router.post("/me/persona/clone-avatar-video", async (req, res): Promise<void> => {
  const schema = z.object({
    trainingVideoBase64: z.string().min(10),
    consentVideoBase64: z.string().min(10),
    mimeType: z.string().default("video/webm"),
    avatarName: z.string().max(80).default("Meu Avatar NexOS"),
    // Optional frame extracted by the client — used as talking_photo fallback when
    // Digital Twin is not available on the current HeyGen plan.
    frameBase64: z.string().min(10).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "trainingVideoBase64 e consentVideoBase64 obrigatórios", code: "VALIDATION_ERROR" });
    return;
  }
  const { env } = await import("../../lib/env.js");
  const heygenKey = env.HEYGEN_API_KEY;
  if (!heygenKey) {
    res.status(422).json({ error: "HeyGen não configurado — adicione HEYGEN_API_KEY", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }

  const workspaceId = req.auth.workspaceId;

  // ── Helper: save avatar id to workspace persona ────────────────────────────
  async function savePersona(fields: Record<string, unknown>) {
    const [ws] = await db.select({ settings: workspacesTable.settings })
      .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
    const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
    const existingPersona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;
    await db.update(workspacesTable)
      .set({ settings: { ...existingSettings, persona: { ...existingPersona, ...fields, avatarUpdatedAt: new Date().toISOString() } } as any })
      .where(eq(workspacesTable.id, workspaceId));
  }

  // ── Talking photo fallback (works on any HeyGen plan) ────────────────────
  async function talkingPhotoFallback(frameBase64: string): Promise<string> {
    const buf = Buffer.from(frameBase64, "base64");
    const uploadRes = await fetch("https://upload.heygen.com/v1/asset", {
      method: "POST",
      headers: { "X-Api-Key": heygenKey!, "Content-Type": "image/jpeg" },
      body: buf,
    });
    if (!uploadRes.ok) {
      const t = await uploadRes.text();
      throw new Error(`HeyGen talking_photo upload ${uploadRes.status}: ${t.slice(0, 200)}`);
    }
    const uploadData = (await uploadRes.json()) as { data: { image_key: string } };
    return uploadData.data.image_key;
  }

  try {
    const { personaMediaObjectKey, uploadBufferToGCS } = await import("../../lib/gcs-recordings.js");
    const { signAccess } = await import("../auth/auth.service.js");

    // Upload training + consent videos to GCS so HeyGen can fetch via HTTPS.
    const trainingKey = personaMediaObjectKey(workspaceId, "training");
    const consentKey  = personaMediaObjectKey(workspaceId, "consent");
    await Promise.all([
      uploadBufferToGCS(Buffer.from(parsed.data.trainingVideoBase64, "base64"), trainingKey, parsed.data.mimeType),
      uploadBufferToGCS(Buffer.from(parsed.data.consentVideoBase64,  "base64"), consentKey,  parsed.data.mimeType),
    ]);

    const mediaToken  = signAccess({ userId: req.auth.userId, workspaceId, email: req.auth.email });
    const base        = env.APP_URL;
    const trainingUrl = `${base}/api/workspaces/persona-media/${workspaceId}/${trainingKey.split("/").pop()!}?token=${mediaToken}`;
    const consentUrl  = `${base}/api/workspaces/persona-media/${workspaceId}/${consentKey.split("/").pop()!}?token=${mediaToken}`;

    // ── Attempt Digital Twin (Enterprise only) ─────────────────────────────
    const dtRes = await fetch("https://api.heygen.com/v2/video_avatar", {
      method: "POST",
      headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_name: parsed.data.avatarName, training_footage_url: trainingUrl, video_consent_url: consentUrl }),
    });

    if (dtRes.ok) {
      // ── Digital Twin success path ────────────────────────────────────────
      const dtData = (await dtRes.json()) as { data: { avatar_id: string } };
      const digitalTwinId = dtData.data.avatar_id;
      await savePersona({ digitalTwinId, avatarType: "digital_twin", avatarTrainingStatus: "pending" });
      req.log.info({ workspaceId, digitalTwinId }, "Digital twin training started");
      res.json({ digitalTwinId, avatarTrainingStatus: "pending", avatarType: "digital_twin", success: true });
      return;
    }

    // ── Digital Twin failed — check if it's a plan restriction (403) ──────
    const dtStatus = dtRes.status;
    const dtErrText = await dtRes.text();
    req.log.warn({ workspaceId, dtStatus, dtErrText: dtErrText.slice(0, 200) }, "Digital Twin not available — attempting talking_photo fallback");

    if (!parsed.data.frameBase64) {
      // No frame provided — we can't fall back; report to client
      res.status(422).json({
        error: "Avatar Digital Twin requer plano HeyGen Enterprise. Forneça frameBase64 para ativar o fallback automático.",
        code: "HEYGEN_ENTERPRISE_REQUIRED",
      });
      return;
    }

    // ── Fallback: talking photo from extracted frame ───────────────────────
    const talkingPhotoId = await talkingPhotoFallback(parsed.data.frameBase64);
    await savePersona({ heygenAvatarId: talkingPhotoId, avatarType: "talking_photo" });
    req.log.info({ workspaceId, talkingPhotoId }, "Avatar created via talking_photo fallback");
    res.json({ heygenAvatarId: talkingPhotoId, avatarType: "talking_photo", fallback: true, success: true });

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
    const statusRes = await fetch(`https://api.heygen.com/v2/video_avatar/${digitalTwinId}`, {
      headers: { "X-Api-Key": heygenKey },
    });
    if (!statusRes.ok) {
      const errText = await statusRes.text();
      throw new Error(`HeyGen status ${statusRes.status}: ${errText.slice(0, 300)}`);
    }
    const statusData = (await statusRes.json()) as { data: { status: string } };
    const heygenStatus = statusData.data.status; // in_progress | complete | failed

    if (heygenStatus === "failed") {
      await db.update(workspacesTable)
        .set({ settings: { ...existingSettings, persona: { ...existingPersona, avatarTrainingStatus: "failed" } } as any })
        .where(eq(workspacesTable.id, req.auth.workspaceId));
      res.json({ status: "failed" });
      return;
    }
    if (heygenStatus !== "complete") {
      await db.update(workspacesTable)
        .set({ settings: { ...existingSettings, persona: { ...existingPersona, avatarTrainingStatus: heygenStatus } } as any })
        .where(eq(workspacesTable.id, req.auth.workspaceId));
      res.json({ status: heygenStatus });
      return;
    }

    // Complete — resolve the real playable avatar_id via v3 looks lookup.
    const looksRes = await fetch("https://api.heygen.com/v3/avatars/looks?avatar_type=digital_twin&ownership=private", {
      headers: { "X-Api-Key": heygenKey },
    });
    if (!looksRes.ok) {
      const errText = await looksRes.text();
      throw new Error(`HeyGen looks ${looksRes.status}: ${errText.slice(0, 300)}`);
    }
    const looksData = (await looksRes.json()) as { data: { avatar_id: string; look_id?: string }[] };
    const match = looksData.data.find((a) => a.avatar_id === digitalTwinId) ?? looksData.data[0];
    if (!match) {
      throw new Error("Digital twin marcado como completo mas nenhum look encontrado na HeyGen");
    }
    const heygenAvatarId = match.avatar_id;

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
    req.log.info({ workspaceId: req.auth.workspaceId, heygenAvatarId }, "Digital twin training complete");
    res.json({ status: "complete", heygenAvatarId });
  } catch (err) {
    req.log.error({ err }, "Digital twin status check failed");
    res.status(500).json({ error: String(err), code: "AVATAR_STATUS_ERROR" });
  }
});

// GET /workspaces/me/persona/avatar-recovery-status
// Returns full avatar state from DB + whether GCS training videos still exist.
// Used by the frontend to decide whether to show a recovery/retry UI.
router.get("/me/persona/avatar-recovery-status", async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;
  const [ws] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const existingSettings = (ws?.settings ?? {}) as Record<string, unknown>;
  const persona = (existingSettings["persona"] ?? {}) as Record<string, unknown>;

  let hasGCSVideos = false;
  try {
    const { personaMediaObjectKey, getGCSObjectMeta } = await import("../../lib/gcs-recordings.js");
    await getGCSObjectMeta(personaMediaObjectKey(workspaceId, "training"));
    hasGCSVideos = true;
  } catch { /* file not found — normal */ }

  res.json({
    heygenAvatarId:       persona["heygenAvatarId"]       ?? null,
    digitalTwinId:        persona["digitalTwinId"]         ?? null,
    avatarTrainingStatus: persona["avatarTrainingStatus"]  ?? null,
    avatarType:           persona["avatarType"]            ?? null,
    hasGCSVideos,
  });
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
  if (!parsed.success || !STOCK_AVATARS.some((a) => a.id === parsed.data.avatarId)) {
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

import { Router } from "express";
import { z } from "zod/v4";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../auth/auth.middleware.js";
import { db, workspacesTable, workspaceIntegrationsTable } from "@workspace/db";
import { AppError } from "../../lib/errors.js";

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
      "meta_ads", "instagram", "tiktok_ads", "google_ads",
      "whatsapp_business", "telegram", "stripe", "hotmart",
      "eduzz", "kiwify", "mailchimp", "activecampaign", "rd_station", "hubspot",
      "crypto_native", "custom_webhook",
    ]),
    accountId: z.string().optional(),
    accountName: z.string().optional(),
    webhookUrl: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const PAYMENT_GATEWAYS = ["stripe", "hotmart", "eduzz", "kiwify", "crypto_native"];
  const isPaymentGateway = PAYMENT_GATEWAYS.includes(parsed.data.provider);

  const [integration] = await db
    .insert(workspaceIntegrationsTable)
    .values({
      workspaceId: req.auth.workspaceId,
      provider: parsed.data.provider,
      status: "disconnected",
      accountId: parsed.data.accountId,
      accountName: parsed.data.accountName,
      webhookUrl: parsed.data.webhookUrl,
      metadata: parsed.data.metadata ?? {},
      isPaymentGateway,
      blocksExecution: false,
    })
    .returning();

  res.status(201).json({ integration });
});

// ── HeyGen API Key connect / avatars ──────────────────────────────────────────

// POST /workspaces/me/heygen/connect — store & validate HeyGen API key
router.post("/me/heygen/connect", async (req, res): Promise<void> => {
  const schema = z.object({ apiKey: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "API key inválida", code: "VALIDATION_ERROR" });
    return;
  }
  const { apiKey } = parsed.data;

  // Validate key against HeyGen API
  try {
    const heyResp = await fetch("https://api.heygen.com/v2/avatars?limit=1", {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });
    if (!heyResp.ok) {
      res.status(422).json({
        error: "Chave de API HeyGen inválida. Verifique em HeyGen → Settings → API.",
        code: "INVALID_API_KEY",
      });
      return;
    }
  } catch {
    res.status(502).json({ error: "Não foi possível conectar com a API HeyGen", code: "HEYGEN_UNREACHABLE" });
    return;
  }

  // Upsert: remove any existing heygen integration, then insert fresh
  await db
    .delete(workspaceIntegrationsTable)
    .where(and(
      eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId),
      eq(workspaceIntegrationsTable.provider, "heygen"),
    ));

  const [integration] = await db
    .insert(workspaceIntegrationsTable)
    .values({
      workspaceId: req.auth.workspaceId,
      provider: "heygen",
      status: "connected",
      accessToken: apiKey,
      isPaymentGateway: false,
      blocksExecution: false,
    })
    .returning({
      id: workspaceIntegrationsTable.id,
      provider: workspaceIntegrationsTable.provider,
      status: workspaceIntegrationsTable.status,
    });

  req.log.info({ workspaceId: req.auth.workspaceId }, "HeyGen API key connected");
  res.json({ integration });
});

// GET /workspaces/me/heygen/avatars — list avatars from HeyGen using stored key
router.get("/me/heygen/avatars", async (req, res): Promise<void> => {
  const [row] = await db
    .select({ accessToken: workspaceIntegrationsTable.accessToken })
    .from(workspaceIntegrationsTable)
    .where(and(
      eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId),
      eq(workspaceIntegrationsTable.provider, "heygen"),
      eq(workspaceIntegrationsTable.status, "connected"),
    ))
    .limit(1);

  if (!row?.accessToken) {
    res.status(422).json({ error: "HeyGen não conectado", code: "HEYGEN_NOT_CONNECTED" });
    return;
  }

  try {
    const heyResp = await fetch("https://api.heygen.com/v2/avatars", {
      headers: { "X-Api-Key": row.accessToken, Accept: "application/json" },
    });
    if (!heyResp.ok) {
      res.status(502).json({ error: "Erro ao buscar avatares do HeyGen", code: "HEYGEN_API_ERROR" });
      return;
    }
    const payload = await heyResp.json() as { data?: { avatars?: unknown[] } };
    res.json({ avatars: payload.data?.avatars ?? [] });
  } catch {
    res.status(502).json({ error: "Não foi possível conectar com a API HeyGen", code: "HEYGEN_UNREACHABLE" });
  }
});

// DELETE /workspaces/me/heygen/connect — disconnect HeyGen
router.delete("/me/heygen/connect", async (req, res): Promise<void> => {
  await db
    .delete(workspaceIntegrationsTable)
    .where(and(
      eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId),
      eq(workspaceIntegrationsTable.provider, "heygen"),
    ));
  req.log.info({ workspaceId: req.auth.workspaceId }, "HeyGen integration removed");
  res.json({ success: true });
});

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
  if (parsed.data.voiceName      !== undefined) patch["voiceName"]      = parsed.data.voiceName;
  if (parsed.data.heygenAvatarId !== undefined) patch["heygenAvatarId"] = parsed.data.heygenAvatarId;
  if (parsed.data.speakingStyle  !== undefined) patch["speakingStyle"]  = parsed.data.speakingStyle;
  if (parsed.data.trejeitos      !== undefined) patch["trejeitos"]      = parsed.data.trejeitos;
  if (parsed.data.brandPresence  !== undefined) patch["brandPresence"]  = parsed.data.brandPresence;
  if (parsed.data.reelStyle      !== undefined) patch["reelStyle"]      = parsed.data.reelStyle;
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

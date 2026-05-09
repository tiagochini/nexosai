import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getWhitelabelConfig,
  upsertWhitelabelConfig,
  initiateDomainVerification,
  verifyDomain,
  removeDomain,
  resolveBrandByDomain,
} from "./whitelabel.service.js";

const router = Router();

// ─── Public brand resolution (no auth — used by frontend on page load) ────────

router.get("/resolve", async (req, res): Promise<void> => {
  const host =
    (req.query["host"] as string | undefined) ??
    req.headers["x-forwarded-host"] as string ??
    req.headers.host ??
    "";

  const result = await resolveBrandByDomain(host.split(":")[0]!);
  res.json(result);
});

// ─── Get config ───────────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const config = await getWhitelabelConfig(req.auth.workspaceId);
  res.json({ config });
});

// ─── Upsert config ────────────────────────────────────────────────────────────

const upsertSchema = z.object({
  brandName: z.string().min(1).max(100).optional(),
  tagline: z.string().max(200).optional(),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  loginBgUrl: z.string().url().optional(),
  theme: z
    .object({
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      borderRadius: z.string().optional(),
      fontFamily: z.string().optional(),
    })
    .optional(),
  customCss: z.string().max(50000).optional(),
  customDomain: z.string().optional(),
  supportEmail: z.email().optional(),
  supportUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  privacyUrl: z.string().url().optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
});

router.put("/", requireAuth, async (req, res): Promise<void> => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const config = await upsertWhitelabelConfig(req.auth.workspaceId, parsed.data);
  res.json({ config });
});

// ─── Domain management ────────────────────────────────────────────────────────

const domainSchema = z.object({
  domain: z.string().min(3),
});

router.post("/domain/initiate", requireAuth, async (req, res): Promise<void> => {
  const parsed = domainSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const result = await initiateDomainVerification(
    req.auth.workspaceId,
    parsed.data.domain
  );
  res.json(result);
});

router.post("/domain/verify", requireAuth, async (req, res): Promise<void> => {
  const result = await verifyDomain(req.auth.workspaceId);
  res.json(result);
});

router.delete("/domain", requireAuth, async (req, res): Promise<void> => {
  await removeDomain(req.auth.workspaceId);
  res.json({ success: true });
});

export default router;

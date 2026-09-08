import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { checkAvailability, connectExistingDomain, listDomains, reconcileSupplierPayment, reconcileSupplierWebhook, registerDomain, renewDomain, upsertDnsRecord } from "./domains.service.js";
import { domainProviderCatalog, providerById } from "./provider-registry.js";
const router = Router();
const key = z.string().min(8).max(200);
// The only accepted webhook payload is a provider/domain reference. Its reported
// payment state is deliberately ignored; we poll the provider before changing state.
router.post("/supplier-webhooks/:providerId", async (req, res): Promise<void> => {
  const p = z.object({ domainId: z.string().uuid() }).safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR" }); return; }
  res.json(await reconcileSupplierWebhook(req.params["providerId"] as string, p.data.domainId, req.header("x-supplier-webhook-secret") ?? undefined));
});
router.use(requireAuth);
router.get("/", async (req, res): Promise<void> => { res.json({ domains: await listDomains(req.auth.workspaceId) }); });
router.get("/providers", (_req, res): void => { res.json({ providers: domainProviderCatalog() }); });
router.get("/providers/:providerId/status", (req, res): void => { const provider = providerById(req.params["providerId"] as string); if (!provider) { res.status(404).json({ error: "Provedor não encontrado", code: "NOT_FOUND" }); return; } res.json({ provider }); });
router.get("/deployment-targets", (_req, res): void => { res.json({ targets: domainProviderCatalog().filter(p => p.capabilities.includes("hosting")).map(p => ({ ...p, deploymentMode: p.mode })) }); });
router.post("/connect-existing", async (req, res): Promise<void> => { const p = z.object({ domain: z.string(), provider: z.string(), consent: z.literal(true) }).safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR" }); return; } res.status(201).json(await connectExistingDomain(req.auth.workspaceId, p.data.domain, p.data.provider)); });
router.post("/availability", async (req, res): Promise<void> => { const p = z.object({ domain: z.string(), provider: z.string().default("generic"), idempotencyKey: key }).safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR" }); return; } res.json(await checkAvailability(req.auth.workspaceId, p.data.domain, p.data.provider, p.data.idempotencyKey)); });
router.post("/register", async (req, res): Promise<void> => { const p = z.object({ domain: z.string(), provider: z.string().default("generic"), years: z.number().int().min(1).max(10).default(1), consent: z.literal(true), idempotencyKey: key }).safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR", }); return; } res.status(202).json(await registerDomain(req.auth.workspaceId, p.data.domain, p.data.provider, p.data.years, p.data.idempotencyKey)); });
router.post("/:domainId/reconcile-supplier-payment", async (req, res): Promise<void> => { res.json(await reconcileSupplierPayment(req.auth.workspaceId, req.params["domainId"] as string)); });
router.post("/:domainId/renew", async (req, res): Promise<void> => { const p = z.object({ years: z.number().int().min(1).max(10).default(1), consent: z.literal(true), idempotencyKey: key }).safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR" }); return; } res.status(202).json(await renewDomain(req.auth.workspaceId, req.params["domainId"] as string, p.data.years, p.data.idempotencyKey)); });
router.put("/:domainId/dns", async (req, res): Promise<void> => { const p = z.object({ type: z.enum(["A", "AAAA", "CNAME", "TXT", "MX"]), name: z.string().min(1), value: z.string().min(1), ttl: z.number().int().min(60).max(86400).default(300), idempotencyKey: key }).safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR" }); return; } res.status(202).json(await upsertDnsRecord(req.auth.workspaceId, req.params["domainId"] as string, p.data, p.data.idempotencyKey)); });
export default router;
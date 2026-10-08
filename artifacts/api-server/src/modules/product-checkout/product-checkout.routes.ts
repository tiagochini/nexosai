import { Router } from "express";
import { matchesAsaasWebhookToken } from "../../lib/asaas-webhook-auth.js";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  initiateProductCheckout,
  getProductCardInstallments,
  getSale,
  reconcileProductSaleFromAsaasWebhook,
} from "./product-checkout.service.js";

const router = Router();

/** Constant-time webhook authentication seam used by route and unit tests. */
export function isValidAsaasWebhookToken(
  provided: string | undefined,
  configured: string | undefined = process.env["ASAAS_PRODUCT_WEBHOOK_TOKEN"] ?? process.env["ASAAS_WEBHOOK_TOKEN"],
): boolean {
  return matchesAsaasWebhookToken(provided, configured);
}

const cardSchema = z.object({
  holderName: z.string().min(1),
  number: z.string().min(13),
  expiryMonth: z.string().length(2),
  expiryYear: z.string().min(4),
  cvv: z.string().min(3).max(4),
  cpfCnpj: z.string().optional(),
  phone: z.string().optional(),
  postalCode: z.string().optional(),
});

// ─── Workspace owner: manage their products ───────────────────────────────────

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().min(100),
  sequenceId: z.string().uuid().optional(),
  successUrl: z.string().url().optional(),
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const product = await createProduct({ workspaceId: req.auth.workspaceId, ...parsed.data });
  res.status(201).json({ product });
});

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const products = await listProducts(req.auth.workspaceId);
  res.json({ products });
});

router.patch("/:productId", requireAuth, async (req, res): Promise<void> => {
  const productId = req.params["productId"] as string;
  const product = await updateProduct(req.auth.workspaceId, productId, req.body as any);
  res.json({ product });
});

router.delete("/:productId", requireAuth, async (req, res): Promise<void> => {
  await deleteProduct(req.auth.workspaceId, req.params["productId"] as string);
  res.json({ ok: true });
});

// ─── Public: buyer-facing checkout ───────────────────────────────────────────

router.get("/:productId/public", async (req, res): Promise<void> => {
  const product = await getProduct(req.params["productId"] as string);
  if (!product || !product.active) {
    res.status(404).json({ error: "Produto não encontrado", code: "NOT_FOUND" });
    return;
  }
  res.json({
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      successUrl: product.successUrl,
    },
  });
});

router.get("/:productId/installments", async (req, res): Promise<void> => {
  const options = await getProductCardInstallments(req.params["productId"] as string);
  res.json({ options });
});

const checkoutSchema = z.object({
  buyerName: z.string().min(1).max(200),
  buyerEmail: z.string().email(),
  buyerCpf: z.string().optional(),
  method: z.enum(["pix", "boleto", "credit_card"]),
  card: cardSchema.optional(),
  installmentCount: z.number().int().min(1).max(21).optional(),
  purchaserReferralCode: z.string().min(4).max(64).optional(),
});

router.post("/:productId/checkout", async (req, res): Promise<void> => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const productId = req.params["productId"] as string;
  const sale = await initiateProductCheckout({ productId, ...parsed.data });
  res.status(201).json({ sale });
});

router.get("/sales/:saleId", async (req, res): Promise<void> => {
  const sale = await getSale(req.params["saleId"] as string);
  if (!sale) {
    res.status(404).json({ error: "Venda não encontrada", code: "NOT_FOUND" });
    return;
  }
  res.json({ sale });
});

// ─── Asaas webhook for product sales ─────────────────────────────────────────

router.post("/webhooks/asaas", async (req, res): Promise<void> => {
  const payload = req.body as { event?: string; payment?: { id?: string } };
  const asaasId = payload.payment?.id;
  const header = req.headers["asaas-access-token"];
  const token = typeof header === "string" ? header : undefined;
  if (!isValidAsaasWebhookToken(token)) {
    res.status(401).json({ error: "Webhook não autorizado", code: "UNAUTHORIZED_WEBHOOK" });
    return;
  }
  // Event names are only delivery hints. The provider's current payment record
  // is authoritative for all state transitions.
  if (asaasId) await reconcileProductSaleFromAsaasWebhook(asaasId);
  res.json({ received: true });
});

export default router;

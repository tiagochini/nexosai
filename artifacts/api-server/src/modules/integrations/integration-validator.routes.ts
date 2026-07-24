/**
 * C1 — POST /api/integrations/test
 *
 * Validates a credential against the real provider API WITHOUT saving to DB.
 * Frontend calls this first to give the user instant feedback ("✓ válida" / "✗ inválida")
 * before the save request is issued.
 */

import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { testIntegrationCredential } from "./integration-validator.js";

const router = Router();
router.use(requireAuth);

const testSchema = z.object({
  provider: z.string().min(1),
  accessToken: z.string().optional(),
  accountId: z.string().optional(),
  webhookUrl: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/integrations/test
 *
 * Body: { provider, accessToken?, accountId?, webhookUrl?, metadata? }
 *
 * Returns:
 *   200 { valid: true,  detail, accountName?, accountId?, validationSkipped? }
 *   200 { valid: false, error }
 *
 * Never 4xx for invalid credentials — always 200 with valid=false so the
 * frontend can display the error message without triggering error interceptors.
 * Only 400 for malformed request body.
 */
router.post("/test", async (req, res): Promise<void> => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Corpo da requisição inválido", code: "VALIDATION_ERROR", details: parsed.error.message });
    return;
  }

  const { provider, accessToken, accountId, webhookUrl, metadata } = parsed.data;

  const result = await testIntegrationCredential(provider, {
    accessToken,
    accountId,
    webhookUrl,
    metadata: metadata as Record<string, unknown> | undefined,
  });

  res.json(result);
});

export default router;

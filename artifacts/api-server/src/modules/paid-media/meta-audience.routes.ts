import { Router } from "express";
import { z } from "zod/v4";
import rateLimit from "express-rate-limit";
import { AppError } from "../../lib/errors.js";
import {
  prepareAudienceOperation,
  listAudienceOperations,
  approveAudienceOperation,
  executeAudienceOperation,
  rollbackAudienceOperation,
  recoverAudienceOperation,
  cancelAudienceOperation,
  verifyAudienceRollback,
} from "./meta-audience.service.js";
import { metaAccountAssetRequest } from "./providers.js";
const router = Router();
router.use(
  rateLimit({
    windowMs: 60_000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${req.auth.workspaceId}:${req.auth.userId}`,
  }),
);
const confirmation = z
  .object({
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
    confirm: z.literal(true),
  })
  .strict();
router.get("/operations", async (req, res) => {
  res.json({ operations: await listAudienceOperations(req.auth.workspaceId) });
});
router.post("/operations", async (req, res) => {
  res
    .status(201)
    .json(
      await prepareAudienceOperation(
        req.auth.workspaceId,
        req.auth.userId,
        req.body,
      ),
    );
});
for (const action of [
  "approve",
  "execute",
  "rollback",
  "cancel",
  "verify-rollback",
] as const) {
  router.post(`/operations/:id/${action}`, async (req, res) => {
    const input = confirmation.safeParse(req.body);
    if (
      !input.success ||
      !z.string().uuid().safeParse(req.params["id"]).success
    )
      throw new AppError(
        422,
        "Confirme a operação e seu resumo aprovado.",
        "VALIDATION_ERROR",
      );
    const fn =
      action === "approve"
        ? approveAudienceOperation
        : action === "execute"
          ? executeAudienceOperation
          : action === "cancel"
            ? cancelAudienceOperation
            : action === "verify-rollback"
              ? verifyAudienceRollback
              : rollbackAudienceOperation;
    res.json(
      await fn(
        req.auth.workspaceId,
        req.params["id"] as string,
        input.data.requestHash,
        req.auth.userId,
      ),
    );
  });
}
router.post("/operations/:id/recover", async (req, res) => {
  const input = confirmation
    .extend({ providerAudienceId: z.string().regex(/^\d+$/) })
    .safeParse(req.body);
  if (!input.success || !z.string().uuid().safeParse(req.params["id"]).success)
    throw new AppError(
      422,
      "Informe o ID visto na Meta e confirme a recuperação.",
      "VALIDATION_ERROR",
    );
  res.json(
    await recoverAudienceOperation(
      req.auth.workspaceId,
      req.params["id"] as string,
      input.data.requestHash,
      input.data.providerAudienceId,
      req.auth.userId,
    ),
  );
});
router.get("/accounts/:accountId", async (req, res) => {
  if (!z.string().uuid().safeParse(req.params["accountId"]).success)
    throw new AppError(422, "Conta inválida.", "VALIDATION_ERROR");
  const after = z.string().max(1000).optional().parse(req.query["after"]);
  const result = await metaAccountAssetRequest(
    req.auth.workspaceId,
    req.params["accountId"] as string,
    "account/customaudiences",
    {
      query: {
        fields: "id,name,subtype,delivery_status,operation_status",
        limit: "100",
        ...(after ? { after } : {}),
      },
    },
  );
  res.json({
    audiences: result.data ?? [],
    after: (result.paging as any)?.next
      ? ((result.paging as any)?.cursors?.after ?? null)
      : null,
  });
});
export default router;

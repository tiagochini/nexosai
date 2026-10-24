import { Router } from "express";
import { z } from "zod/v4";
import rateLimit from "express-rate-limit";
import { AppError } from "../../lib/errors.js";
import {
  prepareCapiTest,
  listCapiTests,
  executeCapiTest,
} from "./meta-capi-tests.service.js";
import {
  recordCrmConsent,
  prepareCrmSync,
  listCrmSyncs,
  setCrmSyncEnabled,
} from "./meta-crm-sync.service.js";
import {
  prepareExperiment,
  listExperiments,
  approveExperiment,
  executeExperiment,
  cancelExperiment,
  recoverExperiment,
  inspectExperiment,
  verifyExperimentDeletion,
} from "./meta-experiments.service.js";
const router = Router();
router.use(
  rateLimit({
    windowMs: 60000,
    limit: 60,
    keyGenerator: (req) => `${req.auth.workspaceId}:${req.auth.userId}`,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
const confirmation = z
  .object({
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    confirm: z.literal(true),
  })
  .strict();
const key = (id: unknown) => {
  if (!z.string().uuid().safeParse(id).success)
    throw new AppError(422, "Identificador inválido.", "VALIDATION_ERROR");
  return String(id);
};
router.get("/capi-tests", async (req, res) => {
  res.json({ tests: await listCapiTests(req.auth.workspaceId) });
});
router.post("/capi-tests", async (req, res) => {
  res
    .status(201)
    .json(
      await prepareCapiTest(req.auth.workspaceId, req.auth.userId, req.body),
    );
});
router.post("/capi-tests/:id/execute", async (req, res) => {
  const parsed = confirmation.safeParse(req.body);
  if (!parsed.success)
    throw new AppError(
      422,
      "Confirme o resumo do evento de teste.",
      "VALIDATION_ERROR",
    );
  res.json(
    await executeCapiTest(
      req.auth.workspaceId,
      key(req.params["id"]),
      parsed.data.hash,
      req.auth.userId,
    ),
  );
});
router.post("/crm-consents", async (req, res) => {
  res.json(
    await recordCrmConsent(req.auth.workspaceId, req.auth.userId, req.body),
  );
});
router.get("/crm-syncs", async (req, res) => {
  res.json({ syncs: await listCrmSyncs(req.auth.workspaceId) });
});
router.post("/crm-syncs", async (req, res) => {
  res
    .status(201)
    .json(
      await prepareCrmSync(req.auth.workspaceId, req.auth.userId, req.body),
    );
});
router.post("/crm-syncs/:id/authorization", async (req, res) => {
  const parsed = confirmation
    .extend({ enabled: z.boolean() })
    .safeParse(req.body);
  if (!parsed.success)
    throw new AppError(
      422,
      "Confirme a autorização recorrente e seu prazo.",
      "VALIDATION_ERROR",
    );
  res.json(
    await setCrmSyncEnabled(
      req.auth.workspaceId,
      key(req.params["id"]),
      parsed.data.hash,
      parsed.data.enabled,
      req.auth.userId,
    ),
  );
});
router.get("/experiments", async (req, res) => {
  res.json({ experiments: await listExperiments(req.auth.workspaceId) });
});
router.post("/experiments", async (req, res) => {
  res
    .status(201)
    .json(
      await prepareExperiment(req.auth.workspaceId, req.auth.userId, req.body),
    );
});
for (const action of [
  "approve",
  "execute",
  "cancel",
  "verify-deletion",
] as const)
  router.post(`/experiments/:id/${action}`, async (req, res) => {
    const parsed = confirmation.safeParse(req.body);
    if (!parsed.success)
      throw new AppError(
        422,
        "Confirme o desenho aprovado do estudo.",
        "VALIDATION_ERROR",
      );
    const run =
      action === "approve"
        ? approveExperiment
        : action === "execute"
          ? executeExperiment
          : action === "cancel"
            ? cancelExperiment
            : verifyExperimentDeletion;
    res.json(
      await run(
        req.auth.workspaceId,
        key(req.params["id"]),
        parsed.data.hash,
        req.auth.userId,
      ),
    );
  });
router.post("/experiments/:id/recover", async (req, res) => {
  const parsed = confirmation
    .extend({ studyId: z.string().regex(/^\d+$/) })
    .safeParse(req.body);
  if (!parsed.success)
    throw new AppError(
      422,
      "Confirme o ID observado e o desenho.",
      "VALIDATION_ERROR",
    );
  res.json(
    await recoverExperiment(
      req.auth.workspaceId,
      key(req.params["id"]),
      parsed.data.hash,
      parsed.data.studyId,
      req.auth.userId,
    ),
  );
});
router.get("/experiments/:id/inspection", async (req, res) => {
  res.json(
    await inspectExperiment(req.auth.workspaceId, key(req.params["id"])),
  );
});
export default router;

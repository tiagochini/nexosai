import { requirePlatformAdmin } from "../admin/admin.middleware.js";
import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { generateNexosContent, NEXOS_FRAMEWORK, type GenerateNexosContentInput } from "./nexos-self-launch.service.js";

const router = Router();
router.use(requireAuth, requirePlatformAdmin);

// GET /api/nexos-launch/framework — retorna o framework estratégico completo
router.get("/framework", (req, res): void => {
  res.json({ framework: NEXOS_FRAMEWORK });
});

// POST /api/nexos-launch/generate — gera conteúdo com os agentes pré-calibrados
router.post("/generate", async (req, res): Promise<void> => {
  const input = req.body as GenerateNexosContentInput;
  if (!input.type) { res.status(400).json({ error: "type é obrigatório" }); return; }
  const result = await generateNexosContent(input, req.auth.workspaceId);
  res.json({ content: result });
});

export default router;

import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { generateNexosContent, NEXOS_FRAMEWORK, type GenerateNexosContentInput } from "./nexos-self-launch.service.js";

const ADMIN_EMAILS = new Set(["admin@agencianexos.vip", "founder@agencianexos.vip", "admin@nexos.ai", "founder@nexos.ai"]);

function requireAdmin(email: string) {
  if (!ADMIN_EMAILS.has(email)) throw new UnauthorizedError("Admin access required");
}

const router = Router();

// GET /api/nexos-launch/framework — retorna o framework estratégico completo
router.get("/framework", requireAuth, (req, res): void => {
  requireAdmin(req.auth.email);
  res.json({ framework: NEXOS_FRAMEWORK });
});

// POST /api/nexos-launch/generate — gera conteúdo com os agentes pré-calibrados
router.post("/generate", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const input = req.body as GenerateNexosContentInput;
  if (!input.type) { res.status(400).json({ error: "type é obrigatório" }); return; }
  const result = await generateNexosContent(input, req.auth.workspaceId);
  res.json({ content: result });
});

export default router;

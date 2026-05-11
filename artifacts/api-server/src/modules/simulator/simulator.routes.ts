import { Router } from "express";
import { z } from "zod/v4";
import { getSimulatorConfig, saveSimulatorLead } from "./simulator.service.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// GET /api/simulator/config — public, no auth
// Returns cart status + group links for the simulator frontend
router.get("/config", async (_req, res): Promise<void> => {
  try {
    const config = await getSimulatorConfig();
    res.json(config);
  } catch (err) {
    logger.error({ err }, "simulator/config error");
    res.status(500).json({ error: "Erro ao buscar configuração" });
  }
});

const leadSchema = z.object({
  firstName: z.string().min(1).max(100),
  productName: z.string().min(1).max(200),
  productType: z.string().max(50).default("curso"),
  email: z.email(),
  whatsapp: z.string().min(8).max(30),
});

// POST /api/simulator/lead — public, no auth
// Saves simulator lead to waitlist table with source=simulator:<type>
router.post("/lead", async (req, res): Promise<void> => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  try {
    const result = await saveSimulatorLead(parsed.data);
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    logger.error({ err }, "simulator/lead save error");
    // Never fail the simulator UX over a save error
    res.status(200).json({ saved: false, duplicate: false });
  }
});

export default router;

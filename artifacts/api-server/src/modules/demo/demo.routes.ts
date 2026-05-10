import { Router } from "express";
import { z } from "zod/v4";
import {
  simulateBudget,
  type ProductCategory,
  type CampaignModelType,
} from "../intake/intake.simulation.js";

const router = Router();

const simulateSchema = z.object({
  budget: z.number().positive().max(500000),
  productPrice: z.number().positive().max(500000),
  campaignType: z.string().optional(),
  productCategory: z.string().optional(),
});

// Public — no auth required. Used by the landing page simulator.
router.post("/simulate", async (req, res): Promise<void> => {
  const parsed = simulateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const campaignType = (parsed.data.campaignType ?? "launch") as CampaignModelType;
  const productCategory = (parsed.data.productCategory ?? "infoproduct") as ProductCategory;

  const simulation = simulateBudget(
    parsed.data.budget,
    parsed.data.productPrice,
    campaignType,
    productCategory,
  );

  res.json({ simulation });
});

export default router;

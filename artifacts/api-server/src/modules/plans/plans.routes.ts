import { Router } from "express";
import { db, plansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res): Promise<void> => {
  const plans = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.active, true));
  res.json({ plans });
});

router.get("/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params["slug"])
    ? req.params["slug"][0]
    : req.params["slug"];

  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.slug, slug as any))
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "Plan not found", code: "NOT_FOUND" });
    return;
  }

  res.json({ plan });
});

export default router;

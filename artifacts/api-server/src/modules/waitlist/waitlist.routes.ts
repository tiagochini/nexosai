import { Router } from "express";
import { z } from "zod/v4";
import { eq, sql } from "drizzle-orm";
import { db, waitlistTable } from "@workspace/db";
import { env } from "../../lib/env";

const router = Router();

const waitlistSchema = z.object({
  name: z.string().min(2).max(200),
  whatsapp: z.string().min(8).max(30),
  email: z.email().optional(),
  segment: z.enum(["individual", "agency"]).default("individual"),
  source: z.string().max(100).optional(),
});

// POST /api/waitlist — public, no auth
router.post("/", async (req, res): Promise<void> => {
  const parsed = waitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const { name, whatsapp, email, segment, source } = parsed.data;

  const [existing] = await db
    .select({ id: waitlistTable.id, segment: waitlistTable.segment })
    .from(waitlistTable)
    .where(eq(waitlistTable.whatsapp, whatsapp))
    .limit(1);

  if (existing) {
    res.json({
      joined: true,
      duplicate: true,
      segment: existing.segment,
      message: "Você já está na lista. Aguarde nosso contato no WhatsApp.",
    });
    return;
  }

  await db.insert(waitlistTable).values({
    name,
    whatsapp,
    email: email ?? null,
    segment,
    source: source ?? null,
  });

  res.status(201).json({
    joined: true,
    duplicate: false,
    segment,
    message: "Você entrou na lista de espera!",
  });
});

// GET /api/waitlist/count — public
router.get("/count", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      segment: waitlistTable.segment,
      count: sql<number>`count(*)::int`,
    })
    .from(waitlistTable)
    .groupBy(waitlistTable.segment);

  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const bySegment = Object.fromEntries(rows.map(r => [r.segment, r.count]));

  res.json({ total, bySegment });
});

// GET /api/waitlist/launch-config — public
// Returns the launch date if the owner has set LAUNCH_CAMPAIGN_DATE env var.
// When null, the landing shows "Novo ciclo de adesões será aberto em breve".
// Set this env var to an ISO date string (e.g. "2025-06-14T20:00:00-03:00")
// to start the countdown clock on the landing page.
router.get("/launch-config", async (_req, res): Promise<void> => {
  const dateStr = env.LAUNCH_CAMPAIGN_DATE;

  if (!dateStr) {
    res.json({ launchDate: null, active: false });
    return;
  }

  const launchDate = new Date(dateStr);
  if (isNaN(launchDate.getTime())) {
    res.json({ launchDate: null, active: false });
    return;
  }

  res.json({
    launchDate: launchDate.toISOString(),
    active: true,
  });
});

export default router;

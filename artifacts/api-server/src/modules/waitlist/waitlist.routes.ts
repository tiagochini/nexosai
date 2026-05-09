import { Router } from "express";
import { z } from "zod/v4";
import { eq, and, sql } from "drizzle-orm";
import { db, waitlistTable } from "@workspace/db";

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

// GET /api/waitlist/count — public, returns counts by segment
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

export default router;

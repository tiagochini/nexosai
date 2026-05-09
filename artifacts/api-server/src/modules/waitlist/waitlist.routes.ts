import { Router } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, waitlistTable } from "@workspace/db";

const router = Router();

const waitlistSchema = z.object({
  name: z.string().min(2).max(200),
  whatsapp: z.string().min(8).max(30),
  email: z.email().optional(),
  source: z.string().max(100).optional(),
});

// POST /api/waitlist — public, no auth
router.post("/", async (req, res): Promise<void> => {
  const parsed = waitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const { name, whatsapp, email, source } = parsed.data;

  // Deduplicate by WhatsApp number
  const [existing] = await db
    .select({ id: waitlistTable.id })
    .from(waitlistTable)
    .where(eq(waitlistTable.whatsapp, whatsapp))
    .limit(1);

  if (existing) {
    res.json({ joined: true, duplicate: true, message: "Você já está na lista. Aguarde nosso contato no WhatsApp." });
    return;
  }

  await db.insert(waitlistTable).values({ name, whatsapp, email: email ?? null, source: source ?? null });

  res.status(201).json({ joined: true, duplicate: false, message: "Você entrou na lista de espera! Em breve você receberá o link do grupo no WhatsApp." });
});

// GET /api/waitlist/count — public
router.get("/count", async (_req, res): Promise<void> => {
  const rows = await db.select({ id: waitlistTable.id }).from(waitlistTable);
  res.json({ count: rows.length });
});

export default router;

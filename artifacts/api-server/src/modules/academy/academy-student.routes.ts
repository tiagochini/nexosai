import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { and, eq, sql } from "drizzle-orm";
import { db, usersTable as users, academyStudentAccountsTable as accounts, academyPurchasesTable as purchases, authRefreshSessionsTable } from "@workspace/db";
import { requireTrustedSessionOrigin } from "../auth/auth-session-cookie.js";
import { createAcademyVerificationLimiter } from "./academy-verification.security.js";
import { createStudentSession, requireStudent, studentProducts, readStudentCookie, STUDENT_COOKIE,
  studentCookieOptions, newStudentSecret, hashStudentSecret, secretMatches } from "./academy-student-session.js";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { deliverFunnelMessage } from "./academy-funnel-delivery.js";
import { emailHref } from "./academy-email-html.js";

const router = Router();
const trustedProxies = (process.env["ACADEMY_TRUSTED_PROXY_IPS"] ?? "").split(",").map(value => value.trim()).filter(Boolean);
const limiter = createAcademyVerificationLimiter(trustedProxies, { scope: "student-auth" });
const activationLimiter = createAcademyVerificationLimiter(trustedProxies, { scope: "activation" });
const recoveryLimiter = createAcademyVerificationLimiter(trustedProxies, { scope: "recovery" });
const email = z.email().max(255).transform(value => value.toLowerCase());
const password = z.string().min(8, "Use pelo menos 8 caracteres.").max(72).refine(value => Buffer.byteLength(value, "utf8") <= 72, "Senha muito longa.");
const credentials = z.object({ email, password: z.string().min(1).max(256) });
const registration = z.object({ email, password, name: z.string().trim().min(2).max(200) });
const keySchema = z.object({ key: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{8,64}$/) });
const publicUser = (user: { id: string; name: string; email: string }) => ({ id: user.id, name: user.name, email: user.email });
const dummyHash = bcrypt.hashSync("academy-invalid-credentials", 12);

router.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
router.post("/register", requireTrustedSessionOrigin, limiter, async (req, res) => {
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Informe nome, e-mail válido e senha de 8 a 72 caracteres." }); return; }
  const hash = await bcrypt.hash(parsed.data.password, 12);
  // Academy registration deliberately creates no paid NexOS workspace or plan.
  const [user] = await db.insert(users).values({ email: parsed.data.email, name: parsed.data.name, passwordHash: hash })
    .onConflictDoNothing({ target: users.email }).returning();
  if (!user) { res.status(409).json({ error: "Este e-mail já tem conta. Entre com sua senha ou use Esqueci minha senha." }); return; }
  await createStudentSession(user.id, res);
  res.status(201).json({ user: publicUser(user), products: [], progress: {} });
});
router.post("/login", requireTrustedSessionOrigin, limiter, async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Informe e-mail e senha." }); return; }
  const user = await db.transaction(async tx => {
    const [candidate] = await tx.select().from(users).where(eq(users.email, parsed.data.email)).for("update").limit(1);
    const valid = await bcrypt.compare(parsed.data.password, candidate?.passwordHash ?? dummyHash);
    if (!candidate || !valid) return null;
    await createStudentSession(candidate.id, res, tx);
    return candidate;
  });
  if (!user) { res.status(401).json({ error: "E-mail ou senha incorretos." }); return; }
  res.json({ user: publicUser(user), products: await studentProducts(user.id) });
});
router.get("/session", async (req, res) => {
  const student = await requireStudent(req, res); if (!student) return;
  res.json({ user: publicUser(student), products: await studentProducts(student.id), progress: student.progress });
});
router.post("/logout", requireTrustedSessionOrigin, async (req, res) => {
  const cookie = readStudentCookie(req);
  if (cookie) {
    const [id, token] = cookie.split(".");
    // A stale device cannot log out the replacement session.
    await db.update(accounts).set({ sessionHash: null, sessionExpiresAt: null })
      .where(and(eq(accounts.userId, id!), eq(accounts.sessionHash, hashStudentSecret(token!))));
  }
  res.clearCookie(STUDENT_COOKIE, studentCookieOptions()); res.status(204).end();
});
router.post("/activate", requireTrustedSessionOrigin, activationLimiter, async (req, res) => {
  const student = await requireStudent(req, res); if (!student) return;
  const parsed = keySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Informe uma chave válida." }); return; }
  const cookie = readStudentCookie(req)!;
  const result = await db.transaction(async tx => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.userId, student.id)).for("update");
    if (!account || !secretMatches(cookie.split(".")[1]!, account.sessionHash)) return "session";
    const [purchase] = await tx.select().from(purchases).where(eq(purchases.accessToken, parsed.data.key)).for("update").limit(1);
    if (!purchase || purchase.status !== "confirmed" || purchase.revokedAt || purchase.financialHold ||
      !["mini-guide", "complete-bundle"].includes(purchase.productId)) return "invalid";
    if (purchase.claimedByUserId && purchase.claimedByUserId !== student.id) return "claimed";
    if (!purchase.claimedByUserId) await tx.update(purchases).set({ claimedByUserId: student.id, claimedAt: new Date() }).where(eq(purchases.id, purchase.id));
    return "ok";
  });
  if (result === "session") { res.status(401).json({ error: "Sua sessão foi encerrada. Entre novamente.", code: "ACADEMY_SESSION_ENDED" }); return; }
  if (result !== "ok") { res.status(result === "claimed" ? 409 : 403).json({ error: result === "claimed"
    ? "Esta chave já está vinculada a outra conta." : "Chave inválida, pagamento pendente ou acesso suspenso." }); return; }
  res.json({ ok: true, products: await studentProducts(student.id) });
});
router.patch("/progress", requireTrustedSessionOrigin, async (req, res) => {
  const student = await requireStudent(req, res); if (!student) return;
  const parsed = z.object({ lessonId: z.string().min(1).max(150).regex(/^[a-zA-Z0-9_-]+$/), complete: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Progresso inválido." }); return; }
  const token = readStudentCookie(req)!.split(".")[1]!;
  const [updated] = await db.update(accounts).set({ progress: sql`${accounts.progress} || ${JSON.stringify({ [parsed.data.lessonId]: parsed.data.complete })}::jsonb` })
    .where(and(eq(accounts.userId, student.id), eq(accounts.sessionHash, hashStudentSecret(token)))).returning({ progress: accounts.progress });
  if (!updated) { res.status(401).json({ code: "ACADEMY_SESSION_ENDED", error: "Entre novamente." }); return; }
  res.json(updated);
});
router.delete("/progress", requireTrustedSessionOrigin, async (req, res) => {
  const student = await requireStudent(req, res); if (!student) return;
  const token = readStudentCookie(req)!.split(".")[1]!;
  const [updated] = await db.update(accounts).set({ progress: {} }).where(and(eq(accounts.userId, student.id), eq(accounts.sessionHash, hashStudentSecret(token)))).returning({ progress: accounts.progress });
  if (!updated) { res.status(401).json({ code: "ACADEMY_SESSION_ENDED", error: "Entre novamente." }); return; }
  res.json(updated);
});
router.post("/forgot-password", requireTrustedSessionOrigin, recoveryLimiter, async (req, res) => {
  const parsed = z.object({ email }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Informe um e-mail válido." }); return; }
  // Respond identically before email delivery so account existence is not disclosed.
  res.json({ ok: true, message: "Se houver uma conta, enviaremos um link para criar uma nova senha." });
  try {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
    if (!user) return;
    const secret = newStudentSecret();
    await db.insert(accounts).values({ userId: user.id, resetHash: hashStudentSecret(secret), resetExpiresAt: new Date(Date.now() + 30 * 60_000) })
      .onConflictDoUpdate({ target: accounts.userId, set: { resetHash: hashStudentSecret(secret), resetExpiresAt: new Date(Date.now() + 30 * 60_000) } });
    const url = new URL("/nexos-academy/", env.APP_URL);
    url.hash = `reset-password?token=${user.id}.${secret}`;
    const result = await deliverFunnelMessage({ to: parsed.data.email, subject: "Redefina sua senha — NexOS Academy",
      html: `<p>Para criar uma nova senha, <a href="${emailHref(url.href)}">acesse este link</a>. Ele expira em 30 minutos e só pode ser usado uma vez.</p><p>Se não solicitou, ignore este e-mail.</p>` },
    { resendKey: env.RESEND_API_KEY, resendFrom: env.RESEND_FROM_EMAIL, gmailUser: env.GMAIL_USER, gmailPassword: env.GMAIL_APP_PASSWORD });
    logger.info({ status: result.status }, "academy: password recovery delivery");
  } catch { logger.error("academy: password recovery failed"); }
});
router.post("/reset-password", requireTrustedSessionOrigin, recoveryLimiter, async (req, res) => {
  const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{64}$/), password }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Link inválido ou senha fora do limite de 8 a 72 caracteres." }); return; }
  const [id, secret] = parsed.data.token.split(".");
  const hash = await bcrypt.hash(parsed.data.password, 12);
  const changed = await db.transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, id!)).for("update");
    const [account] = await tx.select().from(accounts).where(eq(accounts.userId, id!)).for("update");
    if (!account || !account.resetExpiresAt || account.resetExpiresAt.getTime() <= Date.now() || !secretMatches(secret!, account.resetHash)) return false;
    await tx.update(users).set({ passwordHash: hash }).where(eq(users.id, id!));
    await tx.update(authRefreshSessionsTable).set({ revokedAt: new Date() }).where(eq(authRefreshSessionsTable.userId, id!));
    await tx.update(accounts).set({ resetHash: null, resetExpiresAt: null, sessionHash: null, sessionExpiresAt: null }).where(eq(accounts.userId, id!));
    return true;
  });
  if (!changed) { res.status(400).json({ error: "Link inválido, expirado ou já utilizado." }); return; }
  res.json({ ok: true });
});
export default router;

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, usersTable, academyStudentAccountsTable as accounts, academyPurchasesTable as purchases } from "@workspace/db";
import { env } from "../../lib/env.js";

export const STUDENT_COOKIE = "nexos_academy_session";
export const studentCookieOptions = () => ({ httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/academy" });
export const hashStudentSecret = (value: string) => createHash("sha256").update(value).digest("hex");
export const newStudentSecret = () => randomBytes(32).toString("hex");
export function readStudentCookie(req: Pick<Request, "headers">): string | null {
  const cookies = (req.headers.cookie ?? "").split(";").map(value => value.trim()).filter(value => value.startsWith(`${STUDENT_COOKIE}=`));
  if (cookies.length !== 1) return null;
  const raw = cookies[0]!.slice(STUDENT_COOKIE.length + 1);
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{64}$/.test(raw) ? raw : null;
}
export function secretMatches(value: string, expected: string | null): boolean {
  const actual = Buffer.from(hashStudentSecret(value));
  const stored = Buffer.from(expected ?? "");
  return actual.length === stored.length && timingSafeEqual(actual, stored);
}
export async function createStudentSession(userId: string, res: Response, database: Pick<typeof db, "insert"> = db): Promise<void> {
  const token = newStudentSecret();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  await database.insert(accounts).values({ userId, sessionHash: hashStudentSecret(token), sessionExpiresAt: expires })
    .onConflictDoUpdate({ target: accounts.userId, set: { sessionHash: hashStudentSecret(token), sessionExpiresAt: expires } });
  res.cookie(STUDENT_COOKIE, `${userId}.${token}`, { ...studentCookieOptions(), expires });
  res.setHeader("Cache-Control", "private, no-store");
}
export async function readStudent(req: Request) {
  const cookie = readStudentCookie(req);
  if (!cookie) return null;
  const [userId, token] = cookie.split(".");
  const [row] = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name,
    sessionHash: accounts.sessionHash, expires: accounts.sessionExpiresAt, progress: accounts.progress })
    .from(accounts).innerJoin(usersTable, eq(usersTable.id, accounts.userId)).where(eq(accounts.userId, userId!)).limit(1);
  if (!row || !row.expires || row.expires.getTime() <= Date.now() || !secretMatches(token!, row.sessionHash)) return null;
  return { id: row.id, email: row.email, name: row.name, progress: row.progress };
}
export async function requireStudent(req: Request, res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie, Authorization");
  const student = await readStudent(req);
  if (!student) res.status(401).json({ error: readStudentCookie(req)
    ? "Sua sessão foi encerrada ou sua conta foi acessada em outro dispositivo. Entre novamente para continuar."
    : "Entre na sua conta para continuar.", code: "ACADEMY_SESSION_ENDED" });
  return student;
}
export async function studentProducts(userId: string) {
  return db.select({ productId: purchases.productId }).from(purchases).where(and(
    eq(purchases.claimedByUserId, userId), eq(purchases.status, "confirmed"), isNull(purchases.revokedAt), isNull(purchases.financialHold)));
}
export async function authorizeStudentProduct(req: Request, res: Response, product: "mini-guide" | "complete-bundle") {
  const student = await requireStudent(req, res);
  if (!student) return null;
  const products = await studentProducts(student.id);
  if (!products.some(item => item.productId === "complete-bundle" || item.productId === product)) {
    res.status(403).json({ error: "Ative uma chave válida para acessar este produto.", code: "ACADEMY_PRODUCT_REQUIRED" });
    return null;
  }
  return student;
}

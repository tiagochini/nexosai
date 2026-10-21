import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { eq } from 'drizzle-orm';
import { db, pool, academyPurchasesTable as purchases, usersTable, academyStudentAccountsTable as accounts } from '@workspace/db';
import { hashStudentSecret, newStudentSecret, STUDENT_COOKIE } from '../modules/academy/academy-student-session.js';
import contentRouter from '../modules/academy/academy-content.routes.js';
import { CURRICULUM } from '../modules/academy/content/curriculum.js';
import { MINI_GUIDE_HTML } from '../modules/academy/content/mini-guide.js';
assert.equal(process.env.NODE_ENV, 'test');
const id = randomUUID(), code = `NX-P1-${randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase()}`;
const userId = randomUUID(), sessionSecret = newStudentSecret();
const cookie = `${STUDENT_COOKIE}=${userId}.${sessionSecret}`;
let routeError: Error | undefined;
const app = express(); app.use('/content', contentRouter);
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { routeError = err; res.status(500).json({ error: 'Test route failed' }); });
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const address = server.address(); assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}/content`;
const request = (path: string, withCode = true) => fetch(base + path, { headers: withCode ? { Cookie: cookie } : {} });
async function denied(path: string, expected: number, withCode = true) {
  const response = await request(path, withCode); assert.equal(response.status, expected);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const body = await response.text(); assert.ok(!body.includes('curriculum') && !body.includes('html'));
}
try {
  await db.insert(usersTable).values({ id: userId, name: 'Student fixture', email: `student-${userId}@example.invalid`, passwordHash: 'not-a-password' });
  await db.insert(accounts).values({ userId, sessionHash: hashStudentSecret(sessionSecret), sessionExpiresAt: new Date(Date.now() + 60000) });
  await db.insert(purchases).values({ id, claimedByUserId: userId, accessToken: code, customerName: 'P1 owned fixture', customerEmail: `p1-${id}@example.invalid`, productId: 'mini-guide', status: 'pending', amountCents: 100 });
  await denied(`/course?token=${code}`, 401, false);
  await denied('/mini-guide', 403);
  await db.update(purchases).set({ status: 'confirmed' }).where(eq(purchases.id, id));
  await denied('/course', 403);
  const guide = await request('/mini-guide'); assert.equal(guide.status, 200); assert.equal((await guide.json() as { html: string }).html, MINI_GUIDE_HTML);
  const pdf = await request('/mini-guide.pdf'); assert.equal(pdf.status, 200, routeError?.stack); assert.match(pdf.headers.get('content-type') ?? '', /application\/pdf/);
  const pdfBytes = Buffer.from(await pdf.arrayBuffer()); assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-'); assert.ok(pdfBytes.length > 10_000);
  await db.update(purchases).set({ productId: 'complete-bundle' }).where(eq(purchases.id, id));
  const course = await request('/course'); assert.equal(course.status, 200);
  assert.match(course.headers.get('cache-control') ?? '', /private, no-store/);
  assert.match(course.headers.get('vary') ?? '', /Cookie/);
  const data = await course.json() as { curriculum: typeof CURRICULUM; glossary: unknown[]; bibliography: unknown[] }; assert.deepEqual(data.curriculum, CURRICULUM); assert.ok(data.glossary.length && data.bibliography.length);
  await db.update(purchases).set({ financialHold: 'chargeback' }).where(eq(purchases.id, id)); await denied('/course', 403);
  await db.update(purchases).set({ financialHold: null, revokedAt: new Date() }).where(eq(purchases.id, id)); await denied('/mini-guide', 403);
  await db.update(purchases).set({ revokedAt: null, status: 'refunded' }).where(eq(purchases.id, id)); await denied('/mini-guide.pdf', 403);
  await db.delete(purchases).where(eq(purchases.id, id)); await denied('/mini-guide', 403);
  console.log('PASS paid Academy delivery: no credentials, query-only credentials, pending, wrong product, active grants, hold, revocation, refund, unknown code and private no-store responses');
} finally {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  await db.delete(purchases).where(eq(purchases.id, id)); await db.delete(usersTable).where(eq(usersTable.id, userId)); await pool.end();
}

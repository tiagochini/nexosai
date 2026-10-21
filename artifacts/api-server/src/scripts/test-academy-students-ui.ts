import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import playwright from "../../../../scripts/node_modules/playwright-core/index.js";
const { chromium } = playwright;
import { eq } from "drizzle-orm";
import { db, pool, usersTable, academyPurchasesTable as purchases } from "@workspace/db";

assert.equal(process.env.ACADEMY_STUDENT_OWNED_TESTS, "true");
assert.equal(new URL(process.env.DATABASE_URL!).pathname, "/nexos_academy_students_test");
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const executablePath = process.env.ACADEMY_TEST_BROWSER ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
].find(candidate => existsSync(candidate));
assert.ok(executablePath, "Set ACADEMY_TEST_BROWSER to an installed Chromium browser");
const app = express(); app.use(express.json());
app.use("/nexos-academy", express.static(path.join(root, "artifacts/nexos-academy/dist/public")));
const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
const address = server.address(); assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;
process.env.APP_URL = base; process.env.ALLOWED_ORIGINS = base;
const { default: studentRouter } = await import("../modules/academy/academy-student.routes.js");
const { default: contentRouter } = await import("../modules/academy/academy-content.routes.js");
app.use("/api/academy/student", studentRouter); app.use("/api/academy/content", contentRouter);
const browser = await chromium.launch({ executablePath, headless: true });
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await desktop.newPage(), phone = await mobile.newPage();
const email = `ui-${randomUUID()}@example.invalid`, password = "UI-owned-password-123";
const purchaseId = randomUUID(), key = `UI-${randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`;
const screenshots = path.join(root, "artifacts/academy-student-validation"); await mkdir(screenshots, { recursive: true });
const errors: string[] = []; page.on("pageerror", error => errors.push(error.message)); phone.on("pageerror", error => errors.push(error.message));
try {
  await db.insert(purchases).values({ id: purchaseId, accessToken: key, customerEmail: email, productId: "complete-bundle", status: "confirmed", amountCents: 100 });
  await page.goto(base + "/nexos-academy/#login");
  await page.getByRole("heading", { name: "Entrar na Academy", exact: true }).waitFor();
  await page.getByLabel("E-mail", { exact: true }).waitFor();
  await page.getByLabel("Senha", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(screenshots, "login-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Aluno de teste");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar minha conta", exact: true }).click();
  await page.getByRole("heading", { name: "Minha conta", exact: true }).waitFor();
  await page.getByLabel("Ativar produto", { exact: true }).fill(key);
  await page.getByRole("button", { name: "Vincular produto à minha conta", exact: true }).click();
  await page.getByRole("button", { name: "Acessar Curso Completo →", exact: true }).click();
  await page.getByRole("heading", { name: "Módulos do Curso", exact: true }).waitFor();
  await phone.goto(base + "/nexos-academy/#login");
  await phone.getByRole("heading", { name: "Entrar na Academy", exact: true }).waitFor();
  await phone.getByLabel("E-mail", { exact: true }).fill(email);
  await phone.getByLabel("Senha", { exact: true }).fill(password);
  await phone.locator("form").getByRole("button", { name: "Entrar", exact: true }).click();
  await phone.getByRole("heading", { name: "Minha conta", exact: true }).waitFor();
  assert.equal(await phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "Mobile form must fit the viewport");
  await phone.screenshot({ path: path.join(screenshots, "account-mobile.png"), fullPage: true });
  await page.getByRole("alert").filter({ hasText: "outro dispositivo" }).waitFor({ timeout: 25_000 });
  await page.getByRole("heading", { name: "Entrar na Academy", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Módulos do Curso", exact: true }).count(), 0);
  await page.screenshot({ path: path.join(screenshots, "session-ended-desktop.png"), fullPage: true });
  await phone.reload(); await phone.getByRole("heading", { name: "Minha conta", exact: true }).waitFor();
  await phone.getByRole("button", { name: "Sair da conta", exact: true }).click();
  await phone.getByRole("heading", { name: "Entrar na Academy", exact: true }).waitFor();
  await phone.getByRole("button", { name: "Esqueci minha senha", exact: true }).click();
  await phone.getByRole("heading", { name: "Recuperar senha", exact: true }).waitFor();
  await phone.goto(base + "/nexos-academy/#reset-password?token=invalid-fixture");
  await phone.getByRole("heading", { name: "Criar nova senha", exact: true }).waitFor();
  await phone.getByLabel("Nova senha", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS Academy browser: desktop signup, key activation, course access, mobile login, automatic desktop logout, session restoration, logout and recovery form; no horizontal mobile overflow or browser errors");
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  await db.delete(purchases).where(eq(purchases.id, purchaseId));
  await db.delete(usersTable).where(eq(usersTable.email, email)); await pool.end();
}

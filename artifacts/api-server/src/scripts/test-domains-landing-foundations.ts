import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  db, domainOperationsTable, domainsTable, landingDeploymentsTable,
  landingRevisionsTable, launchSequencesTable, pagesTable, plansTable,
  usersTable, workspacesTable,
} from "@workspace/db";
import { checkAvailability, renewDomain } from "../modules/domains/domains.service.js";
import { deployLanding, generateLandingRevision } from "../modules/landing-publication/landing-publication.service.js";

if (process.env["DOMAINS_LANDING_DB_TESTS"] !== "true") {
  throw new Error("Refusing DB mutation: run only after applying 0019 with DOMAINS_LANDING_DB_TESTS=true.");
}
if (process.env["REGISTRAR_API_URL"] || process.env["REGISTRAR_API_KEY"] || process.env["LANDING_DEPLOYMENT_URL"]) {
  throw new Error("This focused test is fail-closed and must not call any provider.");
}

const marker = `domains-landing-${process.pid}`;
const [plan] = await db.select({ id: plansTable.id }).from(plansTable).limit(1);
if (!plan) throw new Error("A plan is required before running this test.");
const users = await db.insert(usersTable).values([
  { email: `${marker}-one@e2e.invalid`, name: "Domain Test One", passwordHash: "not-used" },
  { email: `${marker}-two@e2e.invalid`, name: "Domain Test Two", passwordHash: "not-used" },
]).returning({ id: usersTable.id });
const workspaces = await db.insert(workspacesTable).values([
  { ownerId: users[0]!.id, planId: plan.id, name: "Domain Test One", slug: `${marker}-one`, settings: {} },
  { ownerId: users[1]!.id, planId: plan.id, name: "Domain Test Two", slug: `${marker}-two`, settings: {} },
]).returning({ id: workspacesTable.id });
const workspaceId = workspaces[0]!.id;
const foreignWorkspaceId = workspaces[1]!.id;
const source = {
  pageTitle: "Página de teste", metaTitle: "Teste landing", metaDescription: "Descrição da landing de teste",
  sections: [{ headline: "Título seguro", bodyContent: "Conteúdo seguro", cta: { text: "Cadastrar" }, aboveTheFold: true }],
};
let sequenceId: string | undefined;
let pageId: string | undefined;
try {
  // An idempotency key is scoped to the workspace and a missing provider is
  // recorded as blocked, never as a successful availability check.
  const first = await checkAvailability(workspaceId, "example-test.com", "availability-test-key");
  const second = await checkAvailability(workspaceId, "example-test.com", "availability-test-key");
  assert.equal(first.status, "capability_blocked");
  assert.equal(second.id, first.id);
  const operations = await db.select().from(domainOperationsTable)
    .where(and(eq(domainOperationsTable.workspaceId, workspaceId), eq(domainOperationsTable.idempotencyKey, "availability-test-key")));
  assert.equal(operations.length, 1, "same workspace/key creates one durable operation");

  const [foreignDomain] = await db.insert(domainsTable).values({
    workspaceId: foreignWorkspaceId, domain: `foreign-${process.pid}.test`, type: "resold", registrarDomainId: "foreign-provider-id",
  }).returning();
  await assert.rejects(() => renewDomain(workspaceId, foreignDomain!.id, 1, "foreign-renew-key"), { code: "NOT_FOUND" });

  const [sequence] = await db.insert(launchSequencesTable).values({
    workspaceId, name: "Capture binding test", leadCaptureEnabled: true,
  }).returning();
  sequenceId = sequence!.id;
  const generated = await generateLandingRevision(workspaceId, {
    title: "Página de teste", slug: `test-${process.pid}`, source, leadCaptureSequenceId: sequenceId,
  });
  pageId = generated.page!.id;
  assert.equal(generated.page!.leadCaptureSequenceId, sequenceId, "capture sequence is bound to page");
  assert.equal(generated.revision!.status, "validated");
  await assert.rejects(
    () => db.update(landingRevisionsTable).set({ html: "<p>mutated</p>" }).where(eq(landingRevisionsTable.id, generated.revision!.id)),
    "database trigger prevents revision artifact mutation",
  );

  // With no configured deployment provider, no publication can occur.
  const deployment = await deployLanding(workspaceId, pageId, { revisionId: generated.revision!.id, idempotencyKey: "deployment-test-key" });
  assert.equal(deployment.status, "capability_blocked");
  const [page] = await db.select().from(pagesTable).where(eq(pagesTable.id, pageId)).limit(1);
  assert.equal(page!.status, "preview", "planning artifact is not marked published");
  const retry = await deployLanding(workspaceId, pageId, { revisionId: generated.revision!.id, idempotencyKey: "deployment-test-key" });
  assert.equal(retry.id, deployment.id, "deployment idempotency returns the original record");
  const deployments = await db.select().from(landingDeploymentsTable).where(eq(landingDeploymentsTable.id, deployment.id));
  assert.equal(deployments.length, 1);
  console.log("domains/landing ownership, idempotency, immutable revision, capture binding, and fail-closed publication tests passed");
} finally {
  // Workspace cascade removes all fixture-owned domain, revision, and deployment data.
  await db.delete(usersTable).where(eq(usersTable.email, `${marker}-one@e2e.invalid`));
  await db.delete(usersTable).where(eq(usersTable.email, `${marker}-two@e2e.invalid`));
}
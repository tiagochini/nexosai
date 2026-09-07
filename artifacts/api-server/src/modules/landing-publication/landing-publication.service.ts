import crypto from "crypto";
import { and, desc, eq, max } from "drizzle-orm";
import { auditLogsTable, db, domainsTable, landingDeploymentsTable, landingRevisionsTable, launchSequencesTable, pagesTable } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";

type LandingSource = { pageTitle: string; metaTitle: string; metaDescription: string; sections: Array<{ headline: string; subheadline?: string; bodyContent: string; cta?: { text: string }; aboveTheFold?: boolean }> };
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
function materialize(source: LandingSource) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(source.metaTitle)}</title><meta name="description" content="${esc(source.metaDescription)}"></head><body><main>${source.sections.map((section, index) => `<section data-section="${index}"><h${index === 0 ? "1" : "2"}>${esc(section.headline)}</h${index === 0 && section.subheadline ? `<p>${esc(section.subheadline)}</p>` : ""}<p>${esc(section.bodyContent)}</p>${section.cta ? `<button type="button" data-lead-capture="true">${esc(section.cta.text)}</button>` : ""}</section>`).join("")}</main></body></html>`;
}
function validate(source: LandingSource) {
  const errors: string[] = [];
  if (!source.pageTitle?.trim() || source.pageTitle.length > 160) errors.push("pageTitle é obrigatório e deve ter no máximo 160 caracteres");
  if (!source.metaTitle?.trim() || source.metaTitle.length > 70) errors.push("metaTitle é obrigatório e deve ter no máximo 70 caracteres");
  if (!source.metaDescription?.trim() || source.metaDescription.length > 160) errors.push("metaDescription é obrigatório e deve ter no máximo 160 caracteres");
  if (!Array.isArray(source.sections) || source.sections.length === 0) errors.push("Ao menos uma seção é obrigatória");
  source.sections?.forEach((s, i) => { if (!s.headline?.trim() || !s.bodyContent?.trim()) errors.push(`Seção ${i + 1} precisa de headline e conteúdo`); });
  return errors;
}
async function pageForWorkspace(workspaceId: string, pageId: string) {
  const [page] = await db.select().from(pagesTable).where(and(eq(pagesTable.id, pageId), eq(pagesTable.workspaceId, workspaceId))).limit(1);
  if (!page) throw new NotFoundError("Página"); return page;
}

export async function generateLandingRevision(workspaceId: string, input: { campaignId?: string; title: string; slug: string; source: LandingSource; leadCaptureSequenceId?: string }) {
  const errors = validate(input.source); if (errors.length) throw new AppError(400, "Landing inválida", "LANDING_VALIDATION_FAILED", errors);
  if (input.leadCaptureSequenceId) { const [sequence] = await db.select({ id: launchSequencesTable.id }).from(launchSequencesTable).where(and(eq(launchSequencesTable.id, input.leadCaptureSequenceId), eq(launchSequencesTable.workspaceId, workspaceId))).limit(1); if (!sequence) throw new NotFoundError("Sequência de captura"); }
  const html = materialize(input.source); const hash = crypto.createHash("sha256").update(html).digest("hex");
  const [page] = await db.insert(pagesTable).values({ workspaceId, campaignId: input.campaignId ?? null, title: input.title, slug: input.slug, type: "landing", html, metadata: { generated: true }, leadCaptureSequenceId: input.leadCaptureSequenceId ?? null, status: "preview" }).returning();
  const [revision] = await db.insert(landingRevisionsTable).values({ workspaceId, pageId: page!.id, revision: 1, source: input.source, html, contentHash: hash, status: "validated" }).returning();
  await db.insert(auditLogsTable).values({ workspaceId, campaignId: input.campaignId ?? null, action: "landing.revision.generated", actor: "system", data: { pageId: page!.id, revisionId: revision!.id, contentHash: hash } });
  return { page, revision };
}

export async function deployLanding(workspaceId: string, pageId: string, input: { revisionId: string; domainId?: string; idempotencyKey: string }) {
  const page = await pageForWorkspace(workspaceId, pageId);
  const [existing] = await db.select().from(landingDeploymentsTable).where(and(eq(landingDeploymentsTable.workspaceId, workspaceId), eq(landingDeploymentsTable.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return existing;
  const [revision] = await db.select().from(landingRevisionsTable).where(and(eq(landingRevisionsTable.id, input.revisionId), eq(landingRevisionsTable.pageId, page.id), eq(landingRevisionsTable.workspaceId, workspaceId))).limit(1);
  if (!revision || revision.status !== "validated") throw new AppError(409, "Revisão não está validada para publicação", "REVISION_NOT_PUBLISHABLE");
  if (input.domainId) { const [domain] = await db.select().from(domainsTable).where(and(eq(domainsTable.id, input.domainId), eq(domainsTable.workspaceId, workspaceId))).limit(1); if (!domain) throw new NotFoundError("Domínio"); if (!domain.dnsVerified) throw new AppError(409, "Domínio ainda não foi verificado", "DOMAIN_NOT_VERIFIED"); }
  const [deployment] = await db.insert(landingDeploymentsTable).values({ workspaceId, pageId, revisionId: revision.id, domainId: input.domainId ?? null, idempotencyKey: input.idempotencyKey, provider: env.LANDING_DEPLOYMENT_URL ? "http-deployment" : null, status: env.LANDING_DEPLOYMENT_URL && env.LANDING_DEPLOYMENT_TOKEN ? "deploying" : "capability_blocked", logs: [] }).returning();
  if (!env.LANDING_DEPLOYMENT_URL || !env.LANDING_DEPLOYMENT_TOKEN) { await db.update(landingDeploymentsTable).set({ error: "Nenhum provedor real de deployment configurado", completedAt: new Date() }).where(eq(landingDeploymentsTable.id, deployment!.id)); return { ...deployment!, status: "capability_blocked" as const }; }
  try {
    const response = await fetch(env.LANDING_DEPLOYMENT_URL, { method: "POST", headers: { authorization: `Bearer ${env.LANDING_DEPLOYMENT_TOKEN}`, "content-type": "application/json", "idempotency-key": input.idempotencyKey }, body: JSON.stringify({ pageId, revisionId: revision.id, html: revision.html, domainId: input.domainId ?? null, leadCaptureSequenceId: page.leadCaptureSequenceId }) });
    if (!response.ok) throw new Error(`Deployment provider returned HTTP ${response.status}`);
    const body = await response.json() as { deploymentId?: string; url?: string }; if (!body.deploymentId || !body.url) throw new Error("Deployment provider response lacks deploymentId or url");
    const [published] = await db.update(landingDeploymentsTable).set({ status: "deployed", providerDeploymentId: body.deploymentId, deploymentUrl: body.url, completedAt: new Date(), logs: [{ event: "provider_confirmed", at: new Date().toISOString() }] }).where(eq(landingDeploymentsTable.id, deployment!.id)).returning();
    await db.update(pagesTable).set({ status: "published", domainId: input.domainId ?? null, publishedUrl: body.url, publishedAt: new Date() }).where(eq(pagesTable.id, page.id));
    await db.update(landingRevisionsTable).set({ status: "published" }).where(eq(landingRevisionsTable.id, revision.id));
    await db.insert(auditLogsTable).values({ workspaceId, campaignId: page.campaignId, action: "landing.deployed", actor: "system", data: { pageId, revisionId: revision.id, deploymentId: published!.id, providerDeploymentId: body.deploymentId } });
    return published!;
  } catch (error) { const message = error instanceof Error ? error.message : String(error); const [failed] = await db.update(landingDeploymentsTable).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(landingDeploymentsTable.id, deployment!.id)).returning(); return failed!; }
}

export async function resolvePublishedLanding(host: string, slug: string) {
  const [page] = await db.select({ page: pagesTable, domain: domainsTable }).from(pagesTable).innerJoin(domainsTable, eq(pagesTable.domainId, domainsTable.id)).where(and(eq(domainsTable.domain, host.toLowerCase()), eq(domainsTable.dnsVerified, true), eq(pagesTable.slug, slug), eq(pagesTable.status, "published"))).limit(1);
  return page?.page ?? null;
}
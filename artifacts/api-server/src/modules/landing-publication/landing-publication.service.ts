import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  auditLogsTable, db, domainsTable, landingDeploymentsTable, landingRevisionsTable,
  launchSequencesTable, pagesTable,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";

export type LandingSource = {
  pageTitle: string;
  metaTitle: string;
  metaDescription: string;
  sections: Array<{ headline: string; subheadline?: string; bodyContent: string; cta?: { text: string }; aboveTheFold?: boolean }>;
  colorScheme?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
};
export type LandingImplementation = {
  ctas: Array<{ key: string; label: string; action: "capture_lead" | "url" | "whatsapp"; target: string }>;
  tracking: { metaPixelId?: string | null; tiktokPixelId?: string | null };
};

const esc = (value: string) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** Produces a self-contained, escaped page. Marketing pixels are loaded only after consent. */
export function materializeLandingHtml(source: LandingSource, implementation?: LandingImplementation, sequenceId?: string | null) {
  const scheme = source.colorScheme ?? {};
  const primary = /^#[0-9a-f]{3,8}$/i.test(scheme.primary ?? "") ? scheme.primary! : "#6848f5";
  const background = /^#[0-9a-f]{3,8}$/i.test(scheme.background ?? "") ? scheme.background! : "#ffffff";
  const color = /^#[0-9a-f]{3,8}$/i.test(scheme.text ?? "") ? scheme.text! : "#1d1d25";
  const ctas = implementation?.ctas ?? [];
  const sections = source.sections.map((section, index) => {
    const cta = ctas.find(item => item.key === `section-${index + 1}`) ?? ctas.find(item => item.key === "hero") ?? ctas[0];
    return `<section><h${index === 0 ? "1" : "2"}>${esc(section.headline)}</h${index === 0 ? "1" : "2"}>${section.subheadline ? `<p class="sub">${esc(section.subheadline)}</p>` : ""}<p>${esc(section.bodyContent)}</p>${cta && (section.cta || index === 0) ? `<button class="cta" type="button" data-cta="${esc(cta.key)}">${esc(cta.label)}</button>` : ""}</section>`;
  }).join("");
  const config = { ctas, sequenceId: sequenceId ?? null, metaPixelId: implementation?.tracking.metaPixelId ?? null, tiktokPixelId: implementation?.tracking.tiktokPixelId ?? null };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(source.metaTitle)}</title><meta name="description" content="${esc(source.metaDescription)}"><style>:root{font-family:Inter,system-ui,sans-serif;color:${color};background:${background}}*{box-sizing:border-box}body{margin:0;background:${background};color:${color};line-height:1.65}main{max-width:960px;margin:auto;padding:clamp(24px,6vw,72px) 20px}section{padding:clamp(24px,5vw,56px) 0;border-bottom:1px solid #8883}h1,h2{line-height:1.15;margin:0 0 18px}h1{font-size:clamp(2rem,6vw,4rem)}h2{font-size:clamp(1.5rem,4vw,2.5rem)}p{white-space:pre-wrap}.sub{font-size:1.2rem;opacity:.8}.cta,.consent button,.dialog button{border:0;border-radius:6px;padding:14px 22px;background:${primary};color:white;font-weight:700;cursor:pointer}.consent{position:fixed;bottom:16px;left:16px;right:16px;max-width:720px;margin:auto;background:#15151df2;color:#fff;padding:18px;border-radius:10px;box-shadow:0 8px 40px #0005;z-index:9}.consent p{margin:0 0 10px}.consent-actions{display:flex;gap:8px;flex-wrap:wrap}.consent .secondary,.dialog .secondary{background:transparent;border:1px solid #aaa;color:inherit}.dialog{display:none;position:fixed;inset:0;background:#0009;z-index:10;place-items:center;padding:16px}.dialog.open{display:grid}.dialog form{width:min(100%,480px);background:white;color:#18181d;padding:24px;border-radius:10px}.dialog label{display:block;margin:12px 0}.dialog input:not([type=checkbox]){display:block;width:100%;padding:12px;border:1px solid #aaa;border-radius:4px}.dialog .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.notice{min-height:1.5em}</style></head><body><main><h1 class="sr-only" style="position:absolute;left:-10000px">${esc(source.pageTitle)}</h1>${sections}</main><div class="consent" id="consent" role="dialog" aria-label="Preferências de privacidade"><p>Usamos cookies de marketing somente com sua autorização para medir esta página e as conversões.</p><div class="consent-actions"><button id="accept">Aceitar cookies de marketing</button><button id="decline" class="secondary">Apenas necessários</button></div></div><div class="dialog" id="dialog" role="dialog" aria-modal="true" aria-labelledby="form-title"><form id="lead-form"><h2 id="form-title">Receba mais informações</h2><label>Nome<input name="name" autocomplete="name" maxlength="160" required></label><label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>Telefone (opcional)<input name="phone" type="tel" autocomplete="tel" maxlength="32"></label><label><input name="consent" type="checkbox" required> Autorizo o contato sobre esta campanha.</label><p class="notice" id="notice" aria-live="polite"></p><div class="actions"><button type="submit">Enviar</button><button class="secondary" id="close" type="button">Fechar</button></div></form></div><script>const CFG=${safeJson(config)};let marketingConsent=localStorage.getItem('nexos-marketing-consent');const consent=document.getElementById('consent');const dialog=document.getElementById('dialog');const notice=document.getElementById('notice');function startPixels(){if(CFG.metaPixelId&&!window.fbq){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=true;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',CFG.metaPixelId);fbq('track','PageView')}if(CFG.tiktokPixelId&&!window.ttq){!function(w,d,t){w.TiktokAnalyticsObject=t;const q=w[t]=w[t]||[];q.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];q.setAndDefer=function(o,m){o[m]=function(){o.push([m].concat([].slice.call(arguments)))}};for(let i=0;i<q.methods.length;i++)q.setAndDefer(q,q.methods[i]);q.instance=function(id){const a=q._i[id]||[];for(let j=0;j<q.methods.length;j++)q.setAndDefer(a,q.methods[j]);return a};q.load=function(id){const u='https://analytics.tiktok.com/i18n/pixel/events.js';q._i=q._i||{};q._i[id]=[];q._i[id]._u=u;const s=d.createElement('script');s.async=true;s.src=u+'?sdkid='+encodeURIComponent(id)+'&lib='+t;const x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x)};q.load(CFG.tiktokPixelId);q.page()}(window,document,'ttq')}}if(marketingConsent==='granted'){consent.hidden=true;startPixels()}document.getElementById('accept').onclick=()=>{marketingConsent='granted';localStorage.setItem('nexos-marketing-consent',marketingConsent);consent.hidden=true;startPixels()};document.getElementById('decline').onclick=()=>{marketingConsent='denied';localStorage.setItem('nexos-marketing-consent',marketingConsent);consent.hidden=true};document.querySelectorAll('[data-cta]').forEach(button=>button.onclick=()=>{const cta=CFG.ctas.find(item=>item.key===button.dataset.cta);if(!cta)return;if(cta.action==='capture_lead'){dialog.classList.add('open')}else if(cta.action==='whatsapp'){window.open('https://wa.me/'+cta.target.replace(/\\D/g,''),'_blank','noopener')}else{window.location.assign(cta.target)}});document.getElementById('close').onclick=()=>dialog.classList.remove('open');document.getElementById('lead-form').onsubmit=async event=>{event.preventDefault();if(!CFG.sequenceId){notice.textContent='A captura de contatos não está configurada.';return}const form=new FormData(event.currentTarget);const params=new URLSearchParams(location.search);const payload={name:String(form.get('name')||''),email:String(form.get('email')||''),phone:String(form.get('phone')||''),consentText:'Autorizo o contato sobre esta campanha.',source:'landing_page',utmSource:params.get('utm_source')||'',utmMedium:params.get('utm_medium')||'',utmCampaign:params.get('utm_campaign')||'',utmContent:params.get('utm_content')||'',utmTerm:params.get('utm_term')||''};try{const response=await fetch('/api/lead-capture/'+encodeURIComponent(CFG.sequenceId),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível enviar seus dados.');if(marketingConsent==='granted'){if(window.fbq)fbq('track','Lead');if(window.ttq)ttq.track('SubmitForm')}event.currentTarget.reset();notice.textContent='Recebemos seus dados. Obrigado!'}catch(error){notice.textContent=error instanceof Error?error.message:'Falha ao enviar seus dados.'}};</script></body></html>`;
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
  const html = materializeLandingHtml(input.source, undefined, input.leadCaptureSequenceId); const hash = crypto.createHash("sha256").update(html).digest("hex");
  const [page] = await db.insert(pagesTable).values({ workspaceId, campaignId: input.campaignId ?? null, title: input.title, slug: input.slug, html, metadata: { generated: true }, leadCaptureSequenceId: input.leadCaptureSequenceId ?? null, status: "preview" }).returning();
  const [revision] = await db.insert(landingRevisionsTable).values({ workspaceId, pageId: page!.id, revision: 1, source: input.source, html, contentHash: hash, status: "validated" }).returning();
  await db.insert(auditLogsTable).values({ workspaceId, campaignId: input.campaignId ?? null, action: "landing.revision.generated", actor: "system", data: { pageId: page!.id, revisionId: revision!.id, contentHash: hash } });
  return { page, revision };
}

/** Publish an approved campaign landing to the NexOS app on its verified custom domain. */
export async function publishCampaignLanding(input: {
  workspaceId: string; campaignId: string; title: string; domainId: string; domain: string;
  source: LandingSource; implementation: LandingImplementation; sequenceId?: string;
}) {
  const errors = validate(input.source); if (errors.length) throw new AppError(400, "Landing inválida", "LANDING_VALIDATION_FAILED", errors);
  const [domain] = await db.select().from(domainsTable).where(and(eq(domainsTable.id, input.domainId), eq(domainsTable.workspaceId, input.workspaceId), eq(domainsTable.domain, input.domain))).limit(1);
  if (!domain) throw new NotFoundError("Domínio configurado");
  if (!domain.dnsVerified) throw new AppError(409, "Verifique o DNS do domínio antes de publicar", "DOMAIN_NOT_VERIFIED");
  if (input.sequenceId) {
    const [sequence] = await db.select().from(launchSequencesTable).where(and(eq(launchSequencesTable.id, input.sequenceId), eq(launchSequencesTable.workspaceId, input.workspaceId), eq(launchSequencesTable.campaignId, input.campaignId))).limit(1);
    if (!sequence || !sequence.leadCaptureEnabled || !["active", "scheduled"].includes(sequence.status)) throw new AppError(409, "A sequência de captura precisa estar habilitada e ativa ou agendada", "LEAD_CAPTURE_NOT_READY");
  }
  const html = materializeLandingHtml(input.source, input.implementation, input.sequenceId);
  const hash = crypto.createHash("sha256").update(html).digest("hex");
  const slug = "index";
  const [page] = await db.insert(pagesTable).values({ workspaceId: input.workspaceId, campaignId: input.campaignId, domainId: domain.id, title: input.title, slug, html, metadata: { generated: true, source: "approved_campaign_landing", implementation: input.implementation }, leadCaptureSequenceId: input.sequenceId ?? null, status: "published", publishedUrl: `https://${domain.domain}/`, publishedAt: new Date() }).returning();
  const [revision] = await db.insert(landingRevisionsTable).values({ workspaceId: input.workspaceId, pageId: page!.id, revision: 1, source: { ...input.source, implementation: input.implementation } as any, html, contentHash: hash, status: "published" }).returning();
  const idempotencyKey = `campaign-landing:${input.campaignId}:${revision!.id}`;
  const [deployment] = await db.insert(landingDeploymentsTable).values({ workspaceId: input.workspaceId, pageId: page!.id, revisionId: revision!.id, domainId: domain.id, idempotencyKey, provider: "nexos-app", status: "deployed", deploymentUrl: `https://${domain.domain}/`, logs: [{ event: "published_to_nexos_app", at: new Date().toISOString() }], completedAt: new Date() }).returning();
  await db.insert(auditLogsTable).values({ workspaceId: input.workspaceId, campaignId: input.campaignId, action: "landing.campaign_published", actor: "system", data: { pageId: page!.id, revisionId: revision!.id, deploymentId: deployment!.id, domain: domain.domain } });
  return { page: page!, revision: revision!, deployment: deployment! };
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
  const [result] = await db.select({ page: pagesTable, domain: domainsTable }).from(pagesTable).innerJoin(domainsTable, eq(pagesTable.domainId, domainsTable.id)).where(and(eq(domainsTable.domain, host.toLowerCase()), eq(domainsTable.dnsVerified, true), eq(pagesTable.slug, slug), eq(pagesTable.status, "published"))).orderBy(desc(pagesTable.publishedAt)).limit(1);
  return result?.page ?? null;
}

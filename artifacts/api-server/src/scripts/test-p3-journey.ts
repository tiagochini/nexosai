import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, pool, campaignsTable, masterplanVersionsTable, contentPiecesTable, workspaceIntegrationsTable,
  launchSequencesTable, sequenceContactsTable, productSalesTable, workspacesTable, usersTable } from '@workspace/db';
import { registerUser, verifyAccessToken } from '../modules/auth/auth.service.js';
import { logger } from '../lib/logger.js';
import { getCampaignPublishPreview, publishCampaignContentPiece } from '../modules/social/social.service.js';
import leadCaptureRouter from '../modules/launch-sequence/lead-capture.routes.js';
import { createProduct, initiateProductCheckout, reconcileProductSaleFromAsaasWebhook, getSale } from '../modules/product-checkout/product-checkout.service.js';
import { upsertTouchpoint, upsertConversion, reconciliationSummary } from '../modules/paid-media/attribution.service.js';
import { seedE2eFixtures, cleanupE2eFixtures, markerFromSuffix } from './e2e-fixtures.js';

assert.equal(process.env.P3_OWNED_INFRA, 'true'); assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.META_E2E_TEST_MODE, 'true');
const url = new URL(process.env.DATABASE_URL!); assert.equal(url.hostname, 'postgres'); assert.equal(url.pathname, '/nexos_p3');
const marker = markerFromSuffix(`p3_${randomUUID().replaceAll('-', '')}`);
const fixture = await seedE2eFixtures(marker);
let registeredUser: string | undefined, registeredWorkspace: string | undefined;
const nativeFetch = fetch;
let paymentStatus = 'PENDING', paymentValue = 25;
globalThis.fetch = async (input, options) => {
  const target = new URL(String(input));
  if (target.hostname === '127.0.0.1') return nativeFetch(input, options);
  assert.equal(target.hostname, 'sandbox.asaas.com', 'No provider network access in P3');
  let body: unknown;
  if (target.pathname.endsWith('/customers') && options?.method === 'POST') body = { id: 'cus_p3_owned' };
  else if (target.pathname.endsWith('/customers')) body = { data: [] };
  else if (target.pathname.endsWith('/pixQrCode')) body = { encodedImage: 'fixture', payload: 'fixture-pix', expirationDate: '2099-01-01' };
  else if (target.pathname.endsWith('/payments') && options?.method === 'POST') {
    const request = JSON.parse(String(options.body)); assert.equal(request.value, 25); body = { id: 'pay_p3_owned' };
  } else if (target.pathname.endsWith('/payments/pay_p3_owned')) body = { id: 'pay_p3_owned', status: paymentStatus, value: paymentValue, netValue: 24 };
  else throw new Error('Unexpected local provider contract');
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
};
const app = express(); app.use(express.json()); app.use('/api/lead-capture', leadCaptureRouter);
app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ error: 'Fixture failure' }));
const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address(); assert.ok(address && typeof address !== 'string');
try {
  const tokens = await registerUser({ email: `${marker.toLowerCase()}@e2e.invalid`, password: `${marker}-Password!`, name: `${marker} Registered`, planSlug: 'solo' }, logger);
  const registered = verifyAccessToken(tokens.accessToken); const workspace = registered.workspaceId;
  registeredUser = registered.userId; registeredWorkspace = workspace;
  const [integration] = await db.insert(workspaceIntegrationsTable).values({ workspaceId: workspace, provider: 'meta_ads', status: 'connected',
    accountId: `${marker}_page`, accountName: marker, accessToken: 'E2E_DUMMY_LEGACY_PAGE_TOKEN', metadata: { pageId: `${marker}_page` } }).returning();
  const [campaign] = await db.insert(campaignsTable).values({ workspaceId: workspace, title: `${marker} campaign`, status: 'approved' }).returning();
  assert.ok(campaign && integration);
  const [plan] = await db.insert(masterplanVersionsTable).values({ workspaceId: workspace, campaignId: campaign.id, version: 1,
    status: 'approved', snapshot: { fixture: true }, contentHash: `${marker}:hash`, contextFingerprint: `${marker}:context`,
    readinessScore: 100, readinessStatus: 'ready', approvedAt: new Date() }).returning(); assert.ok(plan);
  const [piece] = await db.insert(contentPiecesTable).values({ workspaceId: workspace, campaignId: campaign.id, type: 'social_post',
    status: 'approved', title: marker, content: { text: `${marker}: oficina gratuita. Inscreva-se para conhecer a programação.` } }).returning(); assert.ok(piece);
  await assert.rejects(publishCampaignContentPiece(workspace, campaign.id, piece.id, ''));
  const preview = await getCampaignPublishPreview(workspace, campaign.id, piece.id);
  await publishCampaignContentPiece(workspace, campaign.id, piece.id, preview.fingerprint);
  const [sequence] = await db.insert(launchSequencesTable).values({ workspaceId: workspace, campaignId: campaign.id, name: marker,
    status: 'active', leadCaptureEnabled: true, config: {} }).returning(); assert.ok(sequence);
  const capture = () => fetch(`http://127.0.0.1:${address.port}/api/lead-capture/${sequence.id}`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Owned lead', email: `${marker.toLowerCase()}-buyer@example.invalid`, consentText: 'Autorizo contato sobre esta oficina.', utmSource: 'facebook', utmCampaign: campaign.id, utmContent: piece.id }) });
  const leadResponse = await capture(); assert.equal(leadResponse.status, 201); const lead = await leadResponse.json() as { contactId: string };
  assert.equal((await capture()).status, 200);
  const contacts = await db.select().from(sequenceContactsTable).where(eq(sequenceContactsTable.sequenceId, sequence.id)); assert.equal(contacts.length, 1); assert.equal(contacts[0]!.id, lead.contactId);
  const product = await createProduct({ workspaceId: workspace, name: `${marker} product`, priceCents: 2500, sequenceId: sequence.id });
  const sale = await initiateProductCheckout({ productId: product.id, buyerName: 'Owned lead', buyerEmail: contacts[0]!.email!, method: 'pix' });
  assert.equal(sale.status, 'pending'); assert.equal(await reconcileProductSaleFromAsaasWebhook(sale.externalId!), 'ignored');
  paymentStatus = 'CONFIRMED'; paymentValue = 1;
  await assert.rejects(reconcileProductSaleFromAsaasWebhook(sale.externalId!), 'Wrong amount cannot authorize delivery');
  assert.equal((await getSale(sale.id))!.status, 'pending'); paymentValue = 25;
  await Promise.all(Array.from({ length: 8 }, () => reconcileProductSaleFromAsaasWebhook(sale.externalId!)));
  assert.equal((await getSale(sale.id))!.status, 'paid');
  const occurredAt = new Date().toISOString(), date = occurredAt.slice(0, 10);
  await upsertTouchpoint(workspace, { externalTouchpointId: lead.contactId, occurredAt, utmSource: 'facebook', utmCampaign: campaign.id,
    metadata: { sequenceId: sequence.id, contentPieceId: piece.id } });
  await Promise.all(Array.from({ length: 8 }, () => upsertConversion(workspace, { externalConversionId: sale.id, touchpointExternalId: lead.contactId,
    occurredAt, currency: 'BRL', value: sale.amountCents / 100, metadata: { productId: product.id } })));
  const attribution = await reconciliationSummary(workspace, date, date);
  assert.equal(attribution.crmConversions, 1); assert.equal(attribution.crmRevenue, 25); assert.equal(attribution.unattributedConversions, 0);
  assert.equal((await db.select().from(productSalesTable).where(eq(productSalesTable.id, sale.id))).length, 1);
  await assert.rejects(upsertConversion(fixture.workspaces[1]!, { externalConversionId: 'foreign', touchpointExternalId: lead.contactId, occurredAt, currency: 'BRL', value: 25 }));
  console.log('PASS P3 connected local registration, campaign/content fixture, authorized publication/readback, consented lead, checkout and idempotent attribution');
} finally {
  globalThis.fetch = nativeFetch; await new Promise<void>(resolve => server.close(() => resolve()));
  if (registeredWorkspace && registeredUser) {
    const [owned] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, registeredWorkspace));
    const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, registeredUser));
    assert.equal(owned?.name, `${marker} Registered's Workspace`); assert.equal(owned.ownerId, registeredUser);
    assert.equal(owner?.email, `${marker.toLowerCase()}@e2e.invalid`);
    // The database name/host/test flag and exact fixture ownership were checked
    // above. Only disposable fixture teardown bypasses append-only evidence.
    await db.transaction(async tx => {
      await tx.execute(sql`set local session_replication_role = replica`);
      // Replica mode also disables FK cascades, so remove evidence first, then
      // restore FK enforcement for the ordinary workspace cascade.
      await tx.execute(sql`delete from execution_evidence where workspace_id = ${registeredWorkspace}`);
      await tx.execute(sql`set local session_replication_role = origin`);
      await tx.delete(workspacesTable).where(eq(workspacesTable.id, registeredWorkspace!));
      await tx.delete(usersTable).where(eq(usersTable.id, registeredUser!));
    });
  }
  await cleanupE2eFixtures(fixture); await pool.end();
}

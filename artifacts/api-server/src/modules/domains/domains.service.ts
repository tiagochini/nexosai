import crypto from "crypto";
import { and, eq, lte } from "drizzle-orm";
import { auditLogsTable, db, domainDnsRecordsTable, domainOperationsTable, domainsTable } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";
import { providerBlockReason, providerById, registrarAdapterFor } from "./provider-registry.js";

const normalize = (domain: string) => {
  const value = domain.trim().toLowerCase().replace(/\.$/, "");
  if (!/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) throw new AppError(400, "Domínio inválido", "VALIDATION_ERROR");
  return value;
};
export function supplierLifecycle(paymentStatus: "awaiting_payment" | "paid" | "provisioned" | "expired") {
  return paymentStatus === "expired" ? "payment_expired" as const
    : paymentStatus === "awaiting_payment" ? "awaiting_supplier_payment" as const
      : paymentStatus === "paid" ? "payment_confirmed" as const : "dns_configuring" as const;
}
async function operation(workspaceId: string, domainId: string | null, operationType: "availability" | "register" | "renew" | "dns_upsert" | "dns_delete", key: string, request: Record<string, unknown>, provider: string) {
  const [existing] = await db.select().from(domainOperationsTable).where(and(eq(domainOperationsTable.workspaceId, workspaceId), eq(domainOperationsTable.idempotencyKey, key))).limit(1);
  if (existing) return { row: existing, existing: true };
  const [row] = await db.insert(domainOperationsTable).values({ workspaceId, domainId, operation: operationType, idempotencyKey: key, provider, request }).returning();
  return { row: row!, existing: false };
}
async function finish(operationId: string, status: "succeeded" | "failed" | "capability_blocked", response?: Record<string, unknown>, error?: string) {
  await db.update(domainOperationsTable).set({ status, response: response ?? null, error: error ?? null, completedAt: new Date() }).where(eq(domainOperationsTable.id, operationId));
}
async function ownedDomain(workspaceId: string, domainId: string) {
  const [domain] = await db.select().from(domainsTable).where(and(eq(domainsTable.id, domainId), eq(domainsTable.workspaceId, workspaceId))).limit(1);
  if (!domain) throw new NotFoundError("Domínio");
  return domain;
}

export async function listDomains(workspaceId: string) {
  return db.select().from(domainsTable).where(eq(domainsTable.workspaceId, workspaceId));
}

/** Records ownership intent only. DNS remains unverified until the existing verifier confirms it. */
export async function connectExistingDomain(workspaceId: string, rawDomain: string, providerId: string) {
  const domainName = normalize(rawDomain);
  const provider = providerById(providerId);
  if (!provider) throw new AppError(400, "Provedor desconhecido", "VALIDATION_ERROR");
  const [existing] = await db.select().from(domainsTable).where(eq(domainsTable.domain, domainName)).limit(1);
  if (existing && existing.workspaceId !== workspaceId) throw new AppError(409, "Domínio já pertence a outro workspace", "DOMAIN_OWNERSHIP_CONFLICT");
  const domain = existing ?? (await db.insert(domainsTable).values({
    workspaceId, domain: domainName, type: "custom", lifecycleStatus: "active", registrarProvider: providerId,
    // For DNS-only providers (notably Cloudflare) this is the provider zone lookup key, not a purchase receipt.
    registrarDomainId: providerId === "cloudflare" ? domainName : null, autoRenew: false,
  }).returning())[0]!;
  await db.insert(auditLogsTable).values({ workspaceId, action: "domain.connected_existing", actor: "user", data: { domainId: domain.id, provider: providerId, dnsVerified: domain.dnsVerified } });
  return { domain, verificationRequired: !domain.dnsVerified, setupInstructions: provider.setupInstructions };
}

export async function checkAvailability(workspaceId: string, rawDomain: string, providerOrIdempotencyKey: string, suppliedIdempotencyKey?: string) {
  // Compatibility for internal callers predating provider selection.
  const providerId = suppliedIdempotencyKey ? providerOrIdempotencyKey : "generic";
  const idempotencyKey = suppliedIdempotencyKey ?? providerOrIdempotencyKey;
  const domain = normalize(rawDomain); const provider = providerById(providerId);
  const op = await operation(workspaceId, null, "availability", idempotencyKey, { domain, provider: providerId }, providerId);
  if (op.existing) return op.row;
  const reason = providerBlockReason(provider, "availability"); const client = registrarAdapterFor(providerId);
  if (reason || !client) { await finish(op.row.id, "capability_blocked", undefined, reason ?? "Nenhum registrador real configurado"); return { ...op.row, status: "capability_blocked" as const }; }
  try { const result = await client.availability(domain); await finish(op.row.id, "succeeded", result); return { ...op.row, status: "succeeded" as const, response: result }; }
  catch (error) { await finish(op.row.id, "failed", undefined, error instanceof Error ? error.message : String(error)); throw error; }
}

export async function registerDomain(workspaceId: string, rawDomain: string, providerId: string, years: number, idempotencyKey: string) {
  const domainName = normalize(rawDomain);
  const [alreadyOwned] = await db.select().from(domainsTable).where(eq(domainsTable.domain, domainName)).limit(1);
  if (alreadyOwned && alreadyOwned.workspaceId !== workspaceId) throw new AppError(409, "Domínio já pertence a outro workspace", "DOMAIN_OWNERSHIP_CONFLICT");
  const domain = alreadyOwned ?? (await db.insert(domainsTable).values({ workspaceId, domain: domainName, type: "resold", lifecycleStatus: "quote_ready", registrarProvider: providerId }).returning())[0]!;
  const op = await operation(workspaceId, domain.id, "register", idempotencyKey, { domain: domainName, years, provider: providerId }, providerId);
  if (op.existing) return op.row;
  const reason = providerBlockReason(providerById(providerId), "registration"); const client = registrarAdapterFor(providerId);
  if (reason || !client) { await db.update(domainsTable).set({ lifecycleStatus: "capability_blocked" }).where(eq(domainsTable.id, domain.id)); await finish(op.row.id, "capability_blocked", undefined, reason ?? "Nenhum registrador real configurado"); return { ...op.row, status: "capability_blocked" as const }; }
  try {
    const quote = await client.prepareOrder({ domain: domainName, years, idempotencyKey });
    const lifecycleStatus = supplierLifecycle(quote.paymentStatus);
    await db.update(domainsTable).set({ lifecycleStatus, registrarProvider: client.provider, supplierOrderId: quote.orderId, supplierPaymentReference: quote.paymentReference, supplierPaymentUrl: quote.paymentUrl ?? null, supplierPaymentStatus: quote.paymentStatus }).where(eq(domainsTable.id, domain.id));
    const response = { orderId: quote.orderId, paymentReference: quote.paymentReference, paymentUrl: quote.paymentUrl, paymentInstructions: quote.paymentInstructions, paymentStatus: quote.paymentStatus };
    await finish(op.row.id, "succeeded", response);
    await db.insert(auditLogsTable).values({ workspaceId, action: "domain.supplier_payment_requested", actor: "system", data: { domainId: domain.id, operationId: op.row.id, provider: client.provider, supplierOrderId: quote.orderId } });
    return { ...op.row, status: "succeeded" as const, response };
  } catch (error) { await db.update(domainsTable).set({ lifecycleStatus: "failed" }).where(eq(domainsTable.id, domain.id)); await finish(op.row.id, "failed", undefined, error instanceof Error ? error.message : String(error)); throw error; }
}

/** Polls the supplier using its order reference; callers cannot post a paid status themselves. */
export async function reconcileSupplierPayment(workspaceId: string, domainId: string) {
  const domain = await ownedDomain(workspaceId, domainId);
  if (!domain.supplierOrderId || !domain.registrarProvider) throw new AppError(409, "Domínio não possui pedido de fornecedor para reconciliar", "SUPPLIER_ORDER_MISSING");
  const client = registrarAdapterFor(domain.registrarProvider);
  if (!client) throw new AppError(409, "Reconciliação do fornecedor não está configurada", "SUPPLIER_RECONCILIATION_UNAVAILABLE");
  const receipt = await client.getOrder({ orderId: domain.supplierOrderId });
  if (receipt.paymentReference !== domain.supplierPaymentReference) throw new AppError(502, "Recibo do fornecedor não corresponde ao pedido", "SUPPLIER_RECEIPT_MISMATCH");
  const lifecycleStatus = supplierLifecycle(receipt.paymentStatus);
  const [updated] = await db.update(domainsTable).set({
    lifecycleStatus, supplierPaymentStatus: receipt.paymentStatus,
    registrarDomainId: receipt.providerDomainId ?? domain.registrarDomainId,
    expiresAt: receipt.expiresAt ?? domain.expiresAt,
  }).where(eq(domainsTable.id, domain.id)).returning();
  await db.insert(auditLogsTable).values({ workspaceId, action: "domain.supplier_payment_reconciled", actor: "system", data: { domainId, supplierOrderId: domain.supplierOrderId, paymentStatus: receipt.paymentStatus } });
  return updated!;
}

/** Webhooks are treated only as a reconciliation trigger; supplier payment data is never trusted from their body. */
export async function reconcileSupplierWebhook(providerId: string, domainId: string, suppliedSecret: string | undefined) {
  if (!env.SUPPLIER_WEBHOOK_SECRET || !suppliedSecret) throw new AppError(401, "Webhook do fornecedor não autorizado", "SUPPLIER_WEBHOOK_UNAUTHORIZED");
  const expected = Buffer.from(env.SUPPLIER_WEBHOOK_SECRET);
  const supplied = Buffer.from(suppliedSecret);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) throw new AppError(401, "Webhook do fornecedor não autorizado", "SUPPLIER_WEBHOOK_UNAUTHORIZED");
  const [domain] = await db.select().from(domainsTable).where(and(eq(domainsTable.id, domainId), eq(domainsTable.registrarProvider, providerId))).limit(1);
  if (!domain) throw new NotFoundError("Pedido do fornecedor");
  return reconcileSupplierPayment(domain.workspaceId, domain.id);
}

export async function renewDomain(workspaceId: string, domainId: string, years: number, idempotencyKey: string) {
  const domain = await ownedDomain(workspaceId, domainId); if (!domain.registrarDomainId) throw new AppError(409, "Domínio não está registrado em um provedor", "DOMAIN_NOT_REGISTERED");
  const providerId = domain.registrarProvider ?? "generic";
  const op = await operation(workspaceId, domain.id, "renew", idempotencyKey, { years, provider: providerId }, providerId);
  if (op.existing) return op.row;
  const reason = providerBlockReason(providerById(providerId), "renewal"); const client = registrarAdapterFor(providerId); if (reason || !client) { await finish(op.row.id, "capability_blocked", undefined, reason ?? "Nenhum registrador real configurado"); return { ...op.row, status: "capability_blocked" as const }; }
  try { const result = await client.renew({ providerDomainId: domain.registrarDomainId, years, idempotencyKey }); if (!result.expiresAt || Number.isNaN(result.expiresAt.getTime())) throw new Error("Resposta do provedor não contém recibo de renovação com expiração"); await db.update(domainsTable).set({ lifecycleStatus: "active", expiresAt: result.expiresAt, renewalAttempts: 0 }).where(eq(domainsTable.id, domain.id)); await finish(op.row.id, "succeeded", { expiresAt: result.expiresAt.toISOString() }); return { ...op.row, status: "succeeded" as const }; }
  catch (error) { await db.update(domainsTable).set({ lifecycleStatus: "renewal_due", renewalAttempts: domain.renewalAttempts + 1 }).where(eq(domainsTable.id, domain.id)); await finish(op.row.id, "failed", undefined, error instanceof Error ? error.message : String(error)); throw error; }
}

export async function upsertDnsRecord(workspaceId: string, domainId: string, input: { type: string; name: string; value: string; ttl: number }, idempotencyKey: string) {
  const domain = await ownedDomain(workspaceId, domainId); if (!domain.registrarDomainId) throw new AppError(409, "DNS exige domínio provisionado pelo fornecedor", "DOMAIN_NOT_REGISTERED");
  if (!["dns_configuring", "ssl_pending", "active"].includes(domain.lifecycleStatus)) throw new AppError(409, "DNS só pode ser configurado após pagamento e provisionamento confirmados pelo fornecedor", "SUPPLIER_PAYMENT_NOT_CONFIRMED");
  const providerId = domain.registrarProvider ?? "generic";
  const op = await operation(workspaceId, domain.id, "dns_upsert", idempotencyKey, input, providerId); if (op.existing) return op.row;
  const reason = providerBlockReason(providerById(providerId), "dns"); const client = registrarAdapterFor(providerId); if (reason || !client) { await finish(op.row.id, "capability_blocked", undefined, reason ?? "Nenhum registrador real configurado"); return { ...op.row, status: "capability_blocked" as const }; }
  try { const result = await client.upsertDns({ providerDomainId: domain.registrarDomainId, ...input, idempotencyKey }); if (!result.providerRecordId) throw new Error("Resposta do provedor não contém recibo do registro DNS"); const [record] = await db.insert(domainDnsRecordsTable).values({ workspaceId, domainId, ...input, providerRecordId: result.providerRecordId }).onConflictDoUpdate({ target: [domainDnsRecordsTable.domainId, domainDnsRecordsTable.type, domainDnsRecordsTable.name], set: { value: input.value, ttl: input.ttl, providerRecordId: result.providerRecordId, verifiedAt: new Date() } }).returning(); await db.update(domainsTable).set({ lifecycleStatus: "ssl_pending" }).where(eq(domainsTable.id, domain.id)); await finish(op.row.id, "succeeded", { providerRecordId: result.providerRecordId }); return record; }
  catch (error) { await finish(op.row.id, "failed", undefined, error instanceof Error ? error.message : String(error)); throw error; }
}

/** Scheduler entry point: marks due domains; a caller must invoke renew with an explicit idempotency key. */
export async function markRenewalsDue(now = new Date()) {
  const cutoff = new Date(now.getTime() + 30 * 86400000);
  return db.update(domainsTable).set({ lifecycleStatus: "renewal_due" }).where(and(eq(domainsTable.autoRenew, true), lte(domainsTable.expiresAt, cutoff), eq(domainsTable.lifecycleStatus, "active"))).returning({ id: domainsTable.id, workspaceId: domainsTable.workspaceId });
}
import { and, eq, lte } from "drizzle-orm";
import { auditLogsTable, db, domainDnsRecordsTable, domainOperationsTable, domainsTable } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";
import { HttpRegistrarAdapter, type RegistrarAdapter } from "./registrar.adapter.js";

const normalize = (domain: string) => {
  const value = domain.trim().toLowerCase().replace(/\.$/, "");
  if (!/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) throw new AppError(400, "Domínio inválido", "VALIDATION_ERROR");
  return value;
};
const adapter = (): RegistrarAdapter | null =>
  env.REGISTRAR_API_URL && env.REGISTRAR_API_KEY && env.REGISTRAR_PROVIDER
    ? new HttpRegistrarAdapter(env.REGISTRAR_PROVIDER, env.REGISTRAR_API_URL, env.REGISTRAR_API_KEY) : null;

async function operation(workspaceId: string, domainId: string | null, operationType: "availability" | "register" | "renew" | "dns_upsert" | "dns_delete", key: string, request: Record<string, unknown>) {
  const [existing] = await db.select().from(domainOperationsTable).where(and(eq(domainOperationsTable.workspaceId, workspaceId), eq(domainOperationsTable.idempotencyKey, key))).limit(1);
  if (existing) return { row: existing, existing: true };
  const [row] = await db.insert(domainOperationsTable).values({ workspaceId, domainId, operation: operationType, idempotencyKey: key, provider: env.REGISTRAR_PROVIDER || null, request }).returning();
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

export async function checkAvailability(workspaceId: string, rawDomain: string, idempotencyKey: string) {
  const domain = normalize(rawDomain); const op = await operation(workspaceId, null, "availability", idempotencyKey, { domain });
  if (op.existing) return op.row;
  const client = adapter();
  if (!client) { await finish(op.row.id, "capability_blocked", undefined, "Nenhum registrador real configurado"); return { ...op.row, status: "capability_blocked" as const }; }
  try { const result = await client.availability(domain); await finish(op.row.id, "succeeded", result); return { ...op.row, status: "succeeded" as const, response: result }; }
  catch (error) { await finish(op.row.id, "failed", undefined, error instanceof Error ? error.message : String(error)); throw error; }
}

export async function registerDomain(workspaceId: string, rawDomain: string, years: number, idempotencyKey: string) {
  const domainName = normalize(rawDomain);
  const [alreadyOwned] = await db.select().from(domainsTable).where(eq(domainsTable.domain, domainName)).limit(1);
  if (alreadyOwned && alreadyOwned.workspaceId !== workspaceId) throw new AppError(409, "Domínio já pertence a outro workspace", "DOMAIN_OWNERSHIP_CONFLICT");
  const domain = alreadyOwned ?? (await db.insert(domainsTable).values({ workspaceId, domain: domainName, type: "resold", lifecycleStatus: "registration_pending", registrarProvider: env.REGISTRAR_PROVIDER || null }).returning())[0]!;
  const op = await operation(workspaceId, domain.id, "register", idempotencyKey, { domain: domainName, years });
  if (op.existing) return op.row;
  const client = adapter();
  if (!client) { await db.update(domainsTable).set({ lifecycleStatus: "capability_blocked" }).where(eq(domainsTable.id, domain.id)); await finish(op.row.id, "capability_blocked", undefined, "Nenhum registrador real configurado"); return { ...op.row, status: "capability_blocked" as const }; }
  try {
    const result = await client.register({ domain: domainName, years, idempotencyKey });
    await db.update(domainsTable).set({ lifecycleStatus: "active", registrarProvider: client.provider, registrarDomainId: result.providerDomainId, expiresAt: result.expiresAt ?? null }).where(eq(domainsTable.id, domain.id));
    await finish(op.row.id, "succeeded", { providerDomainId: result.providerDomainId });
    await db.insert(auditLogsTable).values({ workspaceId, action: "domain.registered", actor: "system", data: { domainId: domain.id, operationId: op.row.id, provider: client.provider } });
    return { ...op.row, status: "succeeded" as const, response: { providerDomainId: result.providerDomainId } };
  } catch (error) { await db.update(domainsTable).set({ lifecycleStatus: "failed" }).where(eq(domainsTable.id, domain.id)); await finish(op.row.id, "failed", undefined, error instanceof Error ? error.message : String(error)); throw error; }
}

export async function renewDomain(workspaceId: string, domainId: string, years: number, idempotencyKey: string) {
  const domain = await ownedDomain(workspaceId, domainId); if (!domain.registrarDomainId) throw new AppError(409, "Domínio não está registrado em um provedor", "DOMAIN_NOT_REGISTERED");
  const op = await operation(workspaceId, domain.id, "renew", idempotencyKey, { years });
  if (op.existing) return op.row;
  const client = adapter(); if (!client) { await finish(op.row.id, "capability_blocked", undefined, "Nenhum registrador real configurado"); return { ...op.row, status: "capability_blocked" as const }; }
  try { const result = await client.renew({ providerDomainId: domain.registrarDomainId, years, idempotencyKey }); await db.update(domainsTable).set({ lifecycleStatus: "active", expiresAt: result.expiresAt ?? domain.expiresAt, renewalAttempts: 0 }).where(eq(domainsTable.id, domain.id)); await finish(op.row.id, "succeeded", { expiresAt: result.expiresAt?.toISOString() }); return { ...op.row, status: "succeeded" as const }; }
  catch (error) { await db.update(domainsTable).set({ lifecycleStatus: "renewal_due", renewalAttempts: domain.renewalAttempts + 1 }).where(eq(domainsTable.id, domain.id)); await finish(op.row.id, "failed", undefined, error instanceof Error ? error.message : String(error)); throw error; }
}

export async function upsertDnsRecord(workspaceId: string, domainId: string, input: { type: string; name: string; value: string; ttl: number }, idempotencyKey: string) {
  const domain = await ownedDomain(workspaceId, domainId); if (!domain.registrarDomainId) throw new AppError(409, "DNS exige domínio registrado", "DOMAIN_NOT_REGISTERED");
  const op = await operation(workspaceId, domain.id, "dns_upsert", idempotencyKey, input); if (op.existing) return op.row;
  const client = adapter(); if (!client) { await finish(op.row.id, "capability_blocked", undefined, "Nenhum registrador real configurado"); return { ...op.row, status: "capability_blocked" as const }; }
  try { const result = await client.upsertDns({ providerDomainId: domain.registrarDomainId, ...input, idempotencyKey }); const [record] = await db.insert(domainDnsRecordsTable).values({ workspaceId, domainId, ...input, providerRecordId: result.providerRecordId }).onConflictDoUpdate({ target: [domainDnsRecordsTable.domainId, domainDnsRecordsTable.type, domainDnsRecordsTable.name], set: { value: input.value, ttl: input.ttl, providerRecordId: result.providerRecordId, verifiedAt: new Date() } }).returning(); await finish(op.row.id, "succeeded", { providerRecordId: result.providerRecordId }); return record; }
  catch (error) { await finish(op.row.id, "failed", undefined, error instanceof Error ? error.message : String(error)); throw error; }
}

/** Scheduler entry point: marks due domains; a caller must invoke renew with an explicit idempotency key. */
export async function markRenewalsDue(now = new Date()) {
  const cutoff = new Date(now.getTime() + 30 * 86400000);
  return db.update(domainsTable).set({ lifecycleStatus: "renewal_due" }).where(and(eq(domainsTable.autoRenew, true), lte(domainsTable.expiresAt, cutoff), eq(domainsTable.lifecycleStatus, "active"))).returning({ id: domainsTable.id, workspaceId: domainsTable.workspaceId });
}
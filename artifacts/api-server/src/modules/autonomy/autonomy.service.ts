import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  auditLogsTable,
  campaignsTable,
  contractAcceptancesTable,
  contractVersionsTable,
  db,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";

const PRODUCT_AUTONOMY_CONTRACT_SNAPSHOT = {
  title: "Contrato de Produto e Autonomia — v0.1",
  workspaceIsolation: "Dados, campanhas, integrações, decisões e evidências são isolados por workspace.",
  economics: "Modelo híbrido: o cliente financia diretamente os provedores de mídia e anúncios.",
  operations: "Operações contínuas e orientadas a eventos.",
  intraplatform: "Otimização autônoma apenas dentro de limites previamente aprovados.",
  interplatform: "Realocação entre plataformas exige aprovação humana prévia.",
  mandatoryPauses: ["provável ilegalidade", "fraude", "violação de direitos", "risco grave de banimento", "overspend", "crise reputacional grave"],
  regulatedDisclaimer: "Atividades reguladas podem exigir regras adicionais; o cliente é responsável pela licitude, autorizações e conformidade.",
  assetRights: "O cliente declara possuir direitos, permissões e bases legais para os ativos fornecidos.",
  sla: "Detalhes de SLA por tier serão definidos no modelo financeiro.",
} as const;

export const PRODUCT_AUTONOMY_CONTRACT = {
  key: "product-autonomy",
  version: "0.1",
  hash: `sha256:${createHash("sha256").update(JSON.stringify(PRODUCT_AUTONOMY_CONTRACT_SNAPSHOT)).digest("hex")}`,
  snapshot: PRODUCT_AUTONOMY_CONTRACT_SNAPSHOT,
} as const;

export type AcceptanceType = "autonomy" | "regulated_activity" | "asset_rights";

async function ensureContractVersion(): Promise<void> {
  await db.insert(contractVersionsTable).values({
    contractKey: PRODUCT_AUTONOMY_CONTRACT.key,
    version: PRODUCT_AUTONOMY_CONTRACT.version,
    contentHash: PRODUCT_AUTONOMY_CONTRACT.hash,
    contentSnapshot: JSON.stringify(PRODUCT_AUTONOMY_CONTRACT.snapshot),
  }).onConflictDoNothing();
}

export async function campaignRequiresRegulatedAcceptance(workspaceId: string, campaignId?: string): Promise<boolean> {
  if (!campaignId) return false;
  const [campaign] = await db.select({ brainData: campaignsTable.brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  const marketValidation = ((campaign.brainData ?? {}) as Record<string, unknown>).marketValidation as Record<string, unknown> | undefined;
  const validators = Array.isArray(marketValidation?.validators) ? marketValidation.validators as Record<string, unknown>[] : [];
  return Boolean(
    marketValidation?.requiresAcknowledgment ||
    validators.some((validator) => validator.requiresAcknowledgment === true || (Array.isArray(validator.regulatoryAlerts) && validator.regulatoryAlerts.length > 0)),
  );
}

export async function getAutonomyStatus(workspaceId: string, campaignId?: string) {
  await ensureContractVersion();
  const regulated = await campaignRequiresRegulatedAcceptance(workspaceId, campaignId);
  const requiredTypes: AcceptanceType[] = ["autonomy", "asset_rights", ...(regulated ? ["regulated_activity"] as AcceptanceType[] : [])];
  const scope = campaignId
    ? or(eq(contractAcceptancesTable.campaignId, campaignId), isNull(contractAcceptancesTable.campaignId))
    : isNull(contractAcceptancesTable.campaignId);
  const rows = await db.select().from(contractAcceptancesTable).where(and(
    eq(contractAcceptancesTable.workspaceId, workspaceId),
    eq(contractAcceptancesTable.contractKey, PRODUCT_AUTONOMY_CONTRACT.key),
    eq(contractAcceptancesTable.contractVersion, PRODUCT_AUTONOMY_CONTRACT.version),
    eq(contractAcceptancesTable.contractHash, PRODUCT_AUTONOMY_CONTRACT.hash),
    inArray(contractAcceptancesTable.acceptanceType, requiredTypes),
    isNull(contractAcceptancesTable.revokedAt),
    scope,
  )).orderBy(desc(contractAcceptancesTable.acceptedAt));
  const acceptedTypes = [...new Set(rows.map((row) => row.acceptanceType))] as AcceptanceType[];
  return {
    contract: { key: PRODUCT_AUTONOMY_CONTRACT.key, version: PRODUCT_AUTONOMY_CONTRACT.version, hash: PRODUCT_AUTONOMY_CONTRACT.hash, snapshot: PRODUCT_AUTONOMY_CONTRACT.snapshot },
    campaignId: campaignId ?? null,
    requiredAcceptanceTypes: requiredTypes,
    acceptedAcceptanceTypes: acceptedTypes,
    missingAcceptanceTypes: requiredTypes.filter((type) => !acceptedTypes.includes(type)),
    regulatedActivityRequired: regulated,
  };
}

export async function acceptContract(workspaceId: string, userId: string, input: { campaignId?: string; acceptanceTypes: AcceptanceType[]; idempotencyKey: string; ipAddress?: string; userAgent?: string }) {
  const status = await getAutonomyStatus(workspaceId, input.campaignId);
  const accepts = [];
  for (const acceptanceType of [...new Set(input.acceptanceTypes)]) {
    const key = `${input.idempotencyKey}:${acceptanceType}`;
    const [existing] = await db.select().from(contractAcceptancesTable)
      .where(and(eq(contractAcceptancesTable.workspaceId, workspaceId), eq(contractAcceptancesTable.idempotencyKey, key))).limit(1);
    if (existing) { accepts.push(existing); continue; }
    const [acceptance] = await db.insert(contractAcceptancesTable).values({
      workspaceId, userId, campaignId: input.campaignId, contractKey: PRODUCT_AUTONOMY_CONTRACT.key,
      contractVersion: PRODUCT_AUTONOMY_CONTRACT.version, contractHash: PRODUCT_AUTONOMY_CONTRACT.hash,
      acceptanceType, evidenceSnapshot: PRODUCT_AUTONOMY_CONTRACT.snapshot, ipAddress: input.ipAddress,
      userAgent: input.userAgent, idempotencyKey: key,
    }).returning();
    accepts.push(acceptance);
    await db.insert(auditLogsTable).values({ workspaceId, campaignId: input.campaignId, action: "contract.accepted", actor: userId, data: { acceptanceType, contractKey: PRODUCT_AUTONOMY_CONTRACT.key, contractVersion: PRODUCT_AUTONOMY_CONTRACT.version, contractHash: PRODUCT_AUTONOMY_CONTRACT.hash } });
  }
  return { acceptances: accepts, status: await getAutonomyStatus(workspaceId, input.campaignId), contract: status.contract };
}

export async function revokeAcceptance(workspaceId: string, userId: string, acceptanceId: string, reason?: string) {
  const [acceptance] = await db.update(contractAcceptancesTable).set({ revokedAt: new Date(), revokedByUserId: userId, revocationReason: reason })
    .where(and(eq(contractAcceptancesTable.id, acceptanceId), eq(contractAcceptancesTable.workspaceId, workspaceId), isNull(contractAcceptancesTable.revokedAt))).returning();
  if (!acceptance) throw new NotFoundError("Contract acceptance");
  await db.insert(auditLogsTable).values({ workspaceId, campaignId: acceptance.campaignId, action: "contract.revoked", actor: userId, data: { acceptanceId, acceptanceType: acceptance.acceptanceType, contractKey: acceptance.contractKey, contractVersion: acceptance.contractVersion } });
  return acceptance;
}

export async function listAutonomyEvidence(workspaceId: string, campaignId?: string) {
  if (campaignId) await campaignRequiresRegulatedAcceptance(workspaceId, campaignId);
  return db.select().from(contractAcceptancesTable).where(and(eq(contractAcceptancesTable.workspaceId, workspaceId), campaignId ? eq(contractAcceptancesTable.campaignId, campaignId) : undefined)).orderBy(desc(contractAcceptancesTable.acceptedAt));
}

export async function enforceLaunchAutonomyGate(workspaceId: string, campaignId: string, actor: string): Promise<void> {
  const [campaign] = await db.select({ executionStartedAt: campaignsTable.executionStartedAt }).from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  if (campaign.executionStartedAt) return;
  const status = await getAutonomyStatus(workspaceId, campaignId);
  if (status.missingAcceptanceTypes.length) {
    await db.insert(auditLogsTable).values({ workspaceId, campaignId, action: "contract.execution_blocked", actor, data: { contractKey: status.contract.key, contractVersion: status.contract.version, contractHash: status.contract.hash, requiredAcceptanceTypes: status.requiredAcceptanceTypes, missingAcceptanceTypes: status.missingAcceptanceTypes } });
    throw new AppError(428, "Aceites obrigatórios de autonomia e direitos de ativos são necessários antes do lançamento.", "CONTRACT_ACCEPTANCE_REQUIRED", { contract: status.contract, requiredAcceptanceTypes: status.requiredAcceptanceTypes, missingAcceptanceTypes: status.missingAcceptanceTypes });
  }
}
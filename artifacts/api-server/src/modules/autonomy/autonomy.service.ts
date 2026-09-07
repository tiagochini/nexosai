import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  auditLogsTable,
  campaignsTable,
  contractAcceptancesTable,
  contractVersionsTable,
  mandatoryPausesTable,
  db,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { isValidTransition } from "../campaigns/campaign-state-machine.js";
import { transitionCampaign } from "../campaigns/campaigns.service.js";
import { getApprovedMasterplan, getCurrentMasterplan } from "../masterplan/masterplan.service.js";

const PRODUCT_AUTONOMY_CONTRACT_SNAPSHOT = {
  title: "Contrato de Produto e Autonomia — v0.2",
  workspaceIsolation: "Dados, campanhas, integrações, decisões e evidências são isolados por workspace.",
  economics: "Modelo híbrido: o cliente financia diretamente os provedores de mídia e anúncios.",
  operations: "Operações contínuas e orientadas a eventos.",
  intraplatform: "Otimização autônoma apenas dentro de limites previamente aprovados.",
  interplatform: "Realocação entre plataformas exige aprovação humana prévia.",
  mandatoryPauses: ["probable_illegality", "fraud", "rights_violation", "severe_account_ban_risk", "overspend", "severe_reputational_crisis"],
  mandatoryPauseEnforcement: "Pausas obrigatórias ativas bloqueiam a próxima ação externa correspondente; disclaimers não as anulam e a resolução não retoma campanhas automaticamente.",
  regulatedDisclaimer: "Atividades reguladas podem exigir regras adicionais; o cliente é responsável pela licitude, autorizações e conformidade.",
  assetRights: "O cliente declara possuir direitos, permissões e bases legais para os ativos fornecidos.",
  sla: "Detalhes de SLA por tier serão definidos no modelo financeiro.",
} as const;

export const PRODUCT_AUTONOMY_CONTRACT = {
  key: "product-autonomy",
  version: "0.2",
  hash: `sha256:${createHash("sha256").update(JSON.stringify(PRODUCT_AUTONOMY_CONTRACT_SNAPSHOT)).digest("hex")}`,
  snapshot: PRODUCT_AUTONOMY_CONTRACT_SNAPSHOT,
} as const;

export type AcceptanceType = "autonomy" | "regulated_activity" | "asset_rights";
export const MANDATORY_PAUSE_CLASSES = ["probable_illegality", "fraud", "rights_violation", "severe_account_ban_risk", "overspend", "severe_reputational_crisis"] as const;
export const MANDATORY_PAUSE_CHANNELS = ["campaign", "instagram", "facebook", "tiktok", "email", "whatsapp", "meta_ads", "tiktok_ads", "paid_media"] as const;
export const MANDATORY_PAUSE_ACTIONS = ["launch", "social_publish", "email_dispatch", "whatsapp_dispatch", "paid_media_sync", "paid_media_execute", "paid_media_budget_update", "paid_media_bid_update", "paid_media_pause", "paid_media_resume"] as const;
export type MandatoryPauseClass = typeof MANDATORY_PAUSE_CLASSES[number];
export type MandatoryPauseChannel = typeof MANDATORY_PAUSE_CHANNELS[number];
export type MandatoryPauseAction = typeof MANDATORY_PAUSE_ACTIONS[number];
type PauseScope = { campaignId?: string; channel?: MandatoryPauseChannel; action?: MandatoryPauseAction };

export async function enforceNoMandatoryPause(workspaceId: string, scope: PauseScope = {}): Promise<void> {
  const campaignScope = scope.campaignId
    ? or(isNull(mandatoryPausesTable.campaignId), eq(mandatoryPausesTable.campaignId, scope.campaignId))
    : isNull(mandatoryPausesTable.campaignId);
  const channelScope = scope.channel
    ? or(isNull(mandatoryPausesTable.channel), eq(mandatoryPausesTable.channel, scope.channel))
    : isNull(mandatoryPausesTable.channel);
  const actionScope = scope.action
    ? or(isNull(mandatoryPausesTable.action), eq(mandatoryPausesTable.action, scope.action))
    : isNull(mandatoryPausesTable.action);

  const [pause] = await db.select().from(mandatoryPausesTable).where(and(
    eq(mandatoryPausesTable.workspaceId, workspaceId),
    eq(mandatoryPausesTable.status, "active"),
    campaignScope,
    channelScope,
    actionScope,
  )).limit(1);
  if (pause) {
    throw new AppError(423, "Ação bloqueada por pausa obrigatória ativa.", "MANDATORY_PAUSE_ACTIVE", {
      pause: { id: pause.id, pauseClass: pause.pauseClass, severity: pause.severity, campaignId: pause.campaignId, channel: pause.channel, action: pause.action, reason: pause.reason, evidenceSummary: pause.evidenceSummary, createdAt: pause.createdAt },
    });
  }
}

export async function listMandatoryPauses(workspaceId: string, activeOnly = false, campaignId?: string) {
  if (campaignId) await campaignRequiresRegulatedAcceptance(workspaceId, campaignId);
  return db.select().from(mandatoryPausesTable).where(and(
    eq(mandatoryPausesTable.workspaceId, workspaceId),
    activeOnly ? eq(mandatoryPausesTable.status, "active") : undefined,
    campaignId ? eq(mandatoryPausesTable.campaignId, campaignId) : undefined,
  )).orderBy(desc(mandatoryPausesTable.createdAt));
}

export async function createMandatoryPause(workspaceId: string, userId: string, input: {
  campaignId?: string; channel?: MandatoryPauseChannel; action?: MandatoryPauseAction; pauseClass: MandatoryPauseClass; severity: string;
  reason: string; evidenceSummary: string; idempotencyKey: string; sourceType?: "user" | "automated"; sourceActor?: string;
}) {
  if (input.campaignId) await campaignRequiresRegulatedAcceptance(workspaceId, input.campaignId);
  const values = {
    workspaceId, campaignId: input.campaignId, channel: input.channel, action: input.action,
    pauseClass: input.pauseClass, severity: input.severity, reason: input.reason, evidenceSummary: input.evidenceSummary,
    idempotencyKey: input.idempotencyKey, sourceType: input.sourceType ?? "user", sourceActor: input.sourceActor ?? userId,
  } as const;
  const [created] = await db.insert(mandatoryPausesTable).values(values).onConflictDoNothing().returning();
  const [pause] = created ? [created] : await db.select().from(mandatoryPausesTable).where(and(
    eq(mandatoryPausesTable.workspaceId, workspaceId), eq(mandatoryPausesTable.idempotencyKey, input.idempotencyKey),
  )).limit(1);
  if (!pause) throw new AppError(409, "Não foi possível concluir a operação idempotente.", "IDEMPOTENCY_CONFLICT");
  const same = (pause.campaignId ?? undefined) === input.campaignId && (pause.channel ?? undefined) === input.channel
    && (pause.action ?? undefined) === input.action && pause.pauseClass === input.pauseClass
    && pause.severity === input.severity && pause.reason === input.reason && pause.evidenceSummary === input.evidenceSummary
    && pause.sourceType === values.sourceType && pause.sourceActor === values.sourceActor;
  if (!same) throw new AppError(409, "A chave de idempotência já foi usada com dados diferentes.", "IDEMPOTENCY_KEY_REUSED");
  if (!created) return pause;
  await db.insert(auditLogsTable).values({ workspaceId, campaignId: input.campaignId, action: "mandatory_pause.created", actor: input.sourceActor ?? userId, data: { pauseId: pause.id, pauseClass: pause.pauseClass, severity: pause.severity, channel: pause.channel, action: pause.action } });
  if (pause.campaignId && !pause.channel && !pause.action) {
    const [campaign] = await db.select({ status: campaignsTable.status }).from(campaignsTable).where(and(eq(campaignsTable.id, pause.campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
    if (campaign && isValidTransition(campaign.status, "paused")) {
      await transitionCampaign(pause.campaignId, workspaceId, "paused", `mandatory_pause:${pause.id}`, logger);
    }
  }
  return pause;
}

export async function resolveMandatoryPause(workspaceId: string, userId: string, pauseId: string, resolutionReason: string) {
  const [pause] = await db.update(mandatoryPausesTable).set({
    status: "resolved", resolvedAt: new Date(), resolvedByUserId: userId, resolutionReason, updatedAt: new Date(),
  }).where(and(eq(mandatoryPausesTable.id, pauseId), eq(mandatoryPausesTable.workspaceId, workspaceId), eq(mandatoryPausesTable.status, "active"))).returning();
  if (!pause) throw new NotFoundError("Mandatory pause");
  await db.insert(auditLogsTable).values({ workspaceId, campaignId: pause.campaignId, action: "mandatory_pause.resolved", actor: userId, data: { pauseId, resolutionReason } });
  return pause;
}

async function ensureContractVersion(): Promise<void> {
  await db.insert(contractVersionsTable).values({
    contractKey: PRODUCT_AUTONOMY_CONTRACT.key,
    version: PRODUCT_AUTONOMY_CONTRACT.version,
    contentHash: PRODUCT_AUTONOMY_CONTRACT.hash,
    contentSnapshot: JSON.stringify(PRODUCT_AUTONOMY_CONTRACT.snapshot),
  }).onConflictDoNothing();
  const [stored] = await db.select({ hash: contractVersionsTable.contentHash }).from(contractVersionsTable).where(and(
    eq(contractVersionsTable.contractKey, PRODUCT_AUTONOMY_CONTRACT.key),
    eq(contractVersionsTable.version, PRODUCT_AUTONOMY_CONTRACT.version),
  )).limit(1);
  if (!stored || stored.hash !== PRODUCT_AUTONOMY_CONTRACT.hash) {
    throw new AppError(409, "Versão imutável do contrato possui hash divergente.", "CONTRACT_VERSION_HASH_CONFLICT");
  }
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
    const values = {
      workspaceId, userId, campaignId: input.campaignId, contractKey: PRODUCT_AUTONOMY_CONTRACT.key,
      contractVersion: PRODUCT_AUTONOMY_CONTRACT.version, contractHash: PRODUCT_AUTONOMY_CONTRACT.hash,
      acceptanceType, evidenceSnapshot: PRODUCT_AUTONOMY_CONTRACT.snapshot, ipAddress: input.ipAddress,
      userAgent: input.userAgent, idempotencyKey: key,
    } as const;
    const [created] = await db.insert(contractAcceptancesTable).values(values).onConflictDoNothing().returning();
    const [acceptance] = created ? [created] : await db.select().from(contractAcceptancesTable)
      .where(and(eq(contractAcceptancesTable.workspaceId, workspaceId), eq(contractAcceptancesTable.idempotencyKey, key))).limit(1);
    if (!acceptance) throw new AppError(409, "Não foi possível concluir a operação idempotente.", "IDEMPOTENCY_CONFLICT");
    const same = acceptance.userId === userId && (acceptance.campaignId ?? undefined) === input.campaignId
      && acceptance.acceptanceType === acceptanceType && acceptance.contractKey === values.contractKey
      && acceptance.contractVersion === values.contractVersion && acceptance.contractHash === values.contractHash;
    if (!same) throw new AppError(409, "A chave de idempotência já foi usada com escopo ou tipo diferente.", "IDEMPOTENCY_KEY_REUSED");
    accepts.push(acceptance);
    if (created) await db.insert(auditLogsTable).values({ workspaceId, campaignId: input.campaignId, action: "contract.accepted", actor: userId, data: { acceptanceType, contractKey: PRODUCT_AUTONOMY_CONTRACT.key, contractVersion: PRODUCT_AUTONOMY_CONTRACT.version, contractHash: PRODUCT_AUTONOMY_CONTRACT.hash } });
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
  // Preserve legacy execution: only campaigns that opted into versioning require
  // an approved Masterplan. This avoids retroactively blocking live production.
  const currentMasterplan = await getCurrentMasterplan(workspaceId, campaignId);
  if (currentMasterplan) {
    const approvedMasterplan = await getApprovedMasterplan(workspaceId, campaignId);
    if (!approvedMasterplan) {
      await db.insert(auditLogsTable).values({ workspaceId, campaignId, action: "masterplan.execution_blocked", actor, data: { masterplanId: currentMasterplan.id, version: currentMasterplan.version, status: currentMasterplan.status, contextFingerprint: currentMasterplan.contextFingerprint } });
      throw new AppError(428, "Masterplan aprovado é necessário antes do lançamento.", "MASTERPLAN_APPROVAL_REQUIRED", { version: currentMasterplan.version });
    }
    await db.insert(auditLogsTable).values({ workspaceId, campaignId, action: "masterplan.execution_gate_passed", actor, data: { masterplanId: approvedMasterplan.id, version: approvedMasterplan.version, contentHash: approvedMasterplan.contentHash, contextFingerprint: approvedMasterplan.contextFingerprint } });
  }
  const status = await getAutonomyStatus(workspaceId, campaignId);
  if (status.missingAcceptanceTypes.length) {
    await db.insert(auditLogsTable).values({ workspaceId, campaignId, action: "contract.execution_blocked", actor, data: { contractKey: status.contract.key, contractVersion: status.contract.version, contractHash: status.contract.hash, requiredAcceptanceTypes: status.requiredAcceptanceTypes, missingAcceptanceTypes: status.missingAcceptanceTypes } });
    throw new AppError(428, "Aceites obrigatórios de autonomia e direitos de ativos são necessários antes do lançamento.", "CONTRACT_ACCEPTANCE_REQUIRED", { contract: status.contract, requiredAcceptanceTypes: status.requiredAcceptanceTypes, missingAcceptanceTypes: status.missingAcceptanceTypes });
  }
}
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, auditLogsTable, campaignsTable, commercialProductsTable, commercialSubscriptionsTable, productIntakesTable, marketIntelReportsTable, socialPostsTable, paidMediaLaunchPlansTable, type ProductIntake } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import type { Logger } from "pino";
import { briefingAnswerCount } from "./product-intake.contracts.js";
import { resolveSocialMediaEntitlement } from "../billing/commercial-entitlements.service.js";

export type IntakeEntryPoint = "launch" | "market_intel" | "social_media" | "paid_media";
const mutableStatuses = new Set(["draft"]);
// Automated compatibility calls have an audit actor, but no user UUID.
const actorUserId = (actorId: string) => actorId === "system" ? null : actorId;

async function productForWorkspace(workspaceId: string, productId: string) {
  const [row] = await db.select({ id: commercialSubscriptionsTable.id }).from(commercialSubscriptionsTable)
    .where(and(eq(commercialSubscriptionsTable.workspaceId, workspaceId), eq(commercialSubscriptionsTable.productId, productId), eq(commercialSubscriptionsTable.status, "active"))).limit(1);
  if (!row) throw new AppError(403, "Product is not available in this workspace", "PRODUCT_NOT_ALLOWED");
}

async function audit(workspaceId: string, action: string, data: Record<string, unknown>, actor = "user") {
  await db.insert(auditLogsTable).values({ workspaceId, action, actor, data });
}

export async function getProductIntake(workspaceId: string, productId: string) {
  await productForWorkspace(workspaceId, productId);
  const [current] = await db.select().from(productIntakesTable).where(and(
    eq(productIntakesTable.workspaceId, workspaceId), eq(productIntakesTable.commercialProductId, productId),
    inArray(productIntakesTable.status, ["approved", "locked"]),
  )).orderBy(desc(productIntakesTable.version)).limit(1);
  const [draft] = await db.select().from(productIntakesTable).where(and(
    eq(productIntakesTable.workspaceId, workspaceId), eq(productIntakesTable.commercialProductId, productId),
    eq(productIntakesTable.status, "draft"),
  )).limit(1);
  return { current: current ?? null, canonicalCurrent: current ?? null, draft: draft ?? null, decision: draft ? "continue_or_review" : "create_other_product_or_start" };
}

export async function startProductIntake(workspaceId: string, productId: string, entryPoint: IntakeEntryPoint, actorId: string, sourceCampaignId?: string, log?: Logger) {
  await productForWorkspace(workspaceId, productId);
  if (entryPoint === "social_media") {
    const entitlement = await resolveSocialMediaEntitlement(workspaceId);
    if (!entitlement.active || entitlement.productId !== productId) {
      throw new AppError(403, "A current Social Media contract is required to start this briefing", "SOCIAL_MEDIA_ENTITLEMENT_REQUIRED");
    }
  }
  const existing = await getProductIntake(workspaceId, productId);
  if (existing.draft) return { intake: existing.draft, canonicalCurrent: existing.canonicalCurrent, draft: existing.draft, decision: "continue_or_review", created: false };
  const [latest] = await db.select({ version: productIntakesTable.version }).from(productIntakesTable)
    .where(and(eq(productIntakesTable.workspaceId, workspaceId), eq(productIntakesTable.commercialProductId, productId)))
    .orderBy(desc(productIntakesTable.version)).limit(1);
  const [created] = await db.insert(productIntakesTable).values({
    workspaceId, commercialProductId: productId, version: (latest?.version ?? 0) + 1, entryPoint,
    sourceCampaignId, createdByUserId: actorUserId(actorId), snapshot: {},
  }).returning();
  await audit(workspaceId, "product_intake.started", { intakeId: created.id, productId, entryPoint }, actorId);
  log?.info({ intakeId: created.id, productId }, "Canonical product intake started");
  return { intake: created, canonicalCurrent: existing.canonicalCurrent, draft: created, decision: "continue_or_review", created: true };
}

export async function getSocialMediaBriefingAccess(workspaceId: string) {
  const entitlement = await resolveSocialMediaEntitlement(workspaceId);
  return {
    entitlement,
    briefingUrl: entitlement.active && entitlement.productId
      ? `/intake/${entitlement.productId}?entryPoint=social_media`
      : null,
  };
}

export async function updateProductIntake(workspaceId: string, intakeId: string, snapshot: Record<string, unknown>, actorId: string, log?: Logger): Promise<ProductIntake> {
  const [intake] = await db.select().from(productIntakesTable).where(and(eq(productIntakesTable.id, intakeId), eq(productIntakesTable.workspaceId, workspaceId))).limit(1);
  if (!intake) throw new NotFoundError("Product intake");
  if (!mutableStatuses.has(intake.status)) {
    const [latest] = await db.select({ version: productIntakesTable.version }).from(productIntakesTable)
      .where(and(eq(productIntakesTable.workspaceId, workspaceId), eq(productIntakesTable.commercialProductId, intake.commercialProductId)))
      .orderBy(desc(productIntakesTable.version)).limit(1);
    const [successor] = await db.insert(productIntakesTable).values({ workspaceId, commercialProductId: intake.commercialProductId, version: (latest?.version ?? 0) + 1, status: "draft", snapshot: { ...(intake.snapshot as Record<string, unknown>), ...snapshot }, entryPoint: intake.entryPoint, sourceCampaignId: intake.sourceCampaignId, createdByUserId: actorUserId(actorId) }).returning();
    await audit(workspaceId, "product_intake.successor_created", { previousId: intake.id, intakeId: successor.id }, actorId);
    return successor;
  }
  const [updated] = await db.update(productIntakesTable).set({ snapshot, updatedAt: new Date() }).where(eq(productIntakesTable.id, intake.id)).returning();
  await audit(workspaceId, "product_intake.updated", { intakeId }, actorId);
  log?.info({ intakeId }, "Canonical product intake updated");
  return updated;
}

export async function approveProductIntake(workspaceId: string, intakeId: string, actorId: string) {
  const [intake] = await db.select().from(productIntakesTable).where(and(eq(productIntakesTable.id, intakeId), eq(productIntakesTable.workspaceId, workspaceId))).limit(1);
  if (!intake) throw new NotFoundError("Product intake");
  if (intake.status !== "draft") return intake;
  if (briefingAnswerCount((intake.snapshot ?? {}) as Record<string, unknown>) < (intake.entryPoint === "launch" ? 3 : 1)) {
    throw new AppError(400, "Continue o briefing com o agente antes de aprovar. Histórico de conversa não substitui os dados do produto.", "INTAKE_INCOMPLETE");
  }
  const [approved] = await db.update(productIntakesTable).set({ status: "approved", approvedAt: new Date(), approvedByUserId: actorUserId(actorId), updatedAt: new Date() }).where(eq(productIntakesTable.id, intakeId)).returning();
  await audit(workspaceId, "product_intake.approved", { intakeId, version: intake.version }, actorId);
  return approved;
}

export async function listProductIntakeVersions(workspaceId: string, productId: string) {
  await productForWorkspace(workspaceId, productId);
  return db.select().from(productIntakesTable).where(and(eq(productIntakesTable.workspaceId, workspaceId), eq(productIntakesTable.commercialProductId, productId))).orderBy(desc(productIntakesTable.version));
}

export async function previewProductIntakeImpact(workspaceId: string, intakeId: string) {
  const [intake] = await db.select().from(productIntakesTable).where(and(eq(productIntakesTable.id, intakeId), eq(productIntakesTable.workspaceId, workspaceId))).limit(1);
  if (!intake) throw new NotFoundError("Product intake");
  const campaigns = await db.select({ id: campaignsTable.id, title: campaignsTable.title, status: campaignsTable.status }).from(campaignsTable)
    .where(and(eq(campaignsTable.workspaceId, workspaceId), eq(campaignsTable.productIntakeVersionId, intake.id)));
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const [market, social, paid] = await Promise.all([
    campaignIds.length ? db.select({ id: marketIntelReportsTable.id, campaignId: marketIntelReportsTable.campaignId }).from(marketIntelReportsTable).where(and(eq(marketIntelReportsTable.workspaceId, workspaceId), inArray(marketIntelReportsTable.campaignId, campaignIds))) : Promise.resolve([]),
    campaignIds.length ? db.select({ id: socialPostsTable.id, campaignId: socialPostsTable.campaignId }).from(socialPostsTable).where(and(eq(socialPostsTable.workspaceId, workspaceId), inArray(socialPostsTable.campaignId, campaignIds))) : Promise.resolve([]),
    campaignIds.length ? db.select({ id: paidMediaLaunchPlansTable.id, campaignId: paidMediaLaunchPlansTable.campaignId }).from(paidMediaLaunchPlansTable).where(and(eq(paidMediaLaunchPlansTable.workspaceId, workspaceId), inArray(paidMediaLaunchPlansTable.campaignId, campaignIds))) : Promise.resolve([]),
  ]);
  return {
    intakeId, version: intake.version, affectedCampaigns: campaigns,
    surfaces: { launch: campaigns, marketIntel: market, socialMedia: social, paidMedia: paid },
    requiresSuccessor: intake.status !== "draft",
  };
}

export async function adoptLegacyCampaignIntake(workspaceId: string, campaignId: string, entryPoint: IntakeEntryPoint, actorId: string) {
  const [campaign] = await db.select().from(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  if (campaign.productIntakeVersionId) return campaign.productIntakeVersionId;
  let productId = campaign.commercialProductId;
  if (!productId) {
    const subscriptions = await db.select({ productId: commercialSubscriptionsTable.productId }).from(commercialSubscriptionsTable)
      .where(and(eq(commercialSubscriptionsTable.workspaceId, workspaceId), eq(commercialSubscriptionsTable.status, "active")));
    const products = [...new Set(subscriptions.map((subscription) => subscription.productId))];
    if (products.length !== 1) throw new AppError(409, "Legacy campaign requires explicit product adoption before intake", "LEGACY_PRODUCT_ADOPTION_REQUIRED");
    productId = products[0]!;
  }
  const started = await startProductIntake(workspaceId, productId, entryPoint, actorId, campaignId);
  const intake = started.intake;
  const adopted = intake.snapshot && Object.keys(intake.snapshot as object).length === 0
    ? await updateProductIntake(workspaceId, intake.id, (campaign.intakeData ?? {}) as Record<string, unknown>, actorId)
    : intake;
  const [subscription] = await db.select({ id: commercialSubscriptionsTable.id }).from(commercialSubscriptionsTable)
    .where(and(eq(commercialSubscriptionsTable.workspaceId, workspaceId), eq(commercialSubscriptionsTable.productId, productId), eq(commercialSubscriptionsTable.status, "active"))).limit(1);
  await db.update(campaignsTable).set({ productIntakeVersionId: adopted.id, commercialProductId: productId, commercialSubscriptionId: subscription?.id ?? campaign.commercialSubscriptionId, updatedAt: new Date() }).where(eq(campaignsTable.id, campaignId));
  await audit(workspaceId, "product_intake.legacy_adopted", { campaignId, intakeId: adopted.id }, actorId);
  return adopted.id;
}

/** Lists active product subscriptions that can explicitly adopt a legacy campaign briefing. */
export async function getCampaignBriefingAdoptionOptions(workspaceId: string, campaignId: string) {
  const [campaign] = await db.select().from(campaignsTable).where(and(
    eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId),
  )).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  const [boundIntake] = campaign.productIntakeVersionId
    ? await db.select({ id: productIntakesTable.id, commercialProductId: productIntakesTable.commercialProductId, status: productIntakesTable.status })
      .from(productIntakesTable).where(and(
        eq(productIntakesTable.id, campaign.productIntakeVersionId),
        eq(productIntakesTable.workspaceId, workspaceId),
      )).limit(1)
    : [];
  const bindingProductId = campaign.commercialProductId ?? boundIntake?.commercialProductId ?? null;
  const subscriptions = await db.select({
    subscriptionId: commercialSubscriptionsTable.id,
    productId: commercialProductsTable.id,
    productName: commercialProductsTable.name,
    productKey: commercialProductsTable.key,
  }).from(commercialSubscriptionsTable).innerJoin(
    commercialProductsTable, eq(commercialProductsTable.id, commercialSubscriptionsTable.productId),
  ).where(and(
    eq(commercialSubscriptionsTable.workspaceId, workspaceId),
    eq(commercialSubscriptionsTable.status, "active"),
    eq(commercialProductsTable.status, "active"),
  ));
  const candidates = subscriptions.filter((item) =>
    (!bindingProductId || item.productId === bindingProductId)
    && (!campaign.commercialSubscriptionId || item.subscriptionId === campaign.commercialSubscriptionId),
  );
  const snapshot = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const productName = typeof snapshot["product.name"] === "string" ? String(snapshot["product.name"]).trim() : "";
  const normalizedName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const suggested = productName
    ? candidates.filter((item) => normalizedName(item.productName) === normalizedName(productName))
    : [];
  return {
    campaignId,
    briefingAnswerCount: briefingAnswerCount(snapshot),
    briefingProductName: productName || null,
    currentBinding: {
      commercialProductId: campaign.commercialProductId ?? null,
      commercialSubscriptionId: campaign.commercialSubscriptionId ?? null,
      productIntakeVersionId: campaign.productIntakeVersionId ?? null,
      intakeStatus: boundIntake?.status ?? null,
    },
    candidates: candidates.map((item) => ({ ...item, suggested: suggested.some((row) => row.subscriptionId === item.subscriptionId) })),
  };
}

/** Explicitly adopts the campaign's existing completed briefing as its canonical product intake. */
export async function adoptCampaignBriefingToProduct(
  workspaceId: string,
  campaignId: string,
  subscriptionId: string,
  actorId: string,
) {
  const [campaign] = await db.select().from(campaignsTable).where(and(
    eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId),
  )).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  const [subscription] = await db.select({
    id: commercialSubscriptionsTable.id,
    productId: commercialProductsTable.id,
    productName: commercialProductsTable.name,
  }).from(commercialSubscriptionsTable).innerJoin(
    commercialProductsTable, eq(commercialProductsTable.id, commercialSubscriptionsTable.productId),
  ).where(and(
    eq(commercialSubscriptionsTable.id, subscriptionId),
    eq(commercialSubscriptionsTable.workspaceId, workspaceId),
    eq(commercialSubscriptionsTable.status, "active"),
    eq(commercialProductsTable.status, "active"),
  )).limit(1);
  if (!subscription) throw new AppError(409, "Selecione um produto com assinatura ativa para esta campanha.", "CAMPAIGN_PRODUCT_ADOPTION_INVALID");
  if (campaign.commercialProductId && campaign.commercialProductId !== subscription.productId) {
    throw new AppError(409, "O produto escolhido não corresponde ao produto já vinculado à campanha.", "CAMPAIGN_PRODUCT_MISMATCH");
  }
  if (campaign.commercialSubscriptionId && campaign.commercialSubscriptionId !== subscription.id) {
    throw new AppError(409, "A assinatura escolhida não corresponde à assinatura já vinculada à campanha.", "CAMPAIGN_SUBSCRIPTION_MISMATCH");
  }
  const campaignSnapshot = (campaign.intakeData ?? {}) as Record<string, unknown>;
  if (briefingAnswerCount(campaignSnapshot) < 3) {
    throw new AppError(409, "O briefing salvo ainda não tem dados suficientes para ser adotado como briefing oficial do produto.", "CAMPAIGN_BRIEFING_INCOMPLETE");
  }

  let intake: ProductIntake | undefined;
  if (campaign.productIntakeVersionId) {
    [intake] = await db.select().from(productIntakesTable).where(and(
      eq(productIntakesTable.id, campaign.productIntakeVersionId),
      eq(productIntakesTable.workspaceId, workspaceId),
      eq(productIntakesTable.commercialProductId, subscription.productId),
    )).limit(1);
    if (!intake) throw new AppError(409, "A versão de briefing vinculada pertence a outro produto; revise o vínculo da campanha.", "CAMPAIGN_INTAKE_PRODUCT_MISMATCH");
  }

  if (!intake || intake.status === "superseded") {
    const current = await getProductIntake(workspaceId, subscription.productId);
    const started = await startProductIntake(workspaceId, subscription.productId, "launch", actorId, campaignId);
    const base = (started.intake.snapshot ?? {}) as Record<string, unknown>;
    const approvedSnapshot = (current.canonicalCurrent?.snapshot ?? {}) as Record<string, unknown>;
    const mergedSnapshot = { ...approvedSnapshot, ...base, ...campaignSnapshot };
    const updated = await updateProductIntake(workspaceId, started.intake.id, mergedSnapshot, actorId);
    intake = updated;
  } else if (intake.status === "draft") {
    const mergedSnapshot = { ...((intake.snapshot ?? {}) as Record<string, unknown>), ...campaignSnapshot };
    intake = await updateProductIntake(workspaceId, intake.id, mergedSnapshot, actorId);
  }

  if (!intake || (intake.status !== "approved" && intake.status !== "locked")) {
    if (!intake || briefingAnswerCount((intake.snapshot ?? {}) as Record<string, unknown>) < 3) {
      throw new AppError(409, "O briefing precisa de pelo menos três respostas salvas antes da adoção.", "CAMPAIGN_BRIEFING_INCOMPLETE");
    }
    intake = await approveProductIntake(workspaceId, intake.id, actorId);
  }

  await db.update(campaignsTable).set({
    commercialProductId: subscription.productId,
    commercialSubscriptionId: subscription.id,
    productIntakeVersionId: intake.id,
    updatedAt: new Date(),
  }).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));
  await audit(workspaceId, "campaign.briefing_adopted_as_product_intake", {
    campaignId, productId: subscription.productId, subscriptionId: subscription.id, intakeId: intake.id,
  }, actorId);

  return {
    campaignId,
    productId: subscription.productId,
    productName: subscription.productName,
    subscriptionId: subscription.id,
    intakeId: intake.id,
    intakeStatus: intake.status,
  };
}

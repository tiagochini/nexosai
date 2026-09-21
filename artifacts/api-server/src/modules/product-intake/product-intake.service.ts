import { and, desc, eq, inArray } from "drizzle-orm";
import { db, auditLogsTable, campaignsTable, commercialSubscriptionsTable, productIntakesTable, marketIntelReportsTable, socialPostsTable, paidMediaLaunchPlansTable, type ProductIntake } from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import type { Logger } from "pino";

export type IntakeEntryPoint = "launch" | "market_intel" | "social_media" | "paid_media";
const mutableStatuses = new Set(["draft"]);

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
  const existing = await getProductIntake(workspaceId, productId);
  if (existing.draft) return { intake: existing.draft, canonicalCurrent: existing.canonicalCurrent, draft: existing.draft, decision: "continue_or_review", created: false };
  const [latest] = await db.select({ version: productIntakesTable.version }).from(productIntakesTable)
    .where(and(eq(productIntakesTable.workspaceId, workspaceId), eq(productIntakesTable.commercialProductId, productId)))
    .orderBy(desc(productIntakesTable.version)).limit(1);
  const [created] = await db.insert(productIntakesTable).values({
    workspaceId, commercialProductId: productId, version: (latest?.version ?? 0) + 1, entryPoint,
    sourceCampaignId, createdByUserId: actorId, snapshot: {},
  }).returning();
  await audit(workspaceId, "product_intake.started", { intakeId: created.id, productId, entryPoint }, actorId);
  log?.info({ intakeId: created.id, productId }, "Canonical product intake started");
  return { intake: created, canonicalCurrent: existing.canonicalCurrent, draft: created, decision: "continue_or_review", created: true };
}

export async function updateProductIntake(workspaceId: string, intakeId: string, snapshot: Record<string, unknown>, actorId: string, log?: Logger): Promise<ProductIntake> {
  const [intake] = await db.select().from(productIntakesTable).where(and(eq(productIntakesTable.id, intakeId), eq(productIntakesTable.workspaceId, workspaceId))).limit(1);
  if (!intake) throw new NotFoundError("Product intake");
  if (!mutableStatuses.has(intake.status)) {
    const [latest] = await db.select({ version: productIntakesTable.version }).from(productIntakesTable)
      .where(and(eq(productIntakesTable.workspaceId, workspaceId), eq(productIntakesTable.commercialProductId, intake.commercialProductId)))
      .orderBy(desc(productIntakesTable.version)).limit(1);
    const [successor] = await db.insert(productIntakesTable).values({ workspaceId, commercialProductId: intake.commercialProductId, version: (latest?.version ?? 0) + 1, status: "draft", snapshot: { ...(intake.snapshot as Record<string, unknown>), ...snapshot }, entryPoint: intake.entryPoint, sourceCampaignId: intake.sourceCampaignId, createdByUserId: actorId }).returning();
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
  const [approved] = await db.update(productIntakesTable).set({ status: "approved", approvedAt: new Date(), approvedByUserId: actorId, updatedAt: new Date() }).where(eq(productIntakesTable.id, intakeId)).returning();
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
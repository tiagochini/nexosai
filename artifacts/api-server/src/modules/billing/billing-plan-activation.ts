import { and, desc, eq, sql } from "drizzle-orm";
import { db, campaignsTable, commercialProductsTable, commercialSubscriptionsTable, plansTable, workspacesTable, subscriptionPaymentsTable as payments, type SubscriptionPayment } from "@workspace/db";
import { grantCreditsInTransaction } from "../credits/credits.service.js";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { deactivateTrialSettings } from "../auth/trial-access.service.js";
import { WORKSPACE_PLAN_ACCESS_PRODUCT_KEY } from "./commercial-access.constants.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Creates or refreshes the single campaign entitlement tied to a workspace
 * license. Keeping one stable subscription lets existing trial campaigns keep
 * working after a confirmed plan purchase or an administrative plan grant.
 */
export async function activateWorkspacePlanAccess(
  trx: Transaction,
  workspaceId: string,
  planSlug: string,
  source: "plan_purchase" | "admin_grant" | "invite_code",
  sourcePaymentId?: string,
  grantedByUserId?: string,
  endsAt?: Date | null,
): Promise<{ productId: string; subscriptionId: string }> {
  const [workspace] = await trx.select().from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId)).for("update").limit(1);
  if (!workspace) throw new NotFoundError("Workspace");

  let [product] = await trx.select({ id: commercialProductsTable.id, status: commercialProductsTable.status })
    .from(commercialProductsTable).where(eq(commercialProductsTable.key, WORKSPACE_PLAN_ACCESS_PRODUCT_KEY)).limit(1);
  if (!product) {
    await trx.insert(commercialProductsTable).values({
      key: WORKSPACE_PLAN_ACCESS_PRODUCT_KEY,
      name: "NexOS Workspace Plan Access",
      masterPlanKey: "launch",
      capabilities: { license_plan: { managedBy: "workspace_plan" }, campaigns: { enabled: true } },
      metadata: { purpose: "workspace_plan_campaign_access" },
    }).onConflictDoNothing({ target: commercialProductsTable.key });
    [product] = await trx.select({ id: commercialProductsTable.id, status: commercialProductsTable.status })
      .from(commercialProductsTable).where(eq(commercialProductsTable.key, WORKSPACE_PLAN_ACCESS_PRODUCT_KEY)).limit(1);
  }
  if (!product || product.status !== "active") {
    throw new AppError(409, "O produto de acesso do plano não está ativo", "PLAN_ACCESS_PRODUCT_UNAVAILABLE");
  }

  const [existing] = await trx.select().from(commercialSubscriptionsTable)
    .where(and(
      eq(commercialSubscriptionsTable.workspaceId, workspaceId),
      eq(commercialSubscriptionsTable.productId, product.id),
    )).orderBy(desc(commercialSubscriptionsTable.createdAt)).limit(1).for("update");
  const now = new Date();
  const providerMetadata = {
    source,
    planSlug,
    ...(sourcePaymentId ? { sourcePaymentId } : {}),
    ...(grantedByUserId ? { grantedByUserId } : {}),
  };
  let subscriptionId: string;
  if (existing) {
    const [updated] = await trx.update(commercialSubscriptionsTable).set({
      status: "active",
      providerMetadata,
      startedAt: existing.status === "active" ? existing.startedAt ?? now : now,
      endsAt: endsAt ?? null,
      updatedAt: now,
    }).where(eq(commercialSubscriptionsTable.id, existing.id)).returning({ id: commercialSubscriptionsTable.id });
    subscriptionId = updated!.id;
  } else {
    const [created] = await trx.insert(commercialSubscriptionsTable).values({
      workspaceId,
      productId: product.id,
      status: "active",
      providerMetadata,
      startedAt: now,
      endsAt: endsAt ?? null,
    }).returning({ id: commercialSubscriptionsTable.id });
    if (!created) throw new AppError(500, "Não foi possível ativar o acesso do plano", "PLAN_ACCESS_ACTIVATION_FAILED");
    subscriptionId = created.id;
  }

  const settings = (workspace.settings ?? {}) as Record<string, unknown>;
  await trx.update(workspacesTable).set({
    settings: deactivateTrialSettings(settings, source),
  }).where(eq(workspacesTable.id, workspaceId));

  // A trial campaign is created without commercial bindings. Attach it to the
  // newly active plan entitlement so the user can continue the same briefing.
  await trx.update(campaignsTable).set({
    commercialProductId: product.id,
    commercialSubscriptionId: subscriptionId,
    updatedAt: now,
  }).where(and(
    eq(campaignsTable.workspaceId, workspaceId),
    sql`${campaignsTable.commercialProductId} IS NULL`,
    sql`${campaignsTable.commercialSubscriptionId} IS NULL`,
  ));

  return { productId: product.id, subscriptionId };
}

// Called while the payment is locked. Serialize all entitlement changes with
// credit purchases/deductions on this workspace, without locking other payments.
export async function reconcileWorkspacePlan(trx: Transaction, workspaceId: string, basePlanId: string) {
  const [ws] = await trx.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).for("update");
  if (!ws) throw new NotFoundError("Workspace");
  const [latest] = await trx.select({
    id: payments.id,
    planId: payments.planId,
    planSlug: plansTable.slug,
  }).from(payments).innerJoin(plansTable, eq(plansTable.id, payments.planId)).where(and(
    eq(payments.workspaceId, workspaceId), eq(payments.status, "paid"),
    sql`${payments.metadata}->>'type' = 'plan'`,
    sql`${payments.metadata}->'planActivation' IS NOT NULL`,
  )).orderBy(desc(payments.paidAt), desc(payments.id)).limit(1);
  await trx.update(workspacesTable).set({
    planId: latest?.planId ?? basePlanId,
  }).where(eq(workspacesTable.id, workspaceId));

  if (latest) {
    await activateWorkspacePlanAccess(trx, workspaceId, latest.planSlug, "plan_purchase", latest.id);
    return;
  }
  const [accessProduct] = await trx.select({ id: commercialProductsTable.id })
    .from(commercialProductsTable).where(eq(commercialProductsTable.key, WORKSPACE_PLAN_ACCESS_PRODUCT_KEY)).limit(1);
  if (!accessProduct) return;
  const [activeAccess] = await trx.select({ id: commercialSubscriptionsTable.id, providerMetadata: commercialSubscriptionsTable.providerMetadata })
    .from(commercialSubscriptionsTable).where(and(
      eq(commercialSubscriptionsTable.workspaceId, workspaceId),
      eq(commercialSubscriptionsTable.productId, accessProduct.id),
      eq(commercialSubscriptionsTable.status, "active"),
    )).limit(1).for("update");
  if ((activeAccess?.providerMetadata as { source?: string } | undefined)?.source === "plan_purchase") {
    await trx.update(commercialSubscriptionsTable).set({ status: "expired", updatedAt: new Date() })
      .where(eq(commercialSubscriptionsTable.id, activeAccess.id));
  }
}

export async function activatePaidPlan(trx: Transaction, payment: SubscriptionPayment) {
  const meta = payment.metadata as Record<string, unknown>;
  if (meta.type !== "plan" || payment.status !== "paid" || meta.planActivation) return;
  const [ws] = await trx.select().from(workspacesTable).where(eq(workspacesTable.id, payment.workspaceId)).for("update");
  if (!ws) throw new NotFoundError("Workspace");
  const [plan] = await trx.select().from(plansTable).where(eq(plansTable.id, payment.planId));
  if (!plan) throw new NotFoundError("Plano");
  const amount = meta.planCredits ?? plan.creditsMonthly;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0) {
    throw new AppError(409, "Créditos do plano inválidos", "INVALID_PLAN_CREDITS");
  }
  // Financial provenance belongs to immutable payment history, not general
  // workspace settings that unrelated profile updates can replace.
  const [prior] = await trx.select().from(payments).where(and(
    eq(payments.workspaceId, ws.id), sql`${payments.metadata}->'planActivation' IS NOT NULL`,
  )).limit(1);
  const priorActivation = (prior?.metadata as { planActivation?: { basePlanId?: string } } | undefined)?.planActivation;
  const basePlanId = priorActivation?.basePlanId ?? ws.planId;
  if (amount > 0) await grantCreditsInTransaction(trx, ws.id, amount, "purchase",
    `Créditos incluídos no plano ${plan.name}`, `billing-payment:${payment.id}`);
  await trx.update(payments).set({ metadata: {
    ...meta, planActivation: { creditsGranted: amount, previousPlanId: ws.planId, basePlanId },
  } }).where(eq(payments.id, payment.id));
  await reconcileWorkspacePlan(trx, ws.id, basePlanId);
}

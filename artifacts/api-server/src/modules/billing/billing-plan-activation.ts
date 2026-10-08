import { and, desc, eq, sql } from "drizzle-orm";
import { db, plansTable, workspacesTable, subscriptionPaymentsTable as payments, type SubscriptionPayment } from "@workspace/db";
import { grantCreditsInTransaction } from "../credits/credits.service.js";
import { AppError, NotFoundError } from "../../lib/errors.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Called while the payment is locked. Serialize all entitlement changes with
// credit purchases/deductions on this workspace, without locking other payments.
export async function reconcileWorkspacePlan(trx: Transaction, workspaceId: string, basePlanId: string) {
  const [ws] = await trx.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).for("update");
  if (!ws) throw new NotFoundError("Workspace");
  const [latest] = await trx.select().from(payments).where(and(
    eq(payments.workspaceId, workspaceId), eq(payments.status, "paid"),
    sql`${payments.metadata}->>'type' = 'plan'`,
    sql`${payments.metadata}->'planActivation' IS NOT NULL`,
  )).orderBy(desc(payments.paidAt), desc(payments.id)).limit(1);
  await trx.update(workspacesTable).set({
    planId: latest?.planId ?? basePlanId,
  }).where(eq(workspacesTable.id, workspaceId));
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

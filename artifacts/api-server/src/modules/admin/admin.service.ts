import { eq, count, inArray, sql, sum, gte, and, desc } from "drizzle-orm";
import {
  db,
  workspacesTable,
  usersTable,
  plansTable,
  campaignsTable,
  subscriptionPaymentsTable,
  creditTransactionsTable,
  aiProviderLogsTable,
} from "@workspace/db";

// ─── SaaS User types ──────────────────────────────────────────────────────────

export type SaasUserStatus =
  | "novo"
  | "ativo_lancando"
  | "ativo"
  | "pausado"
  | "hibernado";

export interface SaasUserRow {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userName: string;
  email: string;
  planName: string;
  planSlug: string;
  workspaceStatus: string;
  saasStatus: SaasUserStatus;
  totalCampaigns: number;
  hasActiveLaunch: boolean;
  creditsBalance: number;
  createdAt: string;
  daysSinceCreation: number;
}

export interface AdminOverview {
  total: number;
  byStatus: Record<SaasUserStatus, number>;
  users: SaasUserRow[];
}

// ─── Financial types ──────────────────────────────────────────────────────────

export interface AdminFinancials {
  // Revenue from NexOS itself
  accessRevenueCentsBrl: number;        // soma de subscription_payments paid
  accessRevenuePaid: number;            // qtde de acessos pagos
  packRevenueCentsBrl: number;          // soma de transações de compra de créditos
  packSalesCount: number;               // qtde de packs vendidos
  totalRevenueCentsBrl: number;         // total combinado
  // AI costs (plataforma paga)
  totalAiCostUsd: number;               // custo real de IA (USD)
  totalAiCostBrl: number;               // estimativa BRL (×5.9)
  totalAiCallsCount: number;            // qtde de chamadas de IA
  // Margins
  marginBrl: number;                    // receita - custo IA (BRL)
  marginPct: number;                    // % de margem bruta
  // Funnel
  totalRegistered: number;
  totalPaid: number;
  conversionRate: number;               // paid / registered
  // Time-based
  last7dRevenueCents: number;
  last30dRevenueCents: number;
  last7dSignups: number;
  last30dSignups: number;
  // Upsell opportunities
  lowCreditWorkspaces: { workspaceId: string; workspaceName: string; email: string; balance: number }[];
  // Recent access purchases
  recentPayments: { id: string; email: string; planName: string; amountCents: number; paidAt: string | null; createdAt: string }[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function computeSaasStatus(
  workspaceStatus: string,
  totalCampaigns: number,
  hasActiveLaunch: boolean,
  daysSinceCreation: number
): SaasUserStatus {
  if (workspaceStatus === "suspended") return "pausado";
  if (hasActiveLaunch) return "ativo_lancando";
  if (totalCampaigns === 0 && daysSinceCreation <= 14) return "novo";
  if (totalCampaigns === 0 && daysSinceCreation > 14) return "hibernado";
  return "ativo";
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export async function getAdminOverview(): Promise<AdminOverview> {
  const workspaces = await db
    .select({
      workspaceId: workspacesTable.id,
      workspaceName: workspacesTable.name,
      workspaceStatus: workspacesTable.status,
      creditsBalance: workspacesTable.creditsBalance,
      createdAt: workspacesTable.createdAt,
      userId: usersTable.id,
      userName: usersTable.name,
      email: usersTable.email,
      planName: plansTable.name,
      planSlug: plansTable.slug,
    })
    .from(workspacesTable)
    .innerJoin(usersTable, eq(workspacesTable.ownerId, usersTable.id))
    .innerJoin(plansTable, eq(workspacesTable.planId, plansTable.id))
    .orderBy(desc(workspacesTable.createdAt));

  if (workspaces.length === 0) {
    return { total: 0, byStatus: { novo: 0, ativo_lancando: 0, ativo: 0, pausado: 0, hibernado: 0 }, users: [] };
  }

  const workspaceIds = workspaces.map((w) => w.workspaceId);

  const campaignCounts = await db
    .select({ workspaceId: campaignsTable.workspaceId, total: count() })
    .from(campaignsTable)
    .where(inArray(campaignsTable.workspaceId, workspaceIds))
    .groupBy(campaignsTable.workspaceId);

  const activeLaunches = await db
    .select({ workspaceId: campaignsTable.workspaceId })
    .from(campaignsTable)
    .where(
      sql`${campaignsTable.workspaceId} = ANY(${sql.raw(`ARRAY[${workspaceIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)}) AND ${campaignsTable.status} IN ('executing','live')`
    );

  const countMap = new Map(campaignCounts.map((r) => [r.workspaceId, r.total]));
  const activeLaunchSet = new Set(activeLaunches.map((r) => r.workspaceId));
  const now = Date.now();

  const byStatus: Record<SaasUserStatus, number> = {
    novo: 0, ativo_lancando: 0, ativo: 0, pausado: 0, hibernado: 0,
  };

  const users: SaasUserRow[] = workspaces.map((w) => {
    const totalCampaigns = countMap.get(w.workspaceId) ?? 0;
    const hasActiveLaunch = activeLaunchSet.has(w.workspaceId);
    const daysSinceCreation = Math.floor(
      (now - new Date(w.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const saasStatus = computeSaasStatus(w.workspaceStatus, totalCampaigns, hasActiveLaunch, daysSinceCreation);
    byStatus[saasStatus]++;
    return {
      workspaceId: w.workspaceId,
      workspaceName: w.workspaceName,
      userId: w.userId,
      userName: w.userName,
      email: w.email,
      planName: w.planName,
      planSlug: w.planSlug,
      workspaceStatus: w.workspaceStatus,
      saasStatus,
      totalCampaigns,
      hasActiveLaunch,
      creditsBalance: w.creditsBalance,
      createdAt: w.createdAt.toISOString(),
      daysSinceCreation,
    };
  });

  return { total: workspaces.length, byStatus, users };
}

// ─── Financials ───────────────────────────────────────────────────────────────

export async function getAdminFinancials(): Promise<AdminFinancials> {
  const now = new Date();
  const ago7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Access revenue: subscription_payments where status = 'paid'
  const [accessRev] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${subscriptionPaymentsTable.amountCents}), 0)`,
      paidCount:  sql<number>`count(*)`,
    })
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.status, "paid"));

  // Recent access revenue (7d + 30d)
  const [accessRev7d] = await db
    .select({ totalCents: sql<number>`coalesce(sum(${subscriptionPaymentsTable.amountCents}), 0)` })
    .from(subscriptionPaymentsTable)
    .where(and(eq(subscriptionPaymentsTable.status, "paid"), gte(subscriptionPaymentsTable.paidAt, ago7d)));

  const [accessRev30d] = await db
    .select({ totalCents: sql<number>`coalesce(sum(${subscriptionPaymentsTable.amountCents}), 0)` })
    .from(subscriptionPaymentsTable)
    .where(and(eq(subscriptionPaymentsTable.status, "paid"), gte(subscriptionPaymentsTable.paidAt, ago30d)));

  // Pack revenue: credit_transactions where action = 'purchase' and type = 'credit'
  const [packRev] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${creditTransactionsTable.amount} * 17), 0)`,
      packCount:  sql<number>`count(*)`,
    })
    .from(creditTransactionsTable)
    .where(and(
      eq(creditTransactionsTable.action, "purchase"),
      eq(creditTransactionsTable.type, "credit"),
    ));

  // AI costs
  const [aiCosts] = await db
    .select({
      totalCostUsd: sql<number>`coalesce(sum(cast(${aiProviderLogsTable.costUsd} as float)), 0)`,
      totalCalls:   sql<number>`count(*)`,
    })
    .from(aiProviderLogsTable);

  // Total registered workspaces
  const [totalReg] = await db
    .select({ total: count() })
    .from(workspacesTable);

  // Signups 7d / 30d
  const [signups7d] = await db
    .select({ total: count() })
    .from(workspacesTable)
    .where(gte(workspacesTable.createdAt, ago7d));

  const [signups30d] = await db
    .select({ total: count() })
    .from(workspacesTable)
    .where(gte(workspacesTable.createdAt, ago30d));

  // Low credit workspaces (< 150 cr) — potential upsell
  const lowCredit = await db
    .select({
      workspaceId:   workspacesTable.id,
      workspaceName: workspacesTable.name,
      balance:       workspacesTable.creditsBalance,
      email:         usersTable.email,
    })
    .from(workspacesTable)
    .innerJoin(usersTable, eq(workspacesTable.ownerId, usersTable.id))
    .where(sql`${workspacesTable.creditsBalance} < 150 AND ${workspacesTable.creditsBalance} >= 0`)
    .orderBy(workspacesTable.creditsBalance)
    .limit(10);

  // Recent payments
  const recentPayments = await db
    .select({
      id:          subscriptionPaymentsTable.id,
      email:       usersTable.email,
      planName:    plansTable.name,
      amountCents: subscriptionPaymentsTable.amountCents,
      paidAt:      subscriptionPaymentsTable.paidAt,
      createdAt:   subscriptionPaymentsTable.createdAt,
    })
    .from(subscriptionPaymentsTable)
    .innerJoin(workspacesTable, eq(subscriptionPaymentsTable.workspaceId, workspacesTable.id))
    .innerJoin(usersTable, eq(workspacesTable.ownerId, usersTable.id))
    .innerJoin(plansTable, eq(subscriptionPaymentsTable.planId, plansTable.id))
    .orderBy(desc(subscriptionPaymentsTable.createdAt))
    .limit(10);

  const accessRevCents = Number(accessRev?.totalCents ?? 0);
  const packRevCents   = Number(packRev?.totalCents   ?? 0);
  const totalRevCents  = accessRevCents + packRevCents;
  const aiCostUsd      = Number(aiCosts?.totalCostUsd ?? 0);
  const USD_BRL        = 5.9;
  const aiCostBrl      = aiCostUsd * USD_BRL * 100; // in cents
  const marginBrl      = totalRevCents - aiCostBrl;
  const marginPct      = totalRevCents > 0 ? (marginBrl / totalRevCents) * 100 : 0;
  const totalPaid      = Number(accessRev?.paidCount ?? 0);
  const totalRegistered = Number(totalReg?.total ?? 0);
  const conversionRate  = totalRegistered > 0 ? (totalPaid / totalRegistered) * 100 : 0;

  return {
    accessRevenueCentsBrl: accessRevCents,
    accessRevenuePaid:     totalPaid,
    packRevenueCentsBrl:   packRevCents,
    packSalesCount:        Number(packRev?.packCount ?? 0),
    totalRevenueCentsBrl:  totalRevCents,
    totalAiCostUsd:        aiCostUsd,
    totalAiCostBrl:        aiCostBrl,
    totalAiCallsCount:     Number(aiCosts?.totalCalls ?? 0),
    marginBrl,
    marginPct,
    totalRegistered,
    totalPaid,
    conversionRate,
    last7dRevenueCents:  Number(accessRev7d?.totalCents ?? 0),
    last30dRevenueCents: Number(accessRev30d?.totalCents ?? 0),
    last7dSignups:       Number(signups7d?.total  ?? 0),
    last30dSignups:      Number(signups30d?.total ?? 0),
    lowCreditWorkspaces: lowCredit.map(r => ({
      workspaceId:   r.workspaceId,
      workspaceName: r.workspaceName,
      email:         r.email,
      balance:       r.balance,
    })),
    recentPayments: recentPayments.map(r => ({
      id:          r.id,
      email:       r.email,
      planName:    r.planName,
      amountCents: r.amountCents,
      paidAt:      r.paidAt?.toISOString() ?? null,
      createdAt:   r.createdAt.toISOString(),
    })),
  };
}

import { eq, count, inArray, sql, sum, gte, lte, and, desc, isNotNull } from "drizzle-orm";
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

// ─── DRE — Demonstração do Resultado do Exercício (monthly P&L) ──────────────

export interface DREMonthRow {
  month:               string;   // "YYYY-MM"
  label:               string;   // "Jan/26"
  receitaBrutaCents:   number;
  newClients:          number;
  impostosCents:       number;   // estimated Simples Nacional
  receitaLiquidaCents: number;
  aiCostUsd:           number;
  aiCostBrlCents:      number;
  lucroBrutoCents:     number;
  aiCalls:             number;
}

export async function getAdminDRE(year: number): Promise<{
  year: number; usdBrl: number; simplasRate: number; rows: DREMonthRow[];
}> {
  const start = new Date(`${year}-01-01T00:00:00Z`);
  const end   = new Date(`${year}-12-31T23:59:59Z`);

  const subPayments = await db
    .select({
      month:      sql<string>`to_char(${subscriptionPaymentsTable.paidAt}, 'YYYY-MM')`,
      totalCents: sql<number>`coalesce(sum(${subscriptionPaymentsTable.amountCents}), 0)`,
      clients:    sql<number>`count(distinct ${subscriptionPaymentsTable.workspaceId})`,
    })
    .from(subscriptionPaymentsTable)
    .where(and(
      eq(subscriptionPaymentsTable.status, "paid"),
      isNotNull(subscriptionPaymentsTable.paidAt),
      gte(subscriptionPaymentsTable.paidAt, start),
      lte(subscriptionPaymentsTable.paidAt, end),
    ))
    .groupBy(sql`to_char(${subscriptionPaymentsTable.paidAt}, 'YYYY-MM')`);

  const aiCosts = await db
    .select({
      month:        sql<string>`to_char(${aiProviderLogsTable.createdAt}, 'YYYY-MM')`,
      totalCostUsd: sql<number>`coalesce(sum(cast(${aiProviderLogsTable.costUsd} as float)), 0)`,
      totalCalls:   sql<number>`count(*)`,
    })
    .from(aiProviderLogsTable)
    .where(and(gte(aiProviderLogsTable.createdAt, start), lte(aiProviderLogsTable.createdAt, end)))
    .groupBy(sql`to_char(${aiProviderLogsTable.createdAt}, 'YYYY-MM')`);

  const subMap = new Map(subPayments.map(r => [r.month, { cents: Number(r.totalCents), clients: Number(r.clients) }]));
  const aiMap  = new Map(aiCosts.map(r   => [r.month, { usd: Number(r.totalCostUsd), calls: Number(r.totalCalls) }]));

  const USD_BRL = 5.9;
  const SIMPLES = 0.06;
  const LABELS  = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const rows: DREMonthRow[] = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const rev = subMap.get(key) ?? { cents: 0, clients: 0 };
    const ai  = aiMap.get(key)  ?? { usd: 0, calls: 0 };
    const receitaBrutaCents   = rev.cents;
    const impostosCents       = Math.round(receitaBrutaCents * SIMPLES);
    const receitaLiquidaCents = receitaBrutaCents - impostosCents;
    const aiCostBrlCents      = Math.round(ai.usd * USD_BRL * 100);
    return {
      month: key, label: `${LABELS[i]}/${String(year).slice(2)}`,
      receitaBrutaCents, newClients: rev.clients,
      impostosCents, receitaLiquidaCents,
      aiCostUsd: ai.usd, aiCostBrlCents,
      lucroBrutoCents: receitaLiquidaCents - aiCostBrlCents,
      aiCalls: ai.calls,
    };
  });

  return { year, usdBrl: USD_BRL, simplasRate: SIMPLES, rows };
}

// ─── CRM — client list with revenue & usage data ─────────────────────────────

export interface CRMClient {
  workspaceId:     string;
  workspaceName:   string;
  workspaceStatus: string;
  userId:          string;
  userName:        string;
  email:           string;
  phone:           string | null;
  planSlug:        string | null;
  planName:        string | null;
  creditsBalance:  number;
  totalRevCents:   number;
  paymentCount:    number;
  totalCampaigns:  number;
  createdAt:       string;
}

export async function getAdminCRM(): Promise<{ clients: CRMClient[] }> {
  const rows = await db
    .select({
      workspaceId:     workspacesTable.id,
      workspaceName:   workspacesTable.name,
      workspaceStatus: workspacesTable.status,
      creditsBalance:  workspacesTable.creditsBalance,
      createdAt:       workspacesTable.createdAt,
      userId:          usersTable.id,
      userName:        usersTable.name,
      email:           usersTable.email,
      phone:           usersTable.phone,
      planSlug:        plansTable.slug,
      planName:        plansTable.name,
    })
    .from(workspacesTable)
    .innerJoin(usersTable, eq(workspacesTable.ownerId, usersTable.id))
    .leftJoin(plansTable, eq(workspacesTable.planId, plansTable.id))
    .orderBy(desc(workspacesTable.createdAt));

  const revenues = await db
    .select({
      workspaceId:   subscriptionPaymentsTable.workspaceId,
      totalRevCents: sql<number>`coalesce(sum(${subscriptionPaymentsTable.amountCents}), 0)`,
      paymentCount:  sql<number>`count(*)`,
    })
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.status, "paid"))
    .groupBy(subscriptionPaymentsTable.workspaceId);

  const campCounts = await db
    .select({ workspaceId: campaignsTable.workspaceId, total: sql<number>`count(*)` })
    .from(campaignsTable)
    .groupBy(campaignsTable.workspaceId);

  const revMap  = new Map(revenues.map(r  => [r.workspaceId,   { cents: Number(r.totalRevCents), count: Number(r.paymentCount) }]));
  const campMap = new Map(campCounts.map(r => [r.workspaceId,   Number(r.total)]));

  return {
    clients: rows.map(c => ({
      workspaceId:     c.workspaceId,
      workspaceName:   c.workspaceName,
      workspaceStatus: c.workspaceStatus,
      userId:          c.userId,
      userName:        c.userName,
      email:           c.email,
      phone:           c.phone ?? null,
      planSlug:        c.planSlug ?? null,
      planName:        c.planName ?? null,
      creditsBalance:  c.creditsBalance,
      totalRevCents:   revMap.get(c.workspaceId)?.cents ?? 0,
      paymentCount:    revMap.get(c.workspaceId)?.count ?? 0,
      totalCampaigns:  campMap.get(c.workspaceId) ?? 0,
      createdAt:       c.createdAt.toISOString(),
    })),
  };
}

// ─── Cost breakdown per campaign (admin pricing intelligence) ─────────────────

export interface CampaignCostRow {
  campaignId: string;
  campaignName: string | null;
  workspaceId: string;
  workspaceName: string | null;
  ownerEmail: string;
  totalCostUsd: number;
  totalCredits: number;
  totalTokens: number;
  totalCalls: number;
  /** Cost breakdown by agent type */
  byAgent: { agentType: string; costUsd: number; credits: number; calls: number }[];
}

/**
 * Returns real AI cost per campaign sorted by highest cost first.
 * Used by the product owner to understand launch cost structure and set correct credit pricing.
 */
export async function getCampaignCostBreakdown(limitCampaigns = 50): Promise<{
  campaigns: CampaignCostRow[];
  platformTotals: { totalCostUsd: number; totalCredits: number; totalTokens: number; totalCalls: number };
}> {
  // Per-campaign totals
  const campaignTotals = await db
    .select({
      campaignId:   aiProviderLogsTable.campaignId,
      totalCostUsd: sql<number>`coalesce(sum(cast(${aiProviderLogsTable.costUsd} as float)), 0)`,
      totalCredits: sql<number>`coalesce(sum(${aiProviderLogsTable.creditsCharged}), 0)`,
      totalTokens:  sql<number>`coalesce(sum(${aiProviderLogsTable.totalTokens}), 0)`,
      totalCalls:   sql<number>`count(*)`,
    })
    .from(aiProviderLogsTable)
    .where(isNotNull(aiProviderLogsTable.campaignId))
    .groupBy(aiProviderLogsTable.campaignId)
    .orderBy(sql`sum(cast(${aiProviderLogsTable.costUsd} as float)) desc`)
    .limit(limitCampaigns);

  if (campaignTotals.length === 0) {
    return { campaigns: [], platformTotals: { totalCostUsd: 0, totalCredits: 0, totalTokens: 0, totalCalls: 0 } };
  }

  const campaignIds = campaignTotals.map(r => r.campaignId!);

  // Campaign + workspace metadata
  const campaignMeta = await db
    .select({
      campaignId:    campaignsTable.id,
      campaignName:  campaignsTable.title,
      workspaceId:   campaignsTable.workspaceId,
      workspaceName: workspacesTable.name,
      ownerEmail:    usersTable.email,
    })
    .from(campaignsTable)
    .leftJoin(workspacesTable, eq(campaignsTable.workspaceId, workspacesTable.id))
    .leftJoin(usersTable, eq(workspacesTable.ownerId, usersTable.id))
    .where(inArray(campaignsTable.id, campaignIds));

  const metaMap = new Map(campaignMeta.map(r => [r.campaignId, r]));

  // Per-agent breakdown for all matching campaigns
  const agentBreakdown = await db
    .select({
      campaignId:  aiProviderLogsTable.campaignId,
      agentType:   aiProviderLogsTable.agentType,
      costUsd:     sql<number>`coalesce(sum(cast(${aiProviderLogsTable.costUsd} as float)), 0)`,
      credits:     sql<number>`coalesce(sum(${aiProviderLogsTable.creditsCharged}), 0)`,
      calls:       sql<number>`count(*)`,
    })
    .from(aiProviderLogsTable)
    .where(inArray(aiProviderLogsTable.campaignId, campaignIds))
    .groupBy(aiProviderLogsTable.campaignId, aiProviderLogsTable.agentType)
    .orderBy(aiProviderLogsTable.campaignId, sql`sum(cast(${aiProviderLogsTable.costUsd} as float)) desc`);

  // Group agent breakdown by campaign
  const agentMap = new Map<string, { agentType: string; costUsd: number; credits: number; calls: number }[]>();
  for (const row of agentBreakdown) {
    const cid = row.campaignId ?? "";
    if (!agentMap.has(cid)) agentMap.set(cid, []);
    agentMap.get(cid)!.push({
      agentType: row.agentType ?? "unknown",
      costUsd:   Number(row.costUsd),
      credits:   Number(row.credits),
      calls:     Number(row.calls),
    });
  }

  const campaigns: CampaignCostRow[] = campaignTotals.map(r => {
    const meta = metaMap.get(r.campaignId!);
    return {
      campaignId:    r.campaignId!,
      campaignName:  meta?.campaignName ?? null,
      workspaceId:   meta?.workspaceId ?? "",
      workspaceName: meta?.workspaceName ?? null,
      ownerEmail:    meta?.ownerEmail ?? "",
      totalCostUsd:  Number(r.totalCostUsd),
      totalCredits:  Number(r.totalCredits),
      totalTokens:   Number(r.totalTokens),
      totalCalls:    Number(r.totalCalls),
      byAgent:       agentMap.get(r.campaignId!) ?? [],
    };
  });

  // Platform-wide totals
  const platformTotals = campaigns.reduce(
    (acc, c) => ({
      totalCostUsd:  acc.totalCostUsd  + c.totalCostUsd,
      totalCredits:  acc.totalCredits  + c.totalCredits,
      totalTokens:   acc.totalTokens   + c.totalTokens,
      totalCalls:    acc.totalCalls    + c.totalCalls,
    }),
    { totalCostUsd: 0, totalCredits: 0, totalTokens: 0, totalCalls: 0 },
  );

  return { campaigns, platformTotals };
}

// ─── Admin payments list ───────────────────────────────────────────────────────

export interface AdminPaymentRow {
  refundApprovalUrl: string;
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  userName: string;
  amountCents: number;
  currency: string;
  method: string;
  status: string;
  description: string | null;
  externalId: string | null;
  pixData: unknown;
  boletoData: unknown;
  bankTransferData: unknown;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  metadata: unknown;
}

export async function getAdminPayments(opts: {
  status?: string;
  limit?: number;
}): Promise<AdminPaymentRow[]> {
  const { status, limit = 100 } = opts;

  const rows = await db
    .select({
      id:               subscriptionPaymentsTable.id,
      workspaceId:      subscriptionPaymentsTable.workspaceId,
      workspaceName:    workspacesTable.name,
      email:            usersTable.email,
      userName:         usersTable.name,
      amountCents:      subscriptionPaymentsTable.amountCents,
      currency:         subscriptionPaymentsTable.currency,
      method:           subscriptionPaymentsTable.method,
      status:           subscriptionPaymentsTable.status,
      description:      subscriptionPaymentsTable.description,
      externalId:       subscriptionPaymentsTable.externalId,
      pixData:          subscriptionPaymentsTable.pixData,
      boletoData:       subscriptionPaymentsTable.boletoData,
      bankTransferData: subscriptionPaymentsTable.bankTransferData,
      createdAt:        subscriptionPaymentsTable.createdAt,
      paidAt:           subscriptionPaymentsTable.paidAt,
      expiresAt:        subscriptionPaymentsTable.expiresAt,
      metadata:         subscriptionPaymentsTable.metadata,
    })
    .from(subscriptionPaymentsTable)
    .innerJoin(workspacesTable, eq(subscriptionPaymentsTable.workspaceId, workspacesTable.id))
    .innerJoin(usersTable, eq(workspacesTable.ownerId, usersTable.id))
    .where(status ? eq(subscriptionPaymentsTable.status, status as any) : undefined)
    .orderBy(desc(subscriptionPaymentsTable.createdAt))
    .limit(limit);

  return rows.map(r => ({
    id:               r.id,
    workspaceId:      r.workspaceId,
    workspaceName:    r.workspaceName,
    email:            r.email,
    userName:         r.userName,
    amountCents:      r.amountCents,
    currency:         r.currency,
    method:           r.method,
    status:           r.status,
    description:      r.description,
    externalId:       r.externalId,
    pixData:          r.pixData,
    boletoData:       r.boletoData,
    bankTransferData: r.bankTransferData,
    createdAt:        r.createdAt.toISOString(),
    paidAt:           r.paidAt?.toISOString() ?? null,
    expiresAt:        r.expiresAt?.toISOString() ?? null,
    metadata:         r.metadata,
    refundApprovalUrl: process.env.ASAAS_ENV === "production" ? "https://www.asaas.com" : "https://sandbox.asaas.com",
  }));
}

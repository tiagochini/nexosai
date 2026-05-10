import { db } from "@workspace/db";
import { workspacesTable, usersTable, campaignsTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { getRevenueSummary } from "../revenue/revenue.service.js";
import { getBalance } from "../credits/credits.service.js";

const log = logger.child({ component: "weekly-report" });

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getHealthScore(activeCampaigns: number, activeSequences: number): number {
  return Math.min(100, 40 + activeCampaigns * 12 + activeSequences * 8);
}

function buildEmailHtml(data: {
  name: string;
  weekNum: number;
  revenue: number;
  sales: number;
  activeCampaigns: number;
  creditsBalance: number;
  healthScore: number;
  insight: string;
}): string {
  const revenueFormatted = data.revenue > 0
    ? `R$ ${(data.revenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
    : "—";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Relatório Semanal NexOS AI</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:monospace;color:#e2e8f0;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="border:1px solid #1e293b;padding:24px;margin-bottom:16px;">
      <div style="color:#6366f1;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">
        ● NEXOS AI · RELATÓRIO SEMANAL
      </div>
      <h1 style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;text-transform:uppercase;">
        Semana ${data.weekNum} · Performance Semanal
      </h1>
      <p style="color:#64748b;font-size:12px;margin:8px 0 0;">
        Olá${data.name ? `, ${data.name.split(" ")[0]}` : ""}! Aqui está o resumo da sua semana no NexOS AI.
      </p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div style="border:1px solid #1e293b;padding:16px;">
        <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Receita Esta Semana</div>
        <div style="font-size:24px;font-weight:700;color:${data.revenue > 0 ? "#22c55e" : "#e2e8f0"};">${revenueFormatted}</div>
      </div>
      <div style="border:1px solid #1e293b;padding:16px;">
        <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Vendas</div>
        <div style="font-size:24px;font-weight:700;color:#6366f1;">${data.sales > 0 ? data.sales : "—"}</div>
      </div>
      <div style="border:1px solid #1e293b;padding:16px;">
        <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Campanhas Ativas</div>
        <div style="font-size:24px;font-weight:700;color:#06b6d4;">${data.activeCampaigns}</div>
      </div>
      <div style="border:1px solid #1e293b;padding:16px;">
        <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Créditos IA</div>
        <div style="font-size:24px;font-weight:700;color:#e2e8f0;">${data.creditsBalance.toLocaleString("pt-BR")}</div>
      </div>
    </div>

    <div style="border:1px solid #1e293b;padding:16px;margin-bottom:16px;">
      <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">Health Score</div>
      <div style="background:#1e293b;height:4px;margin-bottom:4px;">
        <div style="background:#6366f1;height:4px;width:${data.healthScore}%;"></div>
      </div>
      <div style="font-size:11px;color:#64748b;">${data.healthScore}/100</div>
    </div>

    <div style="border:1px solid #334155;background:#0f172a;padding:16px;margin-bottom:24px;">
      <div style="color:#6366f1;font-size:9px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">Insight da IA</div>
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">${data.insight}</p>
    </div>

    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://nexos.ai/revenue"
         style="display:inline-block;background:#6366f1;color:#fff;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;padding:12px 32px;text-decoration:none;font-weight:700;">
        VER DASHBOARD COMPLETO →
      </a>
    </div>

    <div style="border-top:1px solid #1e293b;padding-top:16px;text-align:center;">
      <p style="color:#334155;font-size:10px;margin:0;">NexOS AI · Automated Launch Platform</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendWeeklyReport(workspaceId: string): Promise<void> {
  try {
    const workspace = await db.query.workspacesTable.findFirst({
      where: eq(workspacesTable.id, workspaceId),
    });
    if (!workspace) return;

    const owner = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, workspace.ownerId),
    });
    if (!owner?.email) return;

    const weekNum = getISOWeek(new Date());

    const activeCampaignRows = await db
      .select({ count: count() })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.workspaceId, workspaceId),
          eq(campaignsTable.status, "live"),
        ),
      );
    const activeCampaigns = Number(activeCampaignRows[0]?.count ?? 0);

    const creditsBalance = await getBalance(workspaceId);

    let revenue = 0;
    let sales = 0;
    try {
      const revData = await getRevenueSummary(workspaceId);
      revenue = Math.round((revData.totalGross ?? 0) * 0.35);
      sales   = Math.round((revData.totalSales  ?? 0) * 0.3);
    } catch {
      // Revenue optional — don't block report
    }

    const healthScore = getHealthScore(activeCampaigns, 0);
    const insight =
      activeCampaigns === 0
        ? "Nenhuma campanha ao vivo esta semana. Considere retomar uma campanha pausada ou iniciar uma nova missão."
        : revenue > 0
          ? `Receita positiva esta semana com ${activeCampaigns} campanha${activeCampaigns > 1 ? "s" : ""} ativa${activeCampaigns > 1 ? "s" : ""}. Continue aquecendo sua lista para o próximo fechamento.`
          : `${activeCampaigns} campanha${activeCampaigns > 1 ? "s" : ""} ativa${activeCampaigns > 1 ? "s" : ""} em execução. Configure webhooks de receita para rastrear conversões automaticamente.`;

    const html = buildEmailHtml({
      name: owner.name ?? "",
      weekNum,
      revenue,
      sales,
      activeCampaigns,
      creditsBalance,
      healthScore,
      insight,
    });

    log.info({ workspaceId, to: owner.email, weekNum }, "Weekly report composed — mock send (configure SMTP to enable delivery)");
    log.debug({ preview: html.substring(0, 200) }, "Weekly report HTML preview");
  } catch (err) {
    log.error({ err, workspaceId }, "Failed to send weekly report");
  }
}

export async function sendWeeklyReportsToAll(): Promise<void> {
  const workspaces = await db.select({ id: workspacesTable.id }).from(workspacesTable);
  log.info({ count: workspaces.length }, "Sending weekly reports to all workspaces");
  for (const ws of workspaces) {
    await sendWeeklyReport(ws.id);
  }
}

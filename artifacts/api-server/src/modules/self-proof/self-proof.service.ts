/**
 * Self-Proof Engine
 *
 * NexOS proves its own methodology by capturing real platform aggregate metrics
 * and generating live case study data. The platform that launches itself.
 */
import { db } from "@workspace/db";
import {
  campaignsTable,
  workspacesTable,
  aiProviderLogsTable,
  campaignAgentsTable,
  revenueEventsTable,
} from "@workspace/db";
import { count, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export interface PlatformStats {
  totalCampaigns: number;
  completedCampaigns: number;
  totalWorkspaces: number;
  totalAgentRuns: number;
  completedAgentRuns: number;
  agentSuccessRate: number;
  totalRevenueBrl: number;
  avgRevenuePerCampaign: number;
  totalAiCostUsd: number;
  totalAiTokens: number;
  liveCampaigns: number;
  generatedAt: string;
}

export interface ProofCase {
  id: string;
  title: string;
  metric: string;
  value: string;
  detail: string;
  category: "revenue" | "execution" | "automation" | "speed";
}

// Static showcase cases from NexOS own launch execution
const STATIC_CASES: ProofCase[] = [
  {
    id: "nexos-self-launch-001",
    title: "NexOS lança a si mesmo",
    metric: "Lançamento de plataforma",
    value: "R$3.990 → acesso vitalício",
    detail: "Copy de vendas, sequência de 18 dias, VSL script, 64 agentes — executado com o próprio NexOS. Zero agência contratada.",
    category: "execution",
  },
  {
    id: "nexos-copy-speed",
    title: "Velocidade de produção",
    metric: "Tempo médio de copy completa",
    value: "< 4 minutos",
    detail: "Do briefing ao copy completo (landing + email sequence + VSL script + WhatsApp): 4 minutos com agentes em paralelo.",
    category: "speed",
  },
  {
    id: "nexos-automation-depth",
    title: "Automação de funil",
    metric: "Etapas executadas autonomamente",
    value: "22 etapas",
    detail: "Estratégia → copy → compliance → sequência → disparo → segmentação → remarketing → relatório pós-lançamento. Sem intervenção manual entre etapas.",
    category: "automation",
  },
  {
    id: "nexos-agent-coverage",
    title: "Cobertura de agentes",
    metric: "Especialistas por lançamento",
    value: "64 agentes",
    detail: "Cada agente mapeado para uma função específica do time de lançamento: copy, estratégia, mídia, compliance, atendimento, vídeo, analytics.",
    category: "execution",
  },
];

export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    const [
      campaignCounts,
      workspaceCount,
      agentCounts,
      revenueSums,
      aiCosts,
    ] = await Promise.all([
      db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where status = 'completed')`,
          live: sql<number>`count(*) filter (where status = 'live')`,
        })
        .from(campaignsTable),

      db.select({ total: count() }).from(workspacesTable),

      db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where status = 'completed')`,
        })
        .from(campaignAgentsTable),

      db
        .select({
          totalBrl: sql<string>`coalesce(sum(amount_brl), 0)`,
        })
        .from(revenueEventsTable),

      db
        .select({
          totalCostUsd: sql<string>`coalesce(sum(cost_usd::numeric), 0)`,
          totalTokens: sql<string>`coalesce(sum(total_tokens), 0)`,
        })
        .from(aiProviderLogsTable),
    ]);

    const totalCampaigns = Number(campaignCounts[0]?.total ?? 0);
    const completedCampaigns = Number(campaignCounts[0]?.completed ?? 0);
    const liveCampaigns = Number(campaignCounts[0]?.live ?? 0);
    const totalWorkspaces = Number(workspaceCount[0]?.total ?? 0);
    const totalAgentRuns = Number(agentCounts[0]?.total ?? 0);
    const completedAgentRuns = Number(agentCounts[0]?.completed ?? 0);
    const agentSuccessRate = totalAgentRuns > 0
      ? Math.round((completedAgentRuns / totalAgentRuns) * 100)
      : 0;
    const totalRevenueBrl = Number(revenueSums[0]?.totalBrl ?? 0);
    const avgRevenuePerCampaign = completedCampaigns > 0
      ? Math.round(totalRevenueBrl / completedCampaigns)
      : 0;
    const totalAiCostUsd = Number(aiCosts[0]?.totalCostUsd ?? 0);
    const totalAiTokens = Number(aiCosts[0]?.totalTokens ?? 0);

    return {
      totalCampaigns,
      completedCampaigns,
      totalWorkspaces,
      totalAgentRuns,
      completedAgentRuns,
      agentSuccessRate,
      totalRevenueBrl,
      avgRevenuePerCampaign,
      totalAiCostUsd,
      totalAiTokens,
      liveCampaigns,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error({ err }, "[SELF_PROOF] Failed to get platform stats");
    return {
      totalCampaigns: 0,
      completedCampaigns: 0,
      totalWorkspaces: 0,
      totalAgentRuns: 0,
      completedAgentRuns: 0,
      agentSuccessRate: 0,
      totalRevenueBrl: 0,
      avgRevenuePerCampaign: 0,
      totalAiCostUsd: 0,
      totalAiTokens: 0,
      liveCampaigns: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}

export function getProofCases(): ProofCase[] {
  return STATIC_CASES;
}

export function buildLiveProofCases(stats: PlatformStats): ProofCase[] {
  const live: ProofCase[] = [];

  if (stats.totalCampaigns > 0) {
    live.push({
      id: "live-campaigns",
      title: "Campanhas criadas na plataforma",
      metric: "Total de campanhas",
      value: stats.totalCampaigns.toLocaleString("pt-BR"),
      detail: `${stats.completedCampaigns} concluídas · ${stats.liveCampaigns} ao vivo agora.`,
      category: "execution",
    });
  }

  if (stats.totalAgentRuns > 0) {
    live.push({
      id: "live-agents",
      title: "Execuções de agentes",
      metric: "Taxa de sucesso",
      value: `${stats.agentSuccessRate}%`,
      detail: `${stats.completedAgentRuns.toLocaleString("pt-BR")} de ${stats.totalAgentRuns.toLocaleString("pt-BR")} agentes completados com sucesso.`,
      category: "automation",
    });
  }

  if (stats.totalRevenueBrl > 0) {
    live.push({
      id: "live-revenue",
      title: "Receita gerada via plataforma",
      metric: "Total rastreado",
      value: `R$${stats.totalRevenueBrl.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
      detail: "Receita capturada de webhooks de venda (Hotmart, Kiwify, Stripe) vinculados a campanhas NexOS.",
      category: "revenue",
    });
  }

  return [...STATIC_CASES, ...live];
}

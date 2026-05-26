/**
 * Cross-Campaign Intelligence Service — NEXOS AI
 *
 * Extrai padrões de campanhas passadas do mesmo workspace e injeta como
 * inteligência histórica no contexto de novos agentes.
 *
 * Esta é a diferença entre um agente que começa do zero e um especialista
 * que aprende com cada lançamento anterior:
 *
 * - Hooks que venceram (para amplificar padrões de estilo)
 * - Hooks que falharam (para não repetir)
 * - Avatar patterns que geraram identificação real
 * - Avisos estratégicos que foram ignorados e prejudicaram performance
 * - Frameworks PLF que funcionaram para este nicho/workspace
 * - Decisões humanas aprovadas / rejeitadas (memória viva)
 * - Memória de padrões aprovados por agente (workspaceMemoryTable)
 * - Vertical learnings (aggregate niche intelligence cross-workspace)
 *
 * INTEGRAÇÃO:
 *   - Chamado em command.agent.ts no início do pipeline, ANTES do Profile Builder
 *   - Resultado é prepended ao memoryContext para enriquecer TODOS os agentes
 *   - Nunca bloqueia — sempre retorna string (vazia se falhar)
 */

import { eq, and, desc, not, inArray } from "drizzle-orm";
import {
  db,
  campaignsTable,
  workspaceMemoryTable,
} from "@workspace/db";
import {
  getVerticalLearnings,
  formatVerticalMemoryContext,
  deriveVerticalKey,
} from "../campaign-brain/vertical-memory.service.js";
import type { CampaignMemory } from "./campaign-memory.service.js";
import type { Logger } from "pino";

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_PAST_CAMPAIGNS = 5;
const MIN_HEALTH_SCORE_WINNER = 55;

// ── Types ──────────────────────────────────────────────────────────────────────

interface CampaignIntelligenceSummary {
  title: string;
  type: string;
  track: string;
  healthScore?: number;
  winningHooks: string[];
  weakHooks: string[];
  avatar: string;
  bigDomino: string;
  uniqueMechanism: string;
  dominantTrigger: string;
  winningTone: string;
  doctrinePrimaryFramework?: string;
  doctrineLaunchLogic: string[];
  coreWarnings: string[];
  learnings: string[];
  approvedDecisions: string[];
  rejectedDecisions: string[];
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Builds a comprehensive cross-campaign intelligence block for the current workspace.
 *
 * Combines:
 * 1. Past completed/live campaigns — memory patterns (hooks, avatars, doctrine, warnings)
 * 2. Vertical memory — aggregate niche learnings across workspaces
 * 3. Workspace-level approved/rejected patterns (workspaceMemoryTable)
 *
 * Returns an injectable markdown block ready for memoryContext prepend.
 * Always safe to call — returns empty string on any error.
 */
export async function buildCrossCampaignIntelligence(
  workspaceId: string,
  currentCampaignId: string | null | undefined,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<string> {
  try {
    const [pastSummaries, verticalBlock, workspaceMemBlock] = await Promise.all([
      extractPastCampaignPatterns(workspaceId, currentCampaignId, log),
      buildVerticalBlock(workspaceId, intakeData, log),
      buildWorkspaceMemoryBlock(workspaceId, log),
    ]);

    // First campaign — no historical intelligence yet
    if (pastSummaries.length === 0 && !verticalBlock && !workspaceMemBlock) {
      return "";
    }

    const sections: string[] = [
      "## INTELIGÊNCIA HISTÓRICA DO WORKSPACE",
      "",
      "> Este workspace já executou campanhas anteriores.",
      "> Leia abaixo os padrões extraídos — o que funcionou, o que falhou,",
      "> quais avisos foram ignorados e quais decisões foram aprovadas.",
      "> Use isso como ponto de partida, não como limitação.",
      "",
    ];

    // ── Past campaigns block ───────────────────────────────────────────────────
    if (pastSummaries.length > 0) {
      sections.push("### CAMPANHAS ANTERIORES — PADRÕES EXTRAÍDOS");
      sections.push("");

      const winners = pastSummaries.filter(c => (c.healthScore ?? 0) >= MIN_HEALTH_SCORE_WINNER);
      const weaker  = pastSummaries.filter(c => (c.healthScore ?? 0) > 0 && (c.healthScore ?? 0) < MIN_HEALTH_SCORE_WINNER);
      const noScore = pastSummaries.filter(c => !c.healthScore);

      // High-performing campaigns
      if (winners.length > 0) {
        sections.push("#### O QUE FUNCIONOU (performance ≥55/100):");
        sections.push("");
        for (const c of winners.slice(0, 3)) {
          sections.push(`**Campanha: "${c.title}"** — ${c.type} / ${c.track}${c.healthScore ? ` / score ${c.healthScore}/100` : ""}`);
          if (c.avatar)           sections.push(`- Avatar: ${c.avatar}`);
          if (c.bigDomino)        sections.push(`- Big Domino: ${c.bigDomino}`);
          if (c.uniqueMechanism)  sections.push(`- Mecanismo único: ${c.uniqueMechanism}`);
          if (c.dominantTrigger)  sections.push(`- Gatilho dominante: ${c.dominantTrigger}`);
          if (c.winningTone)      sections.push(`- Tom vencedor: ${c.winningTone}`);
          if (c.doctrinePrimaryFramework) sections.push(`- Framework PLF: ${c.doctrinePrimaryFramework}`);
          if (c.doctrineLaunchLogic.length > 0) {
            sections.push(`- Lógica de lançamento que funcionou:`);
            c.doctrineLaunchLogic.slice(0, 3).forEach(l => sections.push(`  → ${l}`));
          }
          if (c.winningHooks.length > 0) {
            sections.push(`- Hooks vencedores:`);
            c.winningHooks.slice(0, 4).forEach(h => sections.push(`  🏆 "${h}"`));
          }
          if (c.learnings.length > 0) {
            sections.push(`- Aprendizados:`);
            c.learnings.slice(0, 3).forEach(l => sections.push(`  💡 ${l}`));
          }
          if (c.approvedDecisions.length > 0) {
            sections.push(`- Decisões humanas aprovadas (não contradizer):`);
            c.approvedDecisions.slice(0, 3).forEach(d => sections.push(`  ✅ ${d}`));
          }
          sections.push("");
        }
      }

      // Under-performing campaigns
      if (weaker.length > 0) {
        sections.push("#### O QUE NÃO FUNCIONOU (performance <55/100):");
        sections.push("");
        for (const c of weaker.slice(0, 2)) {
          sections.push(`**"${c.title}"** — score: ${c.healthScore}/100`);
          if (c.coreWarnings.length > 0) {
            sections.push(`- Avisos estratégicos não atendidos:`);
            c.coreWarnings.slice(0, 3).forEach(w => sections.push(`  ⚠️ ${w}`));
          }
          if (c.weakHooks.length > 0) {
            sections.push(`- Hooks fracos (evitar padrões similares):`);
            c.weakHooks.slice(0, 2).forEach(h => sections.push(`  📉 "${h}"`));
          }
          if (c.rejectedDecisions.length > 0) {
            sections.push(`- Decisões humanas rejeitadas (não repetir):`);
            c.rejectedDecisions.slice(0, 2).forEach(d => sections.push(`  ❌ ${d}`));
          }
          sections.push("");
        }
      }

      // No-score campaigns (recent, memory-only)
      if (noScore.length > 0 && winners.length === 0) {
        sections.push("#### CAMPANHAS RECENTES (sem score de performance ainda):");
        sections.push("");
        for (const c of noScore.slice(0, 2)) {
          sections.push(`**"${c.title}"** — ${c.type}`);
          if (c.avatar)           sections.push(`- Avatar definido: ${c.avatar.slice(0, 120)}`);
          if (c.bigDomino)        sections.push(`- Big Domino: ${c.bigDomino}`);
          if (c.dominantTrigger)  sections.push(`- Gatilho: ${c.dominantTrigger}`);
          if (c.approvedDecisions.length > 0) {
            c.approvedDecisions.slice(0, 2).forEach(d => sections.push(`  ✅ ${d}`));
          }
          sections.push("");
        }
      }

      // Cross-campaign meta patterns
      const allTriggers = pastSummaries.map(c => c.dominantTrigger).filter(Boolean);
      const allWarnings = [...new Set(pastSummaries.flatMap(c => c.coreWarnings))];
      const allWinningHooks = pastSummaries.flatMap(c => c.winningHooks);

      if (allTriggers.length >= 2 || allWarnings.length > 0) {
        sections.push("#### PADRÕES TRANSVERSAIS (todas as campanhas deste workspace):");
        sections.push("");

        if (allTriggers.length >= 2) {
          const counts = countOccurrences(allTriggers);
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          if (sorted[0]) {
            sections.push(`- Gatilho mais aplicado historicamente: **${sorted[0][0]}** (${sorted[0][1]}x)`);
          }
          if (sorted[1]) {
            sections.push(`- Segundo gatilho mais comum: **${sorted[1][0]}** (${sorted[1][1]}x)`);
          }
        }

        if (allWarnings.length > 0) {
          sections.push(`- Avisos recorrentes que impactaram performance:`);
          allWarnings.slice(0, 4).forEach(w => sections.push(`  ⚠️ ${w}`));
        }

        if (allWinningHooks.length >= 3) {
          sections.push(`- Banco de hooks vencedores deste workspace (${allWinningHooks.length} total):`);
          allWinningHooks.slice(0, 3).forEach(h => sections.push(`  🏆 "${h}"`));
        }

        sections.push("");
      }
    }

    // ── Vertical block ─────────────────────────────────────────────────────────
    if (verticalBlock) {
      sections.push(verticalBlock);
      sections.push("");
    }

    // ── Workspace memory block ─────────────────────────────────────────────────
    if (workspaceMemBlock) {
      sections.push(workspaceMemBlock);
      sections.push("");
    }

    sections.push("---");
    sections.push("");

    return sections.join("\n");
  } catch (err) {
    log.warn({ err }, "Cross-campaign intelligence build failed (non-fatal — continuing without historical context)");
    return "";
  }
}

// ── Past campaign extraction ───────────────────────────────────────────────────

async function extractPastCampaignPatterns(
  workspaceId: string,
  currentCampaignId: string | null | undefined,
  log: Logger,
): Promise<CampaignIntelligenceSummary[]> {
  const conditions = [
    eq(campaignsTable.workspaceId, workspaceId),
    inArray(campaignsTable.status, ["completed", "live", "paused"] as any[]),
  ];

  if (currentCampaignId) {
    conditions.push(not(eq(campaignsTable.id, currentCampaignId)));
  }

  const rows = await db
    .select({
      id:         campaignsTable.id,
      title:      campaignsTable.title,
      type:       campaignsTable.type,
      track:      campaignsTable.track,
      memoryData: campaignsTable.memoryData,
    })
    .from(campaignsTable)
    .where(and(...conditions))
    .orderBy(desc(campaignsTable.updatedAt))
    .limit(MAX_PAST_CAMPAIGNS);

  const summaries: CampaignIntelligenceSummary[] = [];

  for (const row of rows) {
    try {
      const raw = row.memoryData as Record<string, unknown> | null;
      if (!raw || !raw["version"]) continue;

      const mem = raw as unknown as CampaignMemory;

      // Extract health score from historicalMetrics entries
      let healthScore: number | undefined;
      for (const entry of (mem.historicalMetrics ?? []).slice(-8)) {
        const match = entry.content.match(/health[_\s]?score[:\s]+(\d+)/i);
        if (match?.[1]) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed)) { healthScore = parsed; break; }
        }
      }

      summaries.push({
        title: row.title,
        type:  row.type,
        track: row.track,
        healthScore,
        winningHooks: (mem.winningHooks ?? []).slice(0, 5).map(h => h.content),
        weakHooks:    (mem.weakHooks ?? []).slice(0, 3).map(h => h.content),
        avatar:        mem.avatar?.description ?? "",
        bigDomino:     mem.bigDomino ?? "",
        uniqueMechanism: mem.uniqueMechanism ?? "",
        dominantTrigger: mem.dominantTrigger ?? "",
        winningTone:   mem.tone ?? "",
        doctrinePrimaryFramework: mem.doctrine?.primaryFramework,
        doctrineLaunchLogic:      mem.doctrine?.launchLogic?.slice(0, 4) ?? [],
        coreWarnings:  (mem.coreWarnings ?? []).slice(0, 5),
        learnings:     (mem.campaignLearnings ?? []).slice(-5).map(l => l.content),
        approvedDecisions: (mem.approvedDecisions ?? []).slice(-5).map(d => d.content),
        rejectedDecisions: (mem.rejectedDecisions ?? []).slice(-4).map(d => d.content),
      });
    } catch (err) {
      log.warn({ err, campaignId: row.id }, "Cross-campaign: failed to extract from past campaign (skipping)");
    }
  }

  return summaries;
}

// ── Vertical intelligence block ────────────────────────────────────────────────

async function buildVerticalBlock(
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<string> {
  try {
    const verticalKey = deriveVerticalKey(intakeData);
    const data = await getVerticalLearnings(verticalKey, workspaceId);
    if (!data || data.campaignCount < 1) return "";
    return formatVerticalMemoryContext(data, verticalKey);
  } catch (err) {
    log.warn({ err }, "Cross-campaign: vertical learnings unavailable (non-fatal)");
    return "";
  }
}

// ── Workspace memory block ─────────────────────────────────────────────────────

async function buildWorkspaceMemoryBlock(
  workspaceId: string,
  log: Logger,
): Promise<string> {
  try {
    const patterns = await db
      .select({
        memoryType:  workspaceMemoryTable.memoryType,
        agentRole:   workspaceMemoryTable.agentRole,
        title:       workspaceMemoryTable.title,
        summary:     workspaceMemoryTable.summary,
        qualityScore: workspaceMemoryTable.qualityScore,
        isNegative:  workspaceMemoryTable.isNegative,
      })
      .from(workspaceMemoryTable)
      .where(
        and(
          eq(workspaceMemoryTable.workspaceId, workspaceId),
          eq(workspaceMemoryTable.isPublicReference, false),
        ),
      )
      .orderBy(desc(workspaceMemoryTable.qualityScore), desc(workspaceMemoryTable.usageCount))
      .limit(12);

    if (patterns.length === 0) return "";

    const approved = patterns.filter(p => !p.isNegative);
    const rejected = patterns.filter(p => p.isNegative);

    if (approved.length === 0 && rejected.length === 0) return "";

    const lines: string[] = [
      "### MEMÓRIA DE PADRÕES APROVADOS POR AGENTE",
      "",
    ];

    if (approved.length > 0) {
      lines.push("**Padrões aprovados pelo cliente (use como referência de estilo e estrutura):**");
      for (const p of approved.slice(0, 7)) {
        const score = p.qualityScore ? ` [qualidade: ${Math.round(p.qualityScore)}/100]` : "";
        lines.push(`✅ **${p.title}**${score} _(${p.agentRole})_: ${p.summary}`);
      }
      lines.push("");
    }

    if (rejected.length > 0) {
      lines.push("**Padrões rejeitados pelo cliente (não repita esses estilos ou abordagens):**");
      for (const p of rejected.slice(0, 4)) {
        lines.push(`❌ **${p.title}** _(${p.agentRole})_: ${p.summary}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  } catch (err) {
    log.warn({ err }, "Cross-campaign: workspace memory block unavailable (non-fatal)");
    return "";
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function countOccurrences(arr: string[]): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, item) => {
    if (item) acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

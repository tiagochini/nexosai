/**
 * Memory Compression Engine
 *
 * Prevents campaign memory from becoming inflated, redundant, or irrelevant.
 * Runs fire-and-forget after the strategy pipeline completes.
 * Also runs on-demand when entry count exceeds the threshold.
 *
 * Segments memory into: ACTIVE / STRATEGIC / HISTORICAL / EXPIRED
 * Compresses old entries while preserving critical decisions and identity.
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import {
  getCampaignMemory,
  assembleCampaignContext,
  type CampaignMemory,
  type MemoryEntry,
} from "./campaign-memory.service.js";
import { db, campaignsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Logger } from "pino";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemorySegment = "active" | "strategic" | "historical" | "expired";

export interface MemoryEntryScore {
  entryId?: string;
  category: string;
  source: string;
  segment: MemorySegment;
  freshnessScore: number;       // 0-1 (recent = high)
  strategicRelevance: number;   // 0-1
  recurrenceScore: number;      // 0-1 (mentioned multiple times = high)
  performanceImpact: number;    // 0-1
  operationalImportance: number;// 0-1
  overallScore: number;         // weighted composite
  shouldKeep: boolean;
  compressTo?: string;          // compressed summary if kept but shrunk
}

export interface CompressionResult {
  activeMemorySummary: string;
  archivedMemory: string[];
  removedMemory: string[];
  preservedCritical: string[];
  relevanceScore: number;       // 0-1 overall memory quality after compression
  compressionRatio: number;     // e.g. 0.6 = 60% reduction
  memoryHealth: "excellent" | "good" | "degraded" | "critical";
  contextRecommendation: string;
  entryScores: MemoryEntryScore[];
  totalEntriesBefore: number;
  totalEntriesAfter: number;
  confidenceScore: number;
}

// ── Compression threshold ─────────────────────────────────────────────────────

export const COMPRESSION_ENTRY_THRESHOLD = 20; // compress when entries exceed this

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildCompressionSystemPrompt(): string {
  const fence = "```";
  return (
    `Você é o NEXOS Memory Compression Engine.\n` +
    `Sua função é manter a memória da campanha enxuta, relevante e de alta qualidade.\n` +
    `\n` +
    `## SEGMENTOS DE MEMÓRIA\n` +
    `\n` +
    `**ACTIVE** — Contexto crítico atual. Injetado em TODOS os agentes downstream.\n` +
    `Preservar: produto, avatar, narrativa central, dores, desejos, tom, promessas proibidas, regras de compliance.\n` +
    `\n` +
    `**STRATEGIC** — Aprendizados persistentes que informam decisões futuras.\n` +
    `Preservar: padrões vencedores, hooks aprovados, decisões humanas (aprovadas E rejeitadas).\n` +
    `\n` +
    `**HISTORICAL** — Arquivado para consulta futura. Não injetado ativamente.\n` +
    `Mover aqui: resumos de execuções antigas, outputs de agentes específicos, dados de performance.\n` +
    `\n` +
    `**EXPIRED** — Sem relevância operacional. Pode ser removido.\n` +
    `Remover: duplicações, outputs idênticos, contexto de versões antigas sobrescritas.\n` +
    `\n` +
    `## REGRAS DE SCORING\n` +
    `\n` +
    `Avalie cada entrada com:\n` +
    `- freshnessScore: mais recente = maior (entradas de hoje = 1.0, 30+ dias = 0.1)\n` +
    `- strategicRelevance: identidade da marca, narrativa central, compliance = 1.0\n` +
    `- recurrenceScore: citado por múltiplos agentes = alto\n` +
    `- performanceImpact: afeta diretamente conversão/resultado = alto\n` +
    `- operationalImportance: necessário para próxima execução = alto\n` +
    `\n` +
    `## O QUE NUNCA REMOVER\n` +
    `- Decisões humanas críticas (aprovadas e rejeitadas)\n` +
    `- Restrições legais e compliance\n` +
    `- Identidade da marca (tom, voz, valores)\n` +
    `- prohibitedClaims (promessas proibidas)\n` +
    `- Padrões vencedores (hooks, ângulos que funcionaram)\n` +
    `- centralNarrative e keyPromise\n` +
    `\n` +
    `## COMPRESSÃO\n` +
    `- Consolide múltiplos outputs de um mesmo agente em 1 linha de summary\n` +
    `- Remova duplicações exatas\n` +
    `- Resuma dados de performance em 1-2 métricas-chave\n` +
    `- Histórico de erros → manter apenas o padrão, não cada instância\n` +
    `\n` +
    `**Retorne APENAS JSON válido:**\n` +
    fence + `json\n` +
    `{\n` +
    `  "activeMemorySummary": "string — contexto ativo consolidado",\n` +
    `  "archivedMemory": ["string"],\n` +
    `  "removedMemory": ["string — describe what was removed and why"],\n` +
    `  "preservedCritical": ["string — itens críticos que foram mantidos"],\n` +
    `  "relevanceScore": 0.9,\n` +
    `  "compressionRatio": 0.4,\n` +
    `  "memoryHealth": "excellent|good|degraded|critical",\n` +
    `  "contextRecommendation": "string",\n` +
    `  "entryScores": [\n` +
    `    {\n` +
    `      "category": "string",\n` +
    `      "source": "string",\n` +
    `      "segment": "active|strategic|historical|expired",\n` +
    `      "freshnessScore": 0.9,\n` +
    `      "strategicRelevance": 1.0,\n` +
    `      "recurrenceScore": 0.5,\n` +
    `      "performanceImpact": 0.7,\n` +
    `      "operationalImportance": 1.0,\n` +
    `      "overallScore": 0.88,\n` +
    `      "shouldKeep": true,\n` +
    `      "compressTo": null\n` +
    `    }\n` +
    `  ],\n` +
    `  "totalEntriesBefore": 0,\n` +
    `  "totalEntriesAfter": 0,\n` +
    `  "confidenceScore": 0.9\n` +
    `}\n` +
    fence
  );
}

// ── Runner ────────────────────────────────────────────────────────────────────

// ── Count all memory entries across all arrays ────────────────────────────────

function countMemoryEntries(memory: CampaignMemory): number {
  return (
    (memory.approvedDecisions?.length ?? 0) +
    (memory.rejectedDecisions?.length ?? 0) +
    (memory.approvedCreatives?.length ?? 0) +
    (memory.rejectedCreatives?.length ?? 0) +
    (memory.winningHooks?.length ?? 0) +
    (memory.weakHooks?.length ?? 0) +
    (memory.campaignLearnings?.length ?? 0) +
    (memory.historicalMetrics?.length ?? 0) +
    (memory.agentOutputSummaries?.length ?? 0)
  );
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runMemoryCompression(
  campaignId: string,
  workspaceId: string,
  log: Logger,
  force = false,
): Promise<CompressionResult | null> {
  const memory = await getCampaignMemory(campaignId, workspaceId);
  if (!memory) {
    log.warn({ campaignId }, "Memory compression: no memory found");
    return null;
  }

  const entryCount = countMemoryEntries(memory);

  // Skip if below threshold unless forced
  if (!force && entryCount < COMPRESSION_ENTRY_THRESHOLD) {
    log.info({ campaignId, entryCount, threshold: COMPRESSION_ENTRY_THRESHOLD }, "Memory compression: below threshold, skipping");
    return null;
  }

  log.info({ campaignId, entryCount, force }, "Memory compression: starting");

  const memoryContext = assembleCampaignContext(memory);

  // Build a combined sample of all entry arrays for analysis
  const allEntries = [
    ...(memory.approvedDecisions ?? []),
    ...(memory.rejectedDecisions ?? []),
    ...(memory.agentOutputSummaries ?? []),
    ...(memory.campaignLearnings ?? []),
    ...(memory.winningHooks ?? []),
    ...(memory.weakHooks ?? []),
    ...(memory.historicalMetrics ?? []),
  ].slice(-30); // last 30 entries across all categories

  const entriesSample = JSON.stringify(allEntries, null, 2);

  const userContent =
    `Analise e comprima a memória desta campanha.\n\n` +
    `**Total de entradas combinadas:** ${entryCount}\n` +
    `**Versão da memória:** ${memory.version}\n\n` +
    `**Distribuição:** aprovadas=${memory.approvedDecisions?.length ?? 0} rejeitadas=${memory.rejectedDecisions?.length ?? 0} criativos=${memory.approvedCreatives?.length ?? 0} hooks=${(memory.winningHooks?.length ?? 0) + (memory.weakHooks?.length ?? 0)} aprendizados=${memory.campaignLearnings?.length ?? 0} métricas=${memory.historicalMetrics?.length ?? 0} outputs=${memory.agentOutputSummaries?.length ?? 0}\n\n` +
    `**Contexto atual:**\n${memoryContext}\n\n` +
    `**Entradas (amostra últimas 30):**\n\`\`\`json\n${entriesSample}\n\`\`\`\n\n` +
    `Classifique cada entrada, identifique redundâncias e produza o resultado da compressão.`;

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "memory_compression",
    systemPrompt: buildCompressionSystemPrompt(),
    messages: [{ role: "user", content: userContent }],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Analisando entradas de memória...",
      "Identificando redundâncias e contexto obsoleto...",
      "Comprimindo e reorganizando memória...",
    ],
  });

  const defaultResult: CompressionResult = {
    activeMemorySummary: "Memória ativa preservada sem alterações",
    archivedMemory: [],
    removedMemory: [],
    preservedCritical: [],
    relevanceScore: 0.7,
    compressionRatio: 0,
    memoryHealth: "good",
    contextRecommendation: "Memória em estado aceitável",
    entryScores: [],
    totalEntriesBefore: entryCount,
    totalEntriesAfter: entryCount,
    confidenceScore: 0.7,
  };

  const compressionResult = parseAgentJSON<CompressionResult>(result.content, defaultResult);

  // Persist a compression audit summary as an agent output in the memory
  try {
    const currentMemory = await getCampaignMemory(campaignId, workspaceId);
    if (currentMemory) {
      const compressionEntry: MemoryEntry = {
        id: `compression_${Date.now()}`,
        category: "agent_output_summary",
        content: `Compressão executada: ${entryCount} → ${compressionResult.totalEntriesAfter} entradas | ratio: ${Math.round(compressionResult.compressionRatio * 100)}% | saúde: ${compressionResult.memoryHealth} | relevância: ${compressionResult.relevanceScore}`,
        source: "memory_compression_engine",
        timestamp: new Date().toISOString(),
        metadata: {
          compressionRatio: compressionResult.compressionRatio,
          memoryHealth: compressionResult.memoryHealth,
          relevanceScore: compressionResult.relevanceScore,
          removedCount: compressionResult.removedMemory.length,
        },
      };

      const updatedMemory: CampaignMemory = {
        ...currentMemory,
        version: (currentMemory.version ?? 0) + 1,
        lastUpdated: new Date().toISOString(),
        agentOutputSummaries: [
          ...(currentMemory.agentOutputSummaries ?? []),
          compressionEntry,
        ],
      };

      await db
        .update(campaignsTable)
        .set({ memoryData: updatedMemory as any })
        .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));
    }
  } catch (persistErr) {
    log.warn({ persistErr, campaignId }, "Memory compression: failed to persist result");
  }

  log.info({
    campaignId,
    entriesBefore: compressionResult.totalEntriesBefore,
    entriesAfter: compressionResult.totalEntriesAfter,
    compressionRatio: compressionResult.compressionRatio,
    memoryHealth: compressionResult.memoryHealth,
    relevanceScore: compressionResult.relevanceScore,
  }, "Memory compression completed");

  return compressionResult;
}

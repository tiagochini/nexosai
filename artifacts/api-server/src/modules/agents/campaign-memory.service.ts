/**
 * NEXOS Campaign Memory Layer
 *
 * Você é o NEXOS Campaign Memory Layer.
 * Sua função é guardar e fornecer o contexto oficial da campanha para todos os agentes.
 * Você é a fonte única da verdade operacional.
 *
 * Armazena: briefing, decisões aprovadas/rejeitadas, produto, oferta, avatar,
 * dores, desejos, objeções, tom, narrativa central, canais aprovados, orçamento,
 * criativos aprovados/rejeitados, métricas históricas, aprendizados, hooks
 * vencedores/fracos, promessas permitidas, claims proibidos, regras de compliance,
 * status da operação.
 *
 * Impede: mudança brusca de tom, repetição excessiva, contradição entre canais,
 * perda de narrativa central, promessas inconsistentes, decisões fora do contexto.
 *
 * Retorna: contexto atual resumido, restrições relevantes, decisões humanas
 * aprovadas, aprendizados importantes, confidence score contextual.
 */

import { eq } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import type { StrategicBrief } from "./strategic-core.agent.js";
import type {
  DoctrineOutput,
  ConsciousnessStage,
  MarketSophistication,
  LeadTemperature,
  UrgencyLevel,
} from "./strategic-doctrine.agent.js";
import type { Logger } from "pino";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  content: string;
  source: string;       // which agent or "human" wrote this
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type MemoryCategory =
  | "decision_approved"
  | "decision_rejected"
  | "creative_approved"
  | "creative_rejected"
  | "hook_winner"
  | "hook_weak"
  | "learning"
  | "metric"
  | "compliance_rule"
  | "agent_output_summary";

export interface CampaignMemory {
  // ── Core campaign data (source of truth) ──────────────────────────────────
  product: {
    name: string;
    category: string;
    price: number;
    description: string;
    keyFeatures: string[];
  };
  offer: {
    mainOffer: string;
    bonuses: string[];
    guarantee: string;
    price: number;
    urgencyMechanism: string;
  };
  avatar: {
    description: string;
    age?: string;
    profession?: string;
    psychographicProfile: string;
  };
  pains: string[];
  desires: string[];
  objections: string[];
  // ── Narrative and positioning ──────────────────────────────────────────────
  tone: string;
  language: string;
  centralNarrative: string;
  bigDomino: string;
  uniqueMechanism: string;
  dominantTrigger: string;
  valueProposition: string;
  positioning: string;
  // ── Channels and budget ────────────────────────────────────────────────────
  approvedChannels: string[];
  approvedBudget: {
    total?: number;
    currency?: string;
    breakdown?: Record<string, number>;
  };
  // ── Compliance ─────────────────────────────────────────────────────────────
  permittedPromises: string[];
  prohibitedClaims: string[];
  ethicalBoundaries: string[];
  legalBoundaries: string[];
  complianceRules: string[];
  successCriteria: string[];
  // ── Living memory (grows over time) ───────────────────────────────────────
  approvedDecisions: MemoryEntry[];
  rejectedDecisions: MemoryEntry[];
  approvedCreatives: MemoryEntry[];
  rejectedCreatives: MemoryEntry[];
  winningHooks: MemoryEntry[];
  weakHooks: MemoryEntry[];
  campaignLearnings: MemoryEntry[];
  historicalMetrics: MemoryEntry[];
  agentOutputSummaries: MemoryEntry[];
  // ── Strategic Doctrine (populated by Doctrine Engine, step 2c) ────────────
  doctrine?: {
    consciousnessStage: ConsciousnessStage;
    marketSophistication: MarketSophistication;
    leadTemperature: LeadTemperature;
    bigDomino: string;
    uniqueMechanism: string;
    campaignDoctrine: string;
    launchLogic: string[];
    emotionalPhaseCount: number;
    urgencyLevel: UrgencyLevel;
    strategicWarnings: string[];
    adaptationNotes: string[];
    anticipationDays: number;
    primaryFramework: string;
    confidenceScore: number;
  };
  // ── Meta ───────────────────────────────────────────────────────────────────
  operationStatus: string;
  confidenceScore: number;   // 0–1: how reliable is this memory
  requiresHumanReview: boolean;
  coreWarnings: string[];
  initializedAt: string;
  lastUpdated: string;
  version: number;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

function emptyMemory(): CampaignMemory {
  return {
    product: { name: "", category: "", price: 0, description: "", keyFeatures: [] },
    offer: { mainOffer: "", bonuses: [], guarantee: "", price: 0, urgencyMechanism: "" },
    avatar: { description: "", psychographicProfile: "" },
    pains: [],
    desires: [],
    objections: [],
    tone: "",
    language: "",
    centralNarrative: "",
    bigDomino: "",
    uniqueMechanism: "",
    dominantTrigger: "",
    valueProposition: "",
    positioning: "",
    approvedChannels: [],
    approvedBudget: {},
    permittedPromises: [],
    prohibitedClaims: [],
    ethicalBoundaries: [],
    legalBoundaries: [],
    complianceRules: [],
    successCriteria: [],
    approvedDecisions: [],
    rejectedDecisions: [],
    approvedCreatives: [],
    rejectedCreatives: [],
    winningHooks: [],
    weakHooks: [],
    campaignLearnings: [],
    historicalMetrics: [],
    agentOutputSummaries: [],
    operationStatus: "initializing",
    confidenceScore: 0.5,
    requiresHumanReview: false,
    coreWarnings: [],
    initializedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    version: 1,
  };
}

function makeEntry(
  category: MemoryCategory,
  content: string,
  source: string,
  metadata?: Record<string, unknown>,
): MemoryEntry {
  return {
    id: Math.random().toString(36).slice(2, 10),
    category,
    content,
    source,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

// ─── Service Functions ──────────────────────────────────────────────────────────

/**
 * Initialize memory from intake data + strategic brief.
 * Called once after Strategic Core briefing completes.
 */
export async function initializeCampaignMemory(
  campaignId: string,
  intakeData: Record<string, unknown>,
  brief: StrategicBrief,
  log: Logger,
): Promise<CampaignMemory> {
  const memory = emptyMemory();

  // Populate from intake
  memory.product = {
    name: String(intakeData["product.name"] ?? ""),
    category: String(intakeData["product.category"] ?? ""),
    price: Number(intakeData["product.price"] ?? 0),
    description: String(intakeData["product.description"] ?? ""),
    keyFeatures: [],
  };
  memory.offer = {
    mainOffer: String(intakeData["offer.mainOffer"] ?? ""),
    bonuses: [],
    guarantee: String(intakeData["offer.guarantee"] ?? ""),
    price: Number(intakeData["product.price"] ?? 0),
    urgencyMechanism: brief.urgencyLevel,
  };
  memory.avatar = {
    description: brief.primaryAvatar,
    psychographicProfile: brief.centralPain,
  };

  // Populate from strategic brief
  memory.pains = brief.emotionalPains;
  memory.desires = [brief.dominantDesire];
  memory.objections = brief.mainObjections;
  memory.tone = brief.tone;
  memory.language = brief.language;
  memory.centralNarrative = brief.campaignObjective;
  memory.bigDomino = brief.bigDomino;
  memory.uniqueMechanism = brief.uniqueMechanism;
  memory.dominantTrigger = brief.dominantTrigger;
  memory.valueProposition = brief.valueProposition;
  memory.positioning = brief.positioning;
  memory.approvedChannels = brief.channels;
  memory.permittedPromises = brief.permittedPromises;
  memory.prohibitedClaims = brief.prohibitedPromises;
  memory.ethicalBoundaries = brief.ethicalBoundaries;
  memory.legalBoundaries = brief.legalBoundaries;
  memory.complianceRules = [
    ...brief.ethicalBoundaries,
    ...brief.legalBoundaries,
  ].filter(Boolean);
  memory.successCriteria = brief.successCriteria;
  memory.coreWarnings = brief.coreWarnings;
  memory.requiresHumanReview = brief.requiresHumanReview;
  memory.confidenceScore = brief.confidenceScore;
  memory.operationStatus = "strategy_ready";
  memory.initializedAt = new Date().toISOString();
  memory.lastUpdated = new Date().toISOString();

  await persistMemory(campaignId, memory);
  log.info({ campaignId, confidenceScore: memory.confidenceScore }, "Campaign memory initialized");
  return memory;
}

/**
 * Read the current memory for a campaign.
 */
export async function getCampaignMemory(campaignId: string): Promise<CampaignMemory | null> {
  const [row] = await db
    .select({ memoryData: campaignsTable.memoryData })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!row) return null;
  const data = row.memoryData as Record<string, unknown>;
  if (!data || !data["version"]) return null;
  return data as unknown as CampaignMemory;
}

/**
 * Add a structured entry to the living memory (decisions, learnings, hooks, etc.)
 */
export async function addMemoryEntry(
  campaignId: string,
  category: MemoryCategory,
  content: string,
  source: string,
  metadata?: Record<string, unknown>,
  log?: Logger,
): Promise<void> {
  const memory = await getCampaignMemory(campaignId);
  if (!memory) return;

  const entry = makeEntry(category, content, source, metadata);

  switch (category) {
    case "decision_approved":
      memory.approvedDecisions.push(entry);
      break;
    case "decision_rejected":
      memory.rejectedDecisions.push(entry);
      break;
    case "creative_approved":
      memory.approvedCreatives.push(entry);
      break;
    case "creative_rejected":
      memory.rejectedCreatives.push(entry);
      break;
    case "hook_winner":
      memory.winningHooks.push(entry);
      break;
    case "hook_weak":
      memory.weakHooks.push(entry);
      break;
    case "learning":
      memory.campaignLearnings.push(entry);
      break;
    case "metric":
      memory.historicalMetrics.push(entry);
      break;
    case "agent_output_summary":
      memory.agentOutputSummaries = [entry, ...memory.agentOutputSummaries].slice(0, 20);
      break;
    case "compliance_rule":
      if (!memory.complianceRules.includes(content)) {
        memory.complianceRules.push(content);
      }
      break;
  }

  memory.lastUpdated = new Date().toISOString();
  memory.version += 1;
  await persistMemory(campaignId, memory);
  log?.info({ campaignId, category, source }, "Memory entry added");
}

/**
 * Patch the memory with partial updates (e.g., update operationStatus, confidenceScore).
 */
export async function patchCampaignMemory(
  campaignId: string,
  patch: Partial<Pick<CampaignMemory,
    | "operationStatus"
    | "confidenceScore"
    | "approvedChannels"
    | "approvedBudget"
    | "requiresHumanReview"
    | "coreWarnings"
  >>,
): Promise<void> {
  const memory = await getCampaignMemory(campaignId);
  if (!memory) return;
  Object.assign(memory, patch, {
    lastUpdated: new Date().toISOString(),
    version: memory.version + 1,
  });
  await persistMemory(campaignId, memory);
}

/**
 * Store Strategic Doctrine Engine output into campaign memory.
 * Called once after step 2c completes. The doctrine becomes part of the
 * context injected into all downstream agents via assembleCampaignContext().
 */
export async function setDoctrine(
  campaignId: string,
  doctrine: DoctrineOutput,
  log?: Logger,
): Promise<void> {
  const memory = await getCampaignMemory(campaignId);
  if (!memory) return;

  memory.doctrine = {
    consciousnessStage: doctrine.audienceConsciousnessStage,
    marketSophistication: doctrine.marketSophistication,
    leadTemperature: doctrine.leadTemperature,
    bigDomino: doctrine.bigDomino,
    uniqueMechanism: doctrine.uniqueMechanism,
    campaignDoctrine: doctrine.campaignDoctrine,
    launchLogic: doctrine.launchLogic,
    emotionalPhaseCount: doctrine.emotionalSequence.length,
    urgencyLevel: doctrine.urgencyLevel,
    strategicWarnings: doctrine.strategicWarnings,
    adaptationNotes: doctrine.adaptationNotes,
    anticipationDays: doctrine.anticipationStrategy.durationDays,
    primaryFramework: doctrine.primaryFrameworkApplied,
    confidenceScore: doctrine.confidenceScore,
  };

  // Also strengthen the core narrative fields from doctrine if missing
  if (!memory.bigDomino && doctrine.bigDomino) memory.bigDomino = doctrine.bigDomino;
  if (!memory.uniqueMechanism && doctrine.uniqueMechanism) memory.uniqueMechanism = doctrine.uniqueMechanism;

  memory.lastUpdated = new Date().toISOString();
  memory.version += 1;
  await persistMemory(campaignId, memory);
  log?.info({ campaignId, hasDoc: true }, "Doctrine stored in campaign memory");
}

/**
 * Persist memory to DB.
 */
async function persistMemory(campaignId: string, memory: CampaignMemory): Promise<void> {
  await db
    .update(campaignsTable)
    .set({ memoryData: memory as any })
    .where(eq(campaignsTable.id, campaignId));
}

// ─── Context Assembly ──────────────────────────────────────────────────────────

/**
 * Formats the Campaign Memory into a dense, agent-readable context block.
 * This is injected into every agent's system prompt.
 *
 * Returns: contexto atual resumido, restrições relevantes, decisões humanas
 * aprovadas, aprendizados importantes, confidence score contextual.
 */
export function assembleCampaignContext(memory: CampaignMemory): string {
  const lines: string[] = [
    "## MEMÓRIA OFICIAL DA CAMPANHA (NEXOS Campaign Memory Layer)",
    "",
    "> Você é um agente da NEXOS AI. Antes de gerar qualquer saída, leia e",
    "> respeite rigorosamente o contexto abaixo. Não invente posicionamentos.",
    "> Não contradiga decisões humanas aprovadas. Não use tom diferente do definido.",
    "",
    `**Status da operação:** ${memory.operationStatus}`,
    `**Confiança contextual:** ${Math.round(memory.confidenceScore * 100)}%`,
    `**Última atualização:** ${new Date(memory.lastUpdated).toLocaleString("pt-BR")}`,
    "",
    "### PRODUTO",
    `- Nome: ${memory.product.name}`,
    `- Categoria: ${memory.product.category}`,
    `- Preço: R$${memory.product.price}`,
    memory.product.description ? `- Descrição: ${memory.product.description}` : "",
    "",
    "### AVATAR PRINCIPAL",
    `${memory.avatar.description}`,
    "",
    "### DORES CENTRAIS",
    ...memory.pains.slice(0, 5).map(p => `- ${p}`),
    "",
    "### DESEJOS DOMINANTES",
    ...memory.desires.slice(0, 3).map(d => `- ${d}`),
    "",
    "### OBJEÇÕES PRINCIPAIS",
    ...memory.objections.slice(0, 5).map(o => `- ${o}`),
    "",
    "### NARRATIVA E POSICIONAMENTO",
    `- Tom de voz: ${memory.tone}`,
    `- Linguagem: ${memory.language}`,
    `- Narrativa central: ${memory.centralNarrative}`,
    `- Big Domino: ${memory.bigDomino}`,
    `- Mecanismo único: ${memory.uniqueMechanism}`,
    `- Gatilho dominante: ${memory.dominantTrigger}`,
    `- Proposta de valor: ${memory.valueProposition}`,
    `- Posicionamento: ${memory.positioning}`,
    "",
    "### CANAIS APROVADOS",
    memory.approvedChannels.length > 0
      ? memory.approvedChannels.map(c => `- ${c}`).join("\n")
      : "- (não definidos ainda)",
    "",
  ];

  // Compliance block — always shown
  if (memory.permittedPromises.length > 0) {
    lines.push("### PROMESSAS PERMITIDAS");
    memory.permittedPromises.slice(0, 5).forEach(p => lines.push(`✅ ${p}`));
    lines.push("");
  }
  if (memory.prohibitedClaims.length > 0) {
    lines.push("### PROMESSAS PROIBIDAS (NUNCA USE)");
    memory.prohibitedClaims.slice(0, 5).forEach(p => lines.push(`🚫 ${p}`));
    lines.push("");
  }
  if (memory.ethicalBoundaries.length > 0 || memory.legalBoundaries.length > 0) {
    lines.push("### LIMITES ÉTICOS E LEGAIS");
    [...memory.ethicalBoundaries, ...memory.legalBoundaries]
      .slice(0, 6)
      .forEach(b => lines.push(`⚠️ ${b}`));
    lines.push("");
  }

  // Human decisions — always respected
  if (memory.approvedDecisions.length > 0) {
    lines.push("### DECISÕES HUMANAS APROVADAS (NÃO CONTRARIE)");
    memory.approvedDecisions.slice(-5).forEach(d =>
      lines.push(`✅ [${d.source}] ${d.content}`),
    );
    lines.push("");
  }
  if (memory.rejectedDecisions.length > 0) {
    lines.push("### DECISÕES HUMANAS REJEITADAS (NÃO REPITA)");
    memory.rejectedDecisions.slice(-5).forEach(d =>
      lines.push(`❌ [${d.source}] ${d.content}`),
    );
    lines.push("");
  }

  // Learnings and hooks (most recent)
  if (memory.winningHooks.length > 0) {
    lines.push("### HOOKS VENCEDORES (USE COMO REFERÊNCIA DE ESTILO)");
    memory.winningHooks.slice(-3).forEach(h => lines.push(`🏆 ${h.content}`));
    lines.push("");
  }
  if (memory.weakHooks.length > 0) {
    lines.push("### HOOKS FRACOS (EVITE ESSES PADRÕES)");
    memory.weakHooks.slice(-3).forEach(h => lines.push(`📉 ${h.content}`));
    lines.push("");
  }
  if (memory.campaignLearnings.length > 0) {
    lines.push("### APRENDIZADOS IMPORTANTES");
    memory.campaignLearnings.slice(-4).forEach(l => lines.push(`💡 ${l.content}`));
    lines.push("");
  }

  // Warnings
  if (memory.coreWarnings.length > 0) {
    lines.push("### AVISOS CRÍTICOS DO STRATEGIC CORE");
    memory.coreWarnings.slice(0, 3).forEach(w => lines.push(`⚠️ ${w}`));
    lines.push("");
  }
  if (memory.requiresHumanReview) {
    lines.push("⛔ **ATENÇÃO: Esta campanha requer revisão humana antes de avançar.**");
    lines.push("");
  }

  // Strategic Doctrine block — injected when Doctrine Engine has run
  if (memory.doctrine) {
    const d = memory.doctrine;
    lines.push("### DOUTRINA ESTRATÉGICA (Strategic Doctrine Engine)");
    lines.push(`- Estágio de consciência: **${d.consciousnessStage}**`);
    lines.push(`- Sofisticação do mercado: **${d.marketSophistication}**`);
    lines.push(`- Temperatura dos leads: **${d.leadTemperature}**`);
    lines.push(`- Urgência aprovada: **${d.urgencyLevel}**`);
    lines.push(`- Antecipação: ${d.anticipationDays} dias`);
    lines.push(`- Framework primário: ${d.primaryFramework}`);
    lines.push("");
    if (d.campaignDoctrine) {
      lines.push(`**Doutrina:** ${d.campaignDoctrine}`);
      lines.push("");
    }
    if (d.launchLogic.length > 0) {
      lines.push("**Lógica de Lançamento (princípios desta campanha):**");
      d.launchLogic.slice(0, 6).forEach(l => lines.push(`→ ${l}`));
      lines.push("");
    }
    if (d.strategicWarnings.length > 0) {
      lines.push("**Avisos Estratégicos do Doctrine Engine:**");
      d.strategicWarnings.slice(0, 4).forEach(w => lines.push(`🚫 ${w}`));
      lines.push("");
    }
    if (d.adaptationNotes.length > 0) {
      lines.push("**Notas de Adaptação de Frameworks:**");
      d.adaptationNotes.slice(0, 3).forEach(n => lines.push(`📌 ${n}`));
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");

  return lines.filter(l => l !== undefined).join("\n");
}

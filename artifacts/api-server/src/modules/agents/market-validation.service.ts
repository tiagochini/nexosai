/**
 * Market Validation Service — Avaliação Mercadológica
 *
 * Roda 3 validadores ANTES do command.agent, DENTRO da fase "analyzing".
 * Não cria transição de estado nova — usa o mecanismo de checkpoint existente.
 *
 * Curto-circuito: 1 rejeição crítica (isCriticalBlock=true) = INVIAVEL geral,
 * independente dos outros dois validadores.
 *
 * NOTA: Qualidade/calibração dos prompts está marcada como PENDENTE.
 * Este arquivo implementa apenas a MECÂNICA.
 */

import { eq } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import type {
  MarketValidationResult,
  MarketValidatorResult,
  MarketVerdictType,
} from "../campaign-brain/campaign-brain.service.js";
import type { Logger } from "pino";

// ─── Re-export so command.agent can import the type directly ─────────────────
export type { MarketValidationResult };

// ─── Pivot suggestions displayed when verdict = INVIAVEL ─────────────────────
const DEFAULT_PIVOT_SUGGESTIONS = [
  "Transformar em produto digital (e-book, template, toolkit) com custo de produção próximo de zero",
  "Criar um curso / infoproduto baseado no seu conhecimento neste nicho",
  "Ajustar o modelo de negócio — conversar com o NexOS sobre como posicionar de forma viável",
];

// ─── Prompt builder helpers ───────────────────────────────────────────────────

function buildIntakeSummary(intakeData: Record<string, unknown>): string {
  const pick = (key: string) => intakeData[key] ?? intakeData[`product.${key}`] ?? intakeData[`audience.${key}`] ?? "";
  return [
    `Produto: ${pick("name") || pick("product") || "(não informado)"}`,
    `Categoria: ${pick("category") || "(não informada)"}`,
    `Preço: R$ ${pick("price") || pick("ticket") || "(não informado)"}`,
    `Público-alvo: ${pick("description") || pick("avatar") || "(não informado)"}`,
    `Meta de receita: R$ ${intakeData["campaign.revenueTarget"] ?? intakeData["revenueTarget"] ?? "(não informada)"}`,
    `Diferencial único: ${pick("uniqueMechanism") || pick("differentiator") || "(não informado)"}`,
    `Autoridade/credenciais: ${pick("authority") || pick("expertise") || "(não informado)"}`,
    `Modelo de entrega: ${pick("deliveryMethod") || "(não informado)"}`,
  ].join("\n");
}

// ─── Individual validator prompts ─────────────────────────────────────────────
// CALIBRAÇÃO PENDENTE — qualidade de análise será aprofundada em iteração futura.

const MARKET_VALIDATOR_PROMPT = `Você é o Market Validator da NexOS AI.
Avalie se existe demanda real e tamanho de mercado suficiente para este produto.
Analise: existência de concorrentes (sinal de mercado), pesquisas no Google Trends, 
tamanho estimado do público, urgência da dor, e se o nicho não está saturado a ponto de inviabilizar entrada.

RETORNE APENAS JSON válido:
\`\`\`json
{
  "verdict": "VIAVEL|VIAVEL_COM_AJUSTES|INVIAVEL",
  "score": 0,
  "justification": "string — 2-3 frases diretas",
  "criticalIssues": ["string"],
  "adjustmentSuggestions": ["string"],
  "isCriticalBlock": false
}
\`\`\`
isCriticalBlock = true apenas se o mercado for inexistente ou o nicho for comprovadamente saturado sem diferencial.`;

const OFFER_PRICE_VALIDATOR_PROMPT = `Você é o Offer & Price Validator da NexOS AI.
Avalie se o preço e a oferta são compatíveis com o mercado brasileiro e o público-alvo descrito.
Analise: ticket médio do nicho, relação custo-benefício percebida, ancoragem de preço possível,
e se o modelo de precificação é sustentável para o volume de vendas necessário.

RETORNE APENAS JSON válido:
\`\`\`json
{
  "verdict": "VIAVEL|VIAVEL_COM_AJUSTES|INVIAVEL",
  "score": 0,
  "justification": "string — 2-3 frases diretas",
  "criticalIssues": ["string"],
  "adjustmentSuggestions": ["string"],
  "isCriticalBlock": false
}
\`\`\`
isCriticalBlock = true apenas se o preço for absolutamente incompatível com o mercado (ex: R$50.000 para público classe C sem financiamento).`;

const BRAND_VALIDATOR_PROMPT = `Você é o Brand & Authority Validator da NexOS AI.
Avalie se o empreendedor/marca tem credenciais mínimas para vender este produto com autoridade.
Analise: sinais de autoridade declarados, reputação no nicho, presença digital mínima, 
e se a proposta tem consistência de marca.

RETORNE APENAS JSON válido:
\`\`\`json
{
  "verdict": "VIAVEL|VIAVEL_COM_AJUSTES|INVIAVEL",
  "score": 0,
  "justification": "string — 2-3 frases diretas",
  "criticalIssues": ["string"],
  "adjustmentSuggestions": ["string"],
  "isCriticalBlock": false
}
\`\`\`
isCriticalBlock = true apenas se houver ausência TOTAL de autoridade E o produto exigir alta confiança (ex: saúde, finanças, jurídico).`;

// ─── Default fallback values per validator ────────────────────────────────────
const VALIDATOR_DEFAULTS: Record<string, Partial<MarketValidatorResult>> = {
  market_validator:      { verdict: "VIAVEL_COM_AJUSTES", score: 60, justification: "Análise não concluída — avaliação manual recomendada.", criticalIssues: [], adjustmentSuggestions: [], isCriticalBlock: false },
  offer_price_validator: { verdict: "VIAVEL_COM_AJUSTES", score: 60, justification: "Análise não concluída — avaliação manual recomendada.", criticalIssues: [], adjustmentSuggestions: [], isCriticalBlock: false },
  brand_validator:       { verdict: "VIAVEL_COM_AJUSTES", score: 60, justification: "Análise não concluída — avaliação manual recomendada.", criticalIssues: [], adjustmentSuggestions: [], isCriticalBlock: false },
};

// ─── Persist result directly to brainData ────────────────────────────────────

async function persistMarketValidation(
  campaignId: string,
  result: MarketValidationResult,
  log: Logger,
): Promise<void> {
  try {
    const [row] = await db
      .select({ brainData: (campaignsTable as any).brainData })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);
    const existing = ((row?.brainData ?? {}) as Record<string, unknown>);
    await db
      .update(campaignsTable)
      .set({ brainData: { ...existing, marketValidation: result } as any })
      .where(eq(campaignsTable.id, campaignId));
    log.info({ campaignId, verdict: result.overallVerdict }, "[MARKET_VALIDATION] Resultado persistido em brainData");
  } catch (err) {
    log.warn({ err, campaignId }, "[MARKET_VALIDATION] Falha ao persistir em brainData (não-bloqueante)");
  }
}

// ─── Single validator runner ──────────────────────────────────────────────────

async function runSingleValidator(
  validatorKey: "market_validator" | "offer_price_validator" | "brand_validator",
  systemPrompt: string,
  intakeSummary: string,
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<MarketValidatorResult> {
  const defaults = VALIDATOR_DEFAULTS[validatorKey]!;
  try {
    const result = await runAgent({
      campaignId,
      workspaceId,
      agentRole: validatorKey,
      systemPrompt,
      messages: [
        {
          role: "user",
          content: `Avalie este produto/oferta:\n\n${intakeSummary}\n\nRetorne o JSON de avaliação.`,
        },
      ],
      log,
      requiresApproval: false,
      pipelineMode: true,
      thinkingMessages: [`Validador analisando ${validatorKey.replace(/_/g, " ")}...`],
    });

    const parsed = parseAgentJSON<Partial<MarketValidatorResult>>(result.content, {
      verdict: defaults.verdict!,
      score: defaults.score!,
      justification: defaults.justification!,
      criticalIssues: [],
      adjustmentSuggestions: [],
      isCriticalBlock: false,
    });

    return {
      validator: validatorKey,
      verdict: (parsed.verdict as MarketVerdictType) ?? defaults.verdict!,
      score: typeof parsed.score === "number" ? parsed.score : defaults.score!,
      justification: parsed.justification ?? defaults.justification!,
      criticalIssues: Array.isArray(parsed.criticalIssues) ? parsed.criticalIssues : [],
      adjustmentSuggestions: Array.isArray(parsed.adjustmentSuggestions) ? parsed.adjustmentSuggestions : [],
      isCriticalBlock: parsed.isCriticalBlock === true,
    };
  } catch (err) {
    log.warn({ err, campaignId, validatorKey }, "[MARKET_VALIDATION] Validator falhou — usando fallback VIAVEL_COM_AJUSTES");
    return {
      validator: validatorKey,
      verdict: "VIAVEL_COM_AJUSTES",
      score: 50,
      justification: "Análise indisponível no momento — recomenda-se revisão manual.",
      criticalIssues: [],
      adjustmentSuggestions: [],
      isCriticalBlock: false,
    };
  }
}

// ─── Compute overall verdict with short-circuit logic ─────────────────────────

function computeOverallVerdict(validators: MarketValidatorResult[]): MarketVerdictType {
  // Short-circuit: 1 critical block = INVIAVEL regardless of others
  if (validators.some((v) => v.isCriticalBlock && v.verdict === "INVIAVEL")) {
    return "INVIAVEL";
  }
  // Any INVIAVEL = overall INVIAVEL
  if (validators.some((v) => v.verdict === "INVIAVEL")) {
    return "INVIAVEL";
  }
  // Any VIAVEL_COM_AJUSTES = overall VIAVEL_COM_AJUSTES
  if (validators.some((v) => v.verdict === "VIAVEL_COM_AJUSTES")) {
    return "VIAVEL_COM_AJUSTES";
  }
  return "VIAVEL";
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function runMarketValidation(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<MarketValidationResult> {
  const intakeSummary = buildIntakeSummary(intakeData);

  log.info({ campaignId }, "[MARKET_VALIDATION] Iniciando validação mercadológica (3 validadores)");

  emitCampaignEvent({
    campaignId,
    type: "agent_thinking",
    agentType: "command",
    message: "Avaliação Mercadológica iniciada — 3 validadores analisando produto, oferta e marca...",
    timestamp: new Date().toISOString(),
  });

  // Run 3 validators sequentially (preserves token budget; parallel would be faster
  // but risks simultaneous credit deduction failures in degraded mode)
  const marketResult = await runSingleValidator(
    "market_validator",
    MARKET_VALIDATOR_PROMPT,
    intakeSummary,
    campaignId,
    workspaceId,
    log,
  );

  emitCampaignEvent({
    campaignId,
    type: "agent_thinking",
    agentType: "command",
    message: `Validador de Mercado: ${marketResult.verdict} (score ${marketResult.score}/100)`,
    timestamp: new Date().toISOString(),
  });

  const offerResult = await runSingleValidator(
    "offer_price_validator",
    OFFER_PRICE_VALIDATOR_PROMPT,
    intakeSummary,
    campaignId,
    workspaceId,
    log,
  );

  emitCampaignEvent({
    campaignId,
    type: "agent_thinking",
    agentType: "command",
    message: `Validador de Oferta & Preço: ${offerResult.verdict} (score ${offerResult.score}/100)`,
    timestamp: new Date().toISOString(),
  });

  const brandResult = await runSingleValidator(
    "brand_validator",
    BRAND_VALIDATOR_PROMPT,
    intakeSummary,
    campaignId,
    workspaceId,
    log,
  );

  emitCampaignEvent({
    campaignId,
    type: "agent_thinking",
    agentType: "command",
    message: `Validador de Marca & Autoridade: ${brandResult.verdict} (score ${brandResult.score}/100)`,
    timestamp: new Date().toISOString(),
  });

  const validators: MarketValidatorResult[] = [marketResult, offerResult, brandResult];
  const overallVerdict = computeOverallVerdict(validators);

  const pivotSuggestions =
    overallVerdict === "INVIAVEL" ? DEFAULT_PIVOT_SUGGESTIONS : [];

  const result: MarketValidationResult = {
    overallVerdict,
    validators,
    pivotSuggestions,
    validatedAt: new Date().toISOString(),
  };

  await persistMarketValidation(campaignId, result, log);

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: `Avaliação Mercadológica concluída — veredito: ${overallVerdict}`,
    data: { overallVerdict, scores: validators.map((v) => ({ validator: v.validator, score: v.score, verdict: v.verdict })) },
    timestamp: new Date().toISOString(),
  });

  log.info({ campaignId, overallVerdict, scores: validators.map((v) => v.score) }, "[MARKET_VALIDATION] Concluído");

  return result;
}

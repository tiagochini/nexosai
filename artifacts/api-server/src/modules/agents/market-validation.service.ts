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
// REGRA CENTRAL DE COMPLIANCE:
//   • isCriticalBlock = true SOMENTE para conteúdo intrinsecamente ilegal na plataforma:
//     venda de drogas ilícitas, pirâmide financeira, instruções criminosas (ex: como sonegar,
//     como fabricar entorpecentes), conteúdo CSAM, golpes declarados.
//   • Produtos REGULADOS (saúde, finanças, jurídico, educação regulada) NÃO são bloqueados —
//     geram requiresAcknowledgment=true + regulatoryAlerts listando o que a lei exige.
//   • Preço fora do perfil do público NUNCA bloqueia — gera alerta mercadológico com sugestões.
//   • O pipeline só para para isCriticalBlock=true. Todo o resto segue após ciência do founder.

const MARKET_VALIDATOR_PROMPT = `Você é o Market Validator da NexOS AI.
Avalie se existe demanda real e tamanho de mercado suficiente para este produto.
Analise: existência de concorrentes (sinal de mercado), tamanho estimado do público,
urgência da dor, e se o nicho tem viabilidade de entrada com diferencial.

REGRA DE BLOQUEIO (isCriticalBlock):
- true APENAS se o produto/serviço for INTRINSECAMENTE ILEGAL no Brasil:
  ex: venda de entorpecentes ilícitos, pirâmide financeira, esquema Ponzi,
  instruções para crimes (sonegação, fraude, fabricação de drogas),
  conteúdo sexualizando menores, golpes financeiros declarados.
- Mercado saturado, nicho fraco, demanda baixa → NUNCA bloqueiam → gere VIAVEL_COM_AJUSTES com sugestões.
- Produtos regulados (remédios com receita, investimentos, advocacia) → NUNCA bloqueiam → use requiresAcknowledgment.

RETORNE APENAS JSON válido:
\`\`\`json
{
  "verdict": "VIAVEL|VIAVEL_COM_AJUSTES",
  "score": 0,
  "justification": "string — 2-3 frases diretas",
  "criticalIssues": ["string"],
  "adjustmentSuggestions": ["string"],
  "isCriticalBlock": false,
  "requiresAcknowledgment": false,
  "regulatoryAlerts": []
}
\`\`\`
Use verdict="INVIAVEL" + isCriticalBlock=true SOMENTE para conteúdo ilegal flagrante listado acima.
Para produtos regulados que exijam registro/licença/aprovação legal, use requiresAcknowledgment=true
e liste em regulatoryAlerts o que a lei brasileira exige (ex: "Registro ANVISA obrigatório para comercialização").`;

const OFFER_PRICE_VALIDATOR_PROMPT = `Você é o Offer & Price Validator da NexOS AI.
Avalie se o preço e a oferta são compatíveis com o mercado brasileiro e o público-alvo descrito.
Analise: ticket médio do nicho, relação custo-benefício percebida, e sustentabilidade do modelo.

REGRA DE BLOQUEIO (isCriticalBlock):
- true APENAS se a oferta for um esquema ilegal: pirâmide, Ponzi, promessa de retorno garantido
  não regulamentado (crime contra o sistema financeiro), ou fraude declarada.
- Preço alto para o público, ticket acima da média, incompatibilidade com perfil socioeconômico →
  NUNCA bloqueiam → gere VIAVEL_COM_AJUSTES com sugestões de ajuste de público ou preço.
- Produtos financeiros regulados (investimentos, seguros, crédito) → use requiresAcknowledgment.

RETORNE APENAS JSON válido:
\`\`\`json
{
  "verdict": "VIAVEL|VIAVEL_COM_AJUSTES",
  "score": 0,
  "justification": "string — 2-3 frases diretas",
  "criticalIssues": ["string"],
  "adjustmentSuggestions": ["string"],
  "isCriticalBlock": false,
  "requiresAcknowledgment": false,
  "regulatoryAlerts": []
}
\`\`\`
Use verdict="INVIAVEL" + isCriticalBlock=true SOMENTE para esquemas ilegais declarados.
Incompatibilidade de preço/público é um alerta mercadológico — nunca um bloqueio.`;

const BRAND_VALIDATOR_PROMPT = `Você é o Brand & Authority Validator da NexOS AI.
Avalie autoridade, credibilidade e conformidade regulatória do empreendedor para este produto.

REGRA DE BLOQUEIO (isCriticalBlock):
- true APENAS se o founder estiver fazendo ALEGAÇÕES FRAUDULENTAS SEM QUALQUER BASE:
  ex: vender-se como médico sem CRM, prometer cura de doenças sem qualquer embasamento,
  ou fabricar credenciais inexistentes em área que coloca vidas em risco.
- Ausência de presença digital → NUNCA bloqueia → VIAVEL_COM_AJUSTES com sugestões.
- Nicho regulado (saúde, finanças, direito, educação formal) → NÃO bloqueia →
  use requiresAcknowledgment=true + liste em regulatoryAlerts o que a lei exige.
  Exemplo de regulatoryAlerts para saúde: "CRM ativo obrigatório para prescrição",
  "CFM veda publicidade com garantia de resultados", "ANVISA regula alegações terapêuticas".
  Exemplo para finanças: "CVM exige habilitação para assessoria de investimentos".
  O founder profissional HABILITADO deve apenas confirmar ciência — o pipeline segue.

RETORNE APENAS JSON válido:
\`\`\`json
{
  "verdict": "VIAVEL|VIAVEL_COM_AJUSTES",
  "score": 0,
  "justification": "string — 2-3 frases diretas",
  "criticalIssues": ["string"],
  "adjustmentSuggestions": ["string"],
  "isCriticalBlock": false,
  "requiresAcknowledgment": false,
  "regulatoryAlerts": []
}
\`\`\`
Use verdict="INVIAVEL" + isCriticalBlock=true SOMENTE para fraude de identidade/credencial declarada.
Um médico com CRM vendendo programa de saúde = VIAVEL ou VIAVEL_COM_AJUSTES, nunca INVIAVEL.`;

// ─── Default fallback values per validator ────────────────────────────────────
const VALIDATOR_DEFAULTS: Record<string, Partial<MarketValidatorResult>> = {
  market_validator:      { verdict: "VIAVEL_COM_AJUSTES", score: 60, justification: "Análise não concluída — avaliação manual recomendada.", criticalIssues: [], adjustmentSuggestions: [], isCriticalBlock: false, requiresAcknowledgment: false, regulatoryAlerts: [] },
  offer_price_validator: { verdict: "VIAVEL_COM_AJUSTES", score: 60, justification: "Análise não concluída — avaliação manual recomendada.", criticalIssues: [], adjustmentSuggestions: [], isCriticalBlock: false, requiresAcknowledgment: false, regulatoryAlerts: [] },
  brand_validator:       { verdict: "VIAVEL_COM_AJUSTES", score: 60, justification: "Análise não concluída — avaliação manual recomendada.", criticalIssues: [], adjustmentSuggestions: [], isCriticalBlock: false, requiresAcknowledgment: false, regulatoryAlerts: [] },
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
      requiresAcknowledgment: parsed.requiresAcknowledgment === true,
      regulatoryAlerts: Array.isArray(parsed.regulatoryAlerts) ? parsed.regulatoryAlerts : [],
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

// ─── Compute overall verdict ───────────────────────────────────────────────────
// REGRA: só isCriticalBlock=true (conteúdo ilegal flagrante) retorna INVIAVEL.
// Tudo o mais — produtos regulados, preço alto, autoridade baixa — vira
// VIAVEL_COM_AJUSTES. O pipeline não para; o founder recebe alertas e
// confirma ciência quando requiresAcknowledgment=true.

function computeOverallVerdict(validators: MarketValidatorResult[]): MarketVerdictType {
  // Único motivo de bloqueio real: conteúdo intrinsecamente ilegal na plataforma
  if (validators.some((v) => v.isCriticalBlock)) {
    return "INVIAVEL";
  }
  // Qualquer alerta mercadológico, regulatório ou de autoridade → segue com ajustes
  if (validators.some((v) => v.verdict === "VIAVEL_COM_AJUSTES" || v.requiresAcknowledgment)) {
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

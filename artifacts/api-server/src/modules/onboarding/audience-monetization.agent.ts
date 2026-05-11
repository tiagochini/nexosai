import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { parseAgentJSON } from "../agents/agent.runner.js";
import type { Logger } from "pino";

export interface AudienceMonetizationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AudienceMonetizationPlan {
  approachTitle: string;
  subPath: "micro_launch" | "members_area" | "product_from_audience";
  audienceSummary: string;
  platformFocus: string;
  monetizationModel: string;
  suggestedProductName: string;
  priceRange: string;
  launchTimeline: string;
  firstSteps: string[];
  revenueProjection: string;
  whyItWorks: string;
}

export interface AudienceMonetizationResult {
  aiMessage: string;
  stage: "discovery" | "planning" | "confirmed";
  plan?: AudienceMonetizationPlan;
  intakeSnapshot?: Record<string, unknown>;
  isComplete: boolean;
}

const FALLBACK_RESULT: AudienceMonetizationResult = {
  aiMessage: "Desculpe, tive um problema ao processar. Pode tentar novamente?",
  stage: "discovery",
  isComplete: false,
};

const SYSTEM_PROMPT = `Você é o NexOS Creator Strategist — especialista em monetização de audiências no mercado digital brasileiro.

Sua missão: descobrir como o creator já tem audiência, qual é o nicho, e estruturar a melhor estratégia de monetização.

FLUXO EM 2 ETAPAS:
1. DISCOVERY (2 perguntas): Plataforma principal, tamanho da audiência, nicho e objetivo financeiro
2. PLANNING: Apresentar o plano completo de monetização personalizado

REGRAS:
- Uma pergunta por vez no discovery
- Seja direto, energético — creator quer ver resultado rápido
- Micro-lançamento: 1k-20k seguidores, produto R$97-R$497
- Área de membros: audiências engajadas a partir de 5k
- Produto derivado (PLF): audiências acima de 10k

Responda SEMPRE neste JSON exato:
{
  "aiMessage": "Sua mensagem natural em PT-BR",
  "stage": "discovery|planning|confirmed",
  "plan": null ou objeto com o plano (apenas em planning/confirmed),
  "intakeSnapshot": null ou objeto com campos de intake mapeados (em confirmed),
  "isComplete": false
}

Quando o plano estiver aceito pelo usuário, retorne isComplete: true.

Formato do objeto plan:
{
  "approachTitle": "nome do approach",
  "subPath": "micro_launch|members_area|product_from_audience",
  "audienceSummary": "resumo da audiência do creator",
  "platformFocus": "plataforma principal",
  "monetizationModel": "como vai monetizar em 1 frase",
  "suggestedProductName": "nome sugerido para o produto",
  "priceRange": "faixa de preço recomendada",
  "launchTimeline": "prazo estimado",
  "firstSteps": ["passo 1", "passo 2", "passo 3"],
  "revenueProjection": "projeção de receita no primeiro lançamento",
  "whyItWorks": "por que essa estratégia funciona para esse creator"
}`;

export async function processAudienceMonetizationTurn(
  workspaceId: string,
  message: string,
  history: AudienceMonetizationTurn[],
  subPath: string,
  log: Logger
): Promise<AudienceMonetizationResult> {
  const subPathContext =
    subPath === "micro_launch"
      ? "O creator escolheu MICRO-LANÇAMENTO — produto de entrada baseado nos vídeos que já publica."
      : subPath === "members_area"
        ? "O creator escolheu ÁREA DE MEMBROS — acesso exclusivo à comunidade/canal."
        : "O creator escolheu PRODUTO DERIVADO — transformar audiência em lista quente e fazer PLF completo.";

  const systemWithContext = `${SYSTEM_PROMPT}\n\nCONTEXTO: ${subPathContext}`;

  const messages = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: message },
  ];

  const completion = await completeWithAgent(
    "creator_growth",
    systemWithContext,
    messages,
    workspaceId,
    log
  );

  const parsed = parseAgentJSON<AudienceMonetizationResult>(
    completion.content,
    FALLBACK_RESULT
  );

  return parsed;
}

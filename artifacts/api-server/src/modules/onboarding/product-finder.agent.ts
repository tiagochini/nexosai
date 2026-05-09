import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { parseAgentJSON } from "../agents/agent.runner.js";
import type { Logger } from "pino";

export interface ProductFinderTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ProductFinderResult {
  aiMessage: string;
  stage: "discovery" | "proposing" | "refining" | "confirmed";
  productProposals?: ProductProposal[];
  confirmedProduct?: ProductProposal;
  intakeSnapshot?: Record<string, unknown>;
  isComplete: boolean;
}

export interface ProductProposal {
  id: string;
  name: string;
  category: string;
  format: string;
  targetAudience: string;
  mainPain: string;
  transformation: string;
  estimatedPrice: number;
  suggestedTrack: string;
  whyViable: string;
}

const PRODUCT_FINDER_SYSTEM = `Você é o NexOS Product Strategist — um especialista em criação e validação de produtos digitais no mercado brasileiro.

Sua missão: ajudar o usuário a descobrir e estruturar o produto digital ideal com base nas suas habilidades, experiências e objetivos financeiros.

FLUXO EM 3 ESTÁGIOS:
1. DISCOVERY (2-3 perguntas): Entender background, habilidades, paixões, experiência profissional
2. PROPOSING: Gerar 3 propostas de produto com base no perfil descoberto
3. REFINING: Refinar a proposta escolhida + montar estrutura básica do produto

REGRAS:
- Faça UMA pergunta por vez no estágio discovery
- Seja empolgante e consultivo — você vê potencial em todo mundo
- Pense no mercado brasileiro de infoprodutos (cursos, mentorias, comunidades, SaaS)
- Produtos entre R$197-R$2997 têm melhor conversão para iniciantes
- Sempre priorize transformação concreta e rápida (7-30 dias)

Responda SEMPRE neste JSON exato:
{
  "aiMessage": "Sua mensagem natural em PT-BR + próxima pergunta ou proposta",
  "stage": "discovery|proposing|refining|confirmed",
  "productProposals": null ou array de propostas (apenas no estágio proposing),
  "confirmedProduct": null ou objeto com o produto confirmado (apenas em refining/confirmed),
  "intakeSnapshot": null ou objeto com os campos de intake já definidos (em confirmed),
  "isComplete": false
}

Quando o produto estiver confirmado e o intake básico gerado, retorne isComplete: true.

Formato de cada proposta em productProposals:
{
  "id": "p1|p2|p3",
  "name": "Nome do produto",
  "category": "infoproduct|mentorship|software|service|community|event",
  "format": "curso online|mentoria em grupo|1:1|comunidade|etc",
  "targetAudience": "quem compra",
  "mainPain": "dor principal que resolve",
  "transformation": "resultado em 30 dias",
  "estimatedPrice": 997,
  "suggestedTrack": "six_digits",
  "whyViable": "por que vai vender no Brasil agora"
}`;

export async function processProductFinderTurn(
  workspaceId: string,
  userMessage: string,
  history: ProductFinderTurn[],
  log: Logger
): Promise<ProductFinderResult> {
  const messages = [
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: userMessage },
  ];

  try {
    const result = await completeWithAgent(
      "strategy",
      PRODUCT_FINDER_SYSTEM,
      messages,
      workspaceId,
      log,
      undefined
    );

    const parsed = parseAgentJSON<{
      aiMessage?: string;
      stage?: string;
      productProposals?: ProductProposal[];
      confirmedProduct?: ProductProposal;
      intakeSnapshot?: Record<string, unknown>;
      isComplete?: boolean;
    }>(result.content, {});

    return {
      aiMessage: parsed.aiMessage ?? result.content,
      stage: (parsed.stage as ProductFinderResult["stage"]) ?? "discovery",
      productProposals: parsed.productProposals ?? undefined,
      confirmedProduct: parsed.confirmedProduct ?? undefined,
      intakeSnapshot: parsed.intakeSnapshot ?? undefined,
      isComplete: parsed.isComplete ?? false,
    };
  } catch (err) {
    log.warn({ err }, "ProductFinder agent failed");
    return {
      aiMessage: "Me conta um pouco sobre você — qual é sua área de atuação ou especialidade principal?",
      stage: "discovery",
      isComplete: false,
    };
  }
}

const AFFILIATE_NEXOS_SYSTEM = `Você é o NexOS Onboarding Specialist.

O usuário decidiu se tornar um Afiliado NexOS — ele vai lançar o próprio NexOS AI para outras pessoas.

Sua missão: entender o perfil dele para montar uma estratégia de afiliado personalizada.

Colete em 3 perguntas:
1. Qual é seu público atual? (seguidores, lista de email, comunidade, etc)
2. Já tem experiência com marketing digital ou vendas?
3. Qual meta financeira quer atingir nos primeiros 30 dias como afiliado?

Com base nas respostas, crie uma estratégia resumida de lançamento como afiliado NexOS AI.

Responda SEMPRE neste JSON:
{
  "aiMessage": "mensagem natural em PT-BR",
  "stage": "profiling|strategy|confirmed",
  "affiliateStrategy": null ou { "audienceSize": "string", "mainChannel": "string", "suggestedApproach": "string", "revenueProjection": "string", "firstSteps": ["passo1", "passo2", "passo3"] },
  "isComplete": false
}

Quando tiver a estratégia pronta, retorne isComplete: true.`;

export interface AffiliateNexosResult {
  aiMessage: string;
  stage: "profiling" | "strategy" | "confirmed";
  affiliateStrategy?: {
    audienceSize: string;
    mainChannel: string;
    suggestedApproach: string;
    revenueProjection: string;
    firstSteps: string[];
  };
  isComplete: boolean;
}

export async function processAffiliateNexosTurn(
  workspaceId: string,
  userMessage: string,
  history: ProductFinderTurn[],
  log: Logger
): Promise<AffiliateNexosResult> {
  const messages = [
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: userMessage },
  ];

  try {
    const result = await completeWithAgent(
      "strategy",
      AFFILIATE_NEXOS_SYSTEM,
      messages,
      workspaceId,
      log,
      undefined
    );

    const parsed = parseAgentJSON<{
      aiMessage?: string;
      stage?: string;
      affiliateStrategy?: AffiliateNexosResult["affiliateStrategy"];
      isComplete?: boolean;
    }>(result.content, {});

    return {
      aiMessage: parsed.aiMessage ?? result.content,
      stage: (parsed.stage as AffiliateNexosResult["stage"]) ?? "profiling",
      affiliateStrategy: parsed.affiliateStrategy ?? undefined,
      isComplete: parsed.isComplete ?? false,
    };
  } catch (err) {
    log.warn({ err }, "AffiliateNexos agent failed");
    return {
      aiMessage: "Para montar sua estratégia de afiliado, me conta: qual é seu público atual? Tem seguidores, lista de e-mail ou comunidade?",
      stage: "profiling",
      isComplete: false,
    };
  }
}

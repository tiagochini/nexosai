/**
 * SEMENTE LAUNCH AGENT — Especialista em Lançamento Semente
 * Estrutura o lançamento semente completo: da validação antes de criar o produto
 * até a primeira venda com acesso antecipado e turma beta.
 * Provider: Claude (estratégia profunda, modelo PLF brasileiro)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runAgentWithCritique } from "./critique.runner.js";
import { COGNITIVE_IDENTITY_COPYWRITER } from "./cognitive-identity-system.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface SementePhase {
  name: string;
  duration: string;
  objective: string;
  actions: string[];
  content: {
    type: "email" | "post" | "lives" | "pdf" | "webinar" | "whatsapp_broadcast";
    title: string;
    body: string;
    platform: string;
    timing: string;
  }[];
  successIndicator: string;
}

export interface SementeOffer {
  name: string;
  positioning: string;
  price: number;
  priceRationale: string;
  bonuses: string[];
  guarantee: string;
  deadline: string;
  slots: number;
  slotsRationale: string;
  paymentOptions: string[];
  cartOpenMessage: string;
  cartCloseMessage: string;
}

export interface SementeLaunchOutput {
  productConcept: string;
  validationHypothesis: string;
  targetRevenue: number;
  targetStudents: number;
  launchDuration: string;
  prelaunchPhase: SementePhase;
  contentPhase: SementePhase;
  launchPhase: SementePhase;
  betaPhase: SementePhase;
  offer: SementeOffer;
  contentPillars: {
    pillar: string;
    rationale: string;
    examples: string[];
  }[];
  communityStrategy: {
    platform: "whatsapp" | "telegram" | "circle" | "discord" | "facebook";
    groupName: string;
    initialSize: number;
    engagementRules: string[];
    weeklyRituals: string[];
  };
  liveStrategy: {
    numberOfLives: number;
    topics: string[];
    platform: string;
    timing: string;
    conversionMoment: string;
  };
  testimonialsStrategy: string;
  nextLaunchFoundation: string;
  criticalRisks: string[];
  successMetrics: Record<string, string | number>;
}

const SEMENTE_LAUNCH_PROMPT = `Você é o Agente Especialista em Lançamento Semente do NexOS AI — o mestre do modelo de validação e primeira venda que Jeff Walker popularizou e Érico Rocha adaptou para o mercado brasileiro.

## O QUE É O LANÇAMENTO SEMENTE

O Lançamento Semente é o modelo de lançamento que vende ANTES de criar. Você lança para uma lista pequena (ou uma audiência fria em casos mais avançados), valida o interesse com dinheiro real, e só então constrói o produto com os primeiros alunos.

**Por que é o modelo ideal para iniciantes e para novos produtos:**
- Zero risco: você só constrói se vender
- Validação real: pessoas votando com o cartão
- Produto co-criado com os primeiros alunos (eles definem o que mais importa)
- Primeiros depoimentos e casos de sucesso já no primeiro lançamento
- Base para escalar: semente vira perpétuo ou lançamento maior

## O MODELO SEMENTE EM 4 FASES

### FASE 1 — PRÉ-LANÇAMENTO (7-14 dias antes)
Objetivo: Despertar interesse sem vender ainda. Criar antecipação genuína.
- Storytelling de origem (por que você foi compelido a criar isto)
- Conteúdo que resolve 30% do problema (deixando 70% para o produto)
- Pergunta direta para a audiência: "Você compraria X?" → validação de interesse pré-venda
- Construção do grupo de interessados (lista, grupo WhatsApp/Telegram)

### FASE 2 — FASE DE CONTEÚDO (5-7 dias)
A sequência de conteúdo que educa, aquece e cria desejo antes do carrinho abrir.
- Email/WhatsApp sequência PLC (Pré-Lançamento de Conteúdo)
- Lives ou vídeos que constroem autoridade progressiva
- Casos de sucesso de outras pessoas (ou da sua trajetória)
- Gatilhos: curiosidade → valor → antecipação → urgência

### FASE 3 — ABERTURA DO CARRINHO (3-5 dias)
Venda com acesso antecipado + bônus de early bird + vagas limitadas.
- Abertura com email + WhatsApp simultâneos
- Lives de vendas (Q&A ao vivo com CTA ao final)
- Follow-up de não-compradores (segmentação por comportamento)
- Fechamento com escassez real (vagas ou prazo verdadeiro)

### FASE 4 — BETA (durante entrega)
A turma beta co-cria o produto.
- Calls semanais com a turma
- Feedback integrado ao produto em tempo real
- Depoimentos e casos documentados
- Fundação para o próximo lançamento maior

## PRINCÍPIOS DO SEMENTE

**Preço do Semente:** Não venda barato como "versão beta". Venda com desconto de early adopter sobre o preço final prometido. Isso cria urgência real E ancora o valor futuro.

**Vagas limitadas com motivo:** 10-30 alunos, não por escassez artificial, mas porque você VAI atender cada um pessoalmente. Esta promessa é real e é o valor do semente.

**Não peça desculpas pelo produto "incompleto":** Posicione como privilégio — o aluno ajuda a construir algo, tem acesso direto ao criador, e paga menos por isso. Não como "ainda não está pronto".

**Live como motor de vendas:** No lançamento semente, uma live de vendas de 60-90 minutos com Q&A converte 3-5x mais do que qualquer sequência de email sozinha.

**Depoimentos no ato:** Colete feedback/depoimento dentro das primeiras 48h do produto (quando o entusiasmo está no pico), não depois de 30 dias.

## SOBRE O PRÓXIMO LANÇAMENTO

O semente bem executado cria a fundação para o próximo lançamento ser 3-5x maior:
- Produto validado e melhorado pelo feedback beta
- 10-30 casos de sucesso reais com fotos e resultados
- Lista de interessados que não compraram (prime para a próxima abertura)
- Prova de mercado para investir em tráfego pago

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "productConcept": "string — conceito do produto validado pelo semente",
  "validationHypothesis": "string — o que você está testando com este semente",
  "targetRevenue": 0,
  "targetStudents": 0,
  "launchDuration": "string — duração total do lançamento",
  "prelaunchPhase": {
    "name": "Pré-Lançamento",
    "duration": "string",
    "objective": "string",
    "actions": ["string"],
    "content": [
      {
        "type": "email|post|lives|pdf|webinar|whatsapp_broadcast",
        "title": "string",
        "body": "string — conteúdo completo",
        "platform": "string",
        "timing": "string"
      }
    ],
    "successIndicator": "string — como saber que esta fase funcionou"
  },
  "contentPhase": { "name": "Fase de Conteúdo", "duration": "string", "objective": "string", "actions": ["string"], "content": [], "successIndicator": "string" },
  "launchPhase": { "name": "Abertura do Carrinho", "duration": "string", "objective": "string", "actions": ["string"], "content": [], "successIndicator": "string" },
  "betaPhase": { "name": "Beta / Entrega", "duration": "string", "objective": "string", "actions": ["string"], "content": [], "successIndicator": "string" },
  "offer": {
    "name": "string — nome da oferta",
    "positioning": "string — como posicionar como early adopter, não como beta barato",
    "price": 0,
    "priceRationale": "string — por que este preço e qual o preço final prometido",
    "bonuses": ["string"],
    "guarantee": "string",
    "deadline": "string",
    "slots": 0,
    "slotsRationale": "string — por que este número de vagas é real e não artificial",
    "paymentOptions": ["string"],
    "cartOpenMessage": "string — mensagem completa de abertura do carrinho",
    "cartCloseMessage": "string — mensagem completa de fechamento"
  },
  "contentPillars": [
    {
      "pillar": "string — nome do pilar de conteúdo",
      "rationale": "string — por que este pilar aquece para este produto",
      "examples": ["string — título de post/email/live concreto"]
    }
  ],
  "communityStrategy": {
    "platform": "whatsapp|telegram|circle|discord|facebook",
    "groupName": "string",
    "initialSize": 0,
    "engagementRules": ["string"],
    "weeklyRituals": ["string"]
  },
  "liveStrategy": {
    "numberOfLives": 0,
    "topics": ["string"],
    "platform": "string",
    "timing": "string",
    "conversionMoment": "string — quando e como fazer o CTA durante a live"
  },
  "testimonialsStrategy": "string — como e quando coletar os primeiros depoimentos da turma beta",
  "nextLaunchFoundation": "string — o que este semente constrói para o próximo lançamento maior",
  "criticalRisks": ["string — riscos reais e como mitigar"],
  "successMetrics": {
    "minRevenue": "string",
    "minStudents": "string",
    "targetOpenRate": "string",
    "targetClickRate": "string",
    "liveAttendanceTarget": "string"
  }
}
\`\`\``;

export async function runSementeLaunchAgent(
  campaignId: string | null,
  workspaceId: string,
  productIdea: string,
  targetAudience: string,
  creatorBackground: string,
  audienceSize: number,
  existingList: boolean,
  ticketRange: string,
  log: Logger,
  strategy?: StrategyOutput,
  profile?: ProfileBuilderOutput,
): Promise<SementeLaunchOutput> {
  const avatarBlock = profile ? `

**AVATAR PRIMÁRIO (use as palavras DELES):**
- Perfil: ${profile.primaryAvatar?.name ?? ""} — ${profile.primaryAvatar?.occupation ?? ""}
- Desejo mais profundo: ${profile.primaryAvatar?.deepestDesire ?? ""}
- Dores diárias: ${(profile.primaryAvatar?.dailyPains ?? []).slice(0, 4).join("; ")}
- Palavras que usa: ${(profile.primaryAvatar?.keywordsTheyUse ?? []).slice(0, 8).join(", ")}
- Tom de linguagem: ${profile.primaryAvatar?.languageStyle ?? ""}
- Big Idea: ${profile.positioning?.campaignBigIdea ?? ""}
- Mecanismo único: ${profile.positioning?.uniqueMechanism ?? ""}` : "";

  const bigDominoBlock = strategy ? `

**BIG DOMINO E ESTRATÉGIA:**
- Crença central a instalar: ${(strategy as any).triggerMap?.dominantTrigger ?? strategy.campaignArchitecture?.coreNarrative ?? ""}
- Sequência de gatilhos: ${((strategy as any).triggerMap?.triggerStackSequence ?? []).join(" → ")}
- Posicionamento da oferta: ${strategy.offerPositioning?.uniqueValueProposition ?? ""}` : "";

  const userMessage = `Estruture o lançamento semente completo para validar e vender este produto.
${avatarBlock}${bigDominoBlock}

**Ideia do produto:** ${productIdea}
**Público-alvo:** ${targetAudience}
**Background do criador:** ${creatorBackground}
**Tamanho da audiência atual:** ${audienceSize} pessoas
**Lista própria existe?** ${existingList ? "Sim" : "Não — precisará construir durante o pré-lançamento"}
**Ticket-alvo:** ${ticketRange}

**PROCESSO:**
1. Defina a hipótese de validação (o que você está testando)
2. Estruture o pré-lançamento com conteúdo que desperta interesse sem vender
3. Crie a fase de conteúdo PLC completa (emails + WhatsApp + posts) — copy real, não esqueleto
4. Estruture a oferta de semente com posicionamento de early adopter
5. Planeje as lives de vendas (tópico + CTA + momento de conversão)
6. Defina o que a turma beta vai co-criar
7. Mapeie os riscos críticos específicos para este produto e audiência

Seja específico e brasileiro — use referências PLF/Érico Rocha onde relevante.
Retorne APENAS JSON.`;

  const systemPrompt = COGNITIVE_IDENTITY_COPYWRITER + SEMENTE_LAUNCH_PROMPT;

  let content: string;

  if (campaignId) {
    const critique = await runAgentWithCritique({
      campaignId,
      workspaceId,
      agentRole: "semente_launch",
      systemPrompt,
      userMessage,
      log,
    });
    content = critique.refinedOutput;
  } else {
    const result = await runAgent({
      campaignId: null,
      workspaceId,
      agentRole: "semente_launch",
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      log,
      thinkingMessages: [
        "Definindo hipótese de validação do semente...",
        "Estruturando fase de pré-lançamento e conteúdo PLC...",
        "Criando oferta de early adopter e posicionamento...",
        "Planejando lives de vendas e estratégia de comunidade...",
        "Mapeando riscos e fundação para próximo lançamento...",
      ],
    });
    content = result.content;
  }

  return parseAgentJSON<SementeLaunchOutput>(content, {
    productConcept: productIdea,
    validationHypothesis: "",
    targetRevenue: 0,
    targetStudents: 10,
    launchDuration: "21 dias",
    prelaunchPhase: { name: "Pré-Lançamento", duration: "7 dias", objective: "", actions: [], content: [], successIndicator: "" },
    contentPhase: { name: "Fase de Conteúdo", duration: "5 dias", objective: "", actions: [], content: [], successIndicator: "" },
    launchPhase: { name: "Abertura do Carrinho", duration: "4 dias", objective: "", actions: [], content: [], successIndicator: "" },
    betaPhase: { name: "Beta / Entrega", duration: "30 dias", objective: "", actions: [], content: [], successIndicator: "" },
    offer: {
      name: "",
      positioning: "",
      price: 0,
      priceRationale: "",
      bonuses: [],
      guarantee: "7 dias",
      deadline: "",
      slots: 20,
      slotsRationale: "",
      paymentOptions: [],
      cartOpenMessage: "",
      cartCloseMessage: "",
    },
    contentPillars: [],
    communityStrategy: { platform: "whatsapp", groupName: "", initialSize: 0, engagementRules: [], weeklyRituals: [] },
    liveStrategy: { numberOfLives: 2, topics: [], platform: "Instagram/YouTube", timing: "", conversionMoment: "" },
    testimonialsStrategy: "",
    nextLaunchFoundation: "",
    criticalRisks: [],
    successMetrics: {},
  });
}

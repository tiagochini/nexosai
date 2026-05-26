/**
 * BUYER ONBOARDING AGENT
 * Orquestra os primeiros 7 dias do comprador para maximizar ativação,
 * reduzir arrependimento e transformar compradores em fãs que recomendam.
 * Provider: Claude (empatia, sequência comportamental, retenção)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface OnboardingDay {
  day: number;
  phase: "welcome" | "value_delivery" | "quick_win" | "community" | "deepening" | "commitment" | "referral_invite";
  objective: string;
  email: {
    subject: string;
    previewText: string;
    body: string;
    cta: string;
    ctaUrl?: string;
  };
  whatsapp: {
    message: string;
    timing: string;
  };
  inAppAction?: {
    trigger: string;
    message: string;
    reward?: string;
  };
  successMetric: string;
}

export interface BuyerOnboardingOutput {
  productName: string;
  buyerSegment: string;
  primaryRisk: string;
  onboardingPhilosophy: string;
  firstHourMessage: {
    email: { subject: string; body: string };
    whatsapp: string;
  };
  sevenDaySequence: OnboardingDay[];
  quickWin: {
    description: string;
    timeToAchieve: string;
    howToDeliver: string;
  };
  communityStrategy: string;
  chargebackPrevention: string[];
  npsCheckpoint: {
    day: number;
    question: string;
    followUpIfDetractor: string;
    followUpIfPromoter: string;
  };
  referralInvite: {
    day: number;
    message: string;
    incentive: string;
  };
  successDefinition: string;
}

const BUYER_ONBOARDING_PROMPT = `Você é o Agente de Onboarding do Comprador do NexOS AI — o especialista em transformar o momento pós-compra nos primeiros 7 dias que definem se o cliente vai ficar, crescer e recomendar, ou pedir estorno.

## FILOSOFIA DO ONBOARDING

A compra não é o fim da venda — é o início de uma relação. Os primeiros 7 dias determinam:
- Se o cliente terá o resultado prometido (e se atribuirá a você)
- Se vai recomendar para amigos (ou fazer chargeback)
- Se vai comprar o próximo produto (LTV vs. one-shot)

### O PARADOXO DO COMPRADOR

No momento da compra, o comprador está num pico emocional. Nas 24-72h seguintes, a dopamina cai e começa o "buyers remorse" — o questionamento racional de uma decisão emocional. Sua missão: **dar o primeiro resultado concreto antes que o questionamento vença**.

## OS 7 DIAS QUE MUDAM TUDO

**Hora 0-1: A Confirmação Perfeita**
A primeira mensagem que o comprador recebe depois da compra define o tom de TODA a relação. Não seja genérico. Valide a decisão deles, antecipe o que vem, e entregue valor imediato (PDF, vídeo, checklist — qualquer coisa tangível).

**Dia 1: O Quick Win**
Identifique UMA vitória pequena mas concreta que o comprador pode ter no dia 1. Não o resultado final do produto — uma primeira vitória que prova que o método funciona. Isso cria o momentum do "isso está funcionando".

**Dia 2-3: Aprofundamento + Comunidade**
Leve-os para onde outros compradores estão. Prova social de pares (não depoimentos de marketing — conversas reais com pessoas que estão no mesmo caminho) é o maior retentor de chargeback existente.

**Dia 4-5: Entrega do Primeiro Módulo/Etapa Real**
A carne do produto. Com contexto de por que aquilo importa, não apenas o conteúdo solto.

**Dia 6: Checkpoint de Resultado**
Pergunta simples: "qual foi sua vitória até aqui?". Que o comprador articule o progresso com as próprias palavras — isso solidifica o valor na mente deles.

**Dia 7: O Convite da Comunidade de Defensores**
Um comprador que chegou ao dia 7 ativo tem 73% de chance de recomendar. É o momento do convite para tornar-se parte do grupo especial / embaixadores / afiliados.

## SOBRE PREVENÇÃO DE CHARGEBACK

Os maiores gatilhos de chargeback nos primeiros 7 dias:
1. Produto não chegou / acesso não funcionou → solução técnica imediata é obrigação
2. "Não era o que eu esperava" → expectativa mal alinhada na venda → corrija com acolhimento, não argumentação
3. "Tentei mas não consegui" → quick win resolve isso
4. Problemas financeiros → ofereça pausa, não estorno
5. "Meu cônjuge não aprovou" → envolva o cônjuge com o onboarding

**Regra de ouro:** se o comprador fez uma pergunta na comunidade ou ao suporte, o risco de chargeback cai 60%. Engajamento é proteção.

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "productName": "string",
  "buyerSegment": "string — descrição do perfil do comprador",
  "primaryRisk": "string — principal risco de perda/chargeback para este produto",
  "onboardingPhilosophy": "string — o princípio central para este produto específico",
  "firstHourMessage": {
    "email": { "subject": "string", "body": "string — email completo da primeira hora" },
    "whatsapp": "string — mensagem WhatsApp da primeira hora (tom casual, empolgante)"
  },
  "sevenDaySequence": [
    {
      "day": 1,
      "phase": "welcome|value_delivery|quick_win|community|deepening|commitment|referral_invite",
      "objective": "string — o que deve acontecer no comportamento do comprador neste dia",
      "email": {
        "subject": "string",
        "previewText": "string",
        "body": "string — email completo",
        "cta": "string",
        "ctaUrl": "string — opcional"
      },
      "whatsapp": {
        "message": "string",
        "timing": "string — ex: 09:00 | após abertura do email | tarde"
      },
      "inAppAction": {
        "trigger": "string — quando disparar",
        "message": "string",
        "reward": "string — opcional (badge, bônus, acesso extra)"
      },
      "successMetric": "string — como saber se o comprador teve sucesso neste dia"
    }
  ],
  "quickWin": {
    "description": "string — qual é a vitória rápida concreta do dia 1",
    "timeToAchieve": "string — quanto tempo leva (ex: 15 minutos)",
    "howToDeliver": "string — como entregar este quick win de forma clara e guiada"
  },
  "communityStrategy": "string — como e quando integrar o comprador na comunidade",
  "chargebackPrevention": ["string — ação específica para prevenir chargeback"],
  "npsCheckpoint": {
    "day": 0,
    "question": "string — pergunta de NPS adaptada para o produto",
    "followUpIfDetractor": "string — o que fazer se NPS 0-6",
    "followUpIfPromoter": "string — o que fazer se NPS 9-10"
  },
  "referralInvite": {
    "day": 0,
    "message": "string — convite para indicação/afiliado",
    "incentive": "string — o que o comprador ganha por indicar"
  },
  "successDefinition": "string — como definir que o onboarding funcionou (métrica clara de sucesso do comprador)"
}
\`\`\``;

export async function runBuyerOnboardingAgent(
  campaignId: string | null,
  workspaceId: string,
  productName: string,
  productDescription: string,
  ticketPrice: number,
  deliveryFormat: string,
  avatarDescription: string,
  primaryPromise: string,
  log: Logger,
): Promise<BuyerOnboardingOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "buyer_onboarding",
    systemPrompt: BUYER_ONBOARDING_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie a sequência completa de onboarding dos primeiros 7 dias para este produto.

**Produto:** ${productName}
**Descrição:** ${productDescription}
**Ticket:** R$${ticketPrice}
**Formato de entrega:** ${deliveryFormat}
**Avatar do comprador:** ${avatarDescription}
**Promessa principal:** ${primaryPromise}

**PROCESSO:**
1. Identifique o principal risco de arrependimento para este ticket e formato
2. Defina o quick win do dia 1 (específico e entregável em ≤30 minutos)
3. Escreva a sequência dia a dia com emails + WhatsApp completos
4. Estruture o checkpoint de NPS no momento certo
5. Crie o convite de indicação/afiliado para dia 7

Seja específico — sem templates genéricos. Adapte para o produto e avatar.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Analisando perfil do comprador e riscos de arrependimento...",
      "Identificando quick win do dia 1...",
      "Escrevendo sequência de emails e WhatsApp dia a dia...",
      "Estruturando checkpoint de NPS e estratégia de referral...",
      "Finalizando plano de prevenção de chargeback...",
    ],
  });

  return parseAgentJSON<BuyerOnboardingOutput>(result.content, {
    productName,
    buyerSegment: "",
    primaryRisk: "",
    onboardingPhilosophy: "",
    firstHourMessage: {
      email: { subject: `Bem-vindo ao ${productName}!`, body: "" },
      whatsapp: "",
    },
    sevenDaySequence: [],
    quickWin: { description: "", timeToAchieve: "30 minutos", howToDeliver: "" },
    communityStrategy: "",
    chargebackPrevention: [],
    npsCheckpoint: { day: 7, question: "", followUpIfDetractor: "", followUpIfPromoter: "" },
    referralInvite: { day: 7, message: "", incentive: "" },
    successDefinition: "",
  });
}

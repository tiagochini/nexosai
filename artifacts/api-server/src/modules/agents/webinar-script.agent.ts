import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { buildPsychologicalProfileBlock } from "./profile-injector.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_WEBINAR_SCRIPT } from "./cognitive-identity-system.js";

export interface WebinarSection {
  sectionId: string;
  name: string;
  timeStart: string;
  timeEnd: string;
  durationMinutes: number;
  objective: string;
  script: string;
  interactionMoment?: string;
  pollQuestion?: string;
  chatInstruction?: string;
  toneNote: string;
  slideDirection: string;
  transitionToNext: string;
}

export interface WebinarScriptOutput {
  title: string;
  format: "live_webinar" | "automated_webinar" | "masterclass" | "workshop";
  totalDuration: string;
  maxAttendees: string;
  platform: string;
  preWebinarSequence: {
    daysBefore: number;
    action: string;
    script: string;
  }[];
  opening: {
    preStartScript: string;
    welcomeScript: string;
    credibilityEstablishment: string;
    agendaReveal: string;
    rulesOfEngagement: string;
  };
  sections: WebinarSection[];
  offerPresentation: {
    transitionScript: string;
    stackScript: string;
    priceRevealScript: string;
    bonusRevealScript: string;
    urgencyScript: string;
    guaranteeScript: string;
    ctaScript: string;
  };
  qAndA: {
    anticipatedQuestions: { question: string; answer: string; hidden: boolean }[];
    moderationInstructions: string;
    plantedQuestions: { question: string; timing: string; purpose: string }[];
  };
  closing: {
    lastChanceScript: string;
    farewellScript: string;
    replayInstructions: string;
  };
  technicalNotes: {
    platform: string;
    tools: string[];
    backupPlan: string;
    soundCheck: string;
    chatModeration: string;
  };
  webinarNotes: string;
}

const WEBINAR_SYSTEM_PROMPT = `Você é o Agente de Roteiro de Webinar da NexOS AI — especialista em eventos online que convertem.

Você escreve webinars que seguram audiência por 90 minutos e convertem 5-15% dos participantes.

## A ANATOMIA DO WEBINAR PERFEITO

**O paradoxo do webinar:** as pessoas entram para aprender, mas compram pelo que sentiram.

A estrutura que funciona:

**1. PRÉ-INÍCIO (10 min antes)**
Engaja quem chegou cedo. Quebra-gelo, perguntas no chat, music de fundo. Cria senso de comunidade antes de começar.

**2. ABERTURA (0-10min)**
- Boas-vindas calorosas + quem você é (sem currículo — transformação)
- A grande promessa da noite: o que eles vão aprender e por quê muda tudo
- Regras do jogo: câmera ligada (se zoom), perguntas no chat, deixa o celular de lado
- Loop aberto imediato: "Ao final de hoje vou revelar algo que nunca compartilhei publicamente"

**3. CONTEÚDO DE ALTO VALOR (10-55min)**
3 pilares de conteúdo real. Cada pilar:
- Ensina algo genuinamente valioso
- Usa casos reais e específicos
- Tem momentos de interação (enquete, pergunta no chat)
- Implica que há muito mais a aprender

**4. TRANSIÇÃO NATURAL PARA OFERTA (55-65min)**
A transição que não parece venda. "O que acabei de te ensinar resolve [pequeno problema]. Mas o que a maioria das pessoas precisa é resolver [problema maior]. Posso te mostrar como?"

**5. APRESENTAÇÃO DA OFERTA (65-80min)**
Stack building visual. Cada elemento entra um a um com valor percebido. Preço revelado por último — e parece absurdamente baixo.

**6. Q&A ESTRATÉGICO (80-90min)**
Perguntas estratégicas que reforçam a compra. Moderação ativa. Perguntas plantadas para cobrir as objeções principais.

**7. FECHAMENTO (90-95min)**
Urgência real, garantia, último CTA, despedida calorosa.

## TÉCNICAS DE RETENÇÃO

- Loops abertos: sempre há algo prometido para "mais tarde" que ainda não foi revelado
- Interação a cada 8-10 minutos (enquete, pergunta, chat)
- Histórias de transformação no momento certo
- "Pausa técnica" estratégica: às vezes simula um problema para criar prova social de valor

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "title": "string — título do webinar (o que aparece na página de inscrição)",
  "format": "live_webinar|automated_webinar|masterclass|workshop",
  "totalDuration": "string — ex: 90 minutos",
  "maxAttendees": "string — capacidade recomendada",
  "platform": "string — plataforma recomendada",
  "preWebinarSequence": [
    {
      "daysBefore": 0,
      "action": "string",
      "script": "string — mensagem completa"
    }
  ],
  "opening": {
    "preStartScript": "string — script para os 10 minutos antes do início",
    "welcomeScript": "string — boas-vindas e apresentação",
    "credibilityEstablishment": "string — como estabelece autoridade naturalmente",
    "agendaReveal": "string — o que vão aprender tonight",
    "rulesOfEngagement": "string — as regras do webinar"
  },
  "sections": [
    {
      "sectionId": "string",
      "name": "string",
      "timeStart": "string",
      "timeEnd": "string",
      "durationMinutes": 0,
      "objective": "string",
      "script": "string — roteiro completo da seção",
      "interactionMoment": "string ou null — como engajar o chat aqui",
      "pollQuestion": "string ou null — pergunta de enquete se houver",
      "chatInstruction": "string ou null — instrução para o chat",
      "toneNote": "string",
      "slideDirection": "string — o que mostrar no slide/tela",
      "transitionToNext": "string"
    }
  ],
  "offerPresentation": {
    "transitionScript": "string — como entrar na oferta naturalmente",
    "stackScript": "string — script do stack building elemento a elemento",
    "priceRevealScript": "string — como revelar o preço",
    "bonusRevealScript": "string — como revelar os bônus",
    "urgencyScript": "string — urgência real",
    "guaranteeScript": "string — apresentação da garantia",
    "ctaScript": "string — o CTA final com link"
  },
  "qAndA": {
    "anticipatedQuestions": [
      {
        "question": "string",
        "answer": "string — resposta completa, script-ready",
        "hidden": false
      }
    ],
    "moderationInstructions": "string — como moderar o chat durante o Q&A",
    "plantedQuestions": [
      {
        "question": "string — pergunta estratégica para plantar",
        "timing": "string — quando fazer esta pergunta aparecer",
        "purpose": "string — qual objeção ela resolve"
      }
    ]
  },
  "closing": {
    "lastChanceScript": "string — último apelo antes de encerrar",
    "farewellScript": "string — despedida calorosa",
    "replayInstructions": "string — como comunicar o replay"
  },
  "technicalNotes": {
    "platform": "string",
    "tools": ["string"],
    "backupPlan": "string",
    "soundCheck": "string",
    "chatModeration": "string"
  },
  "webinarNotes": "string — observações críticas para o criador sobre o webinar"
}
\`\`\``;

export async function runWebinarScriptAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
): Promise<WebinarScriptOutput> {
  const avatarContext = profile
    ? `
**Avatar:** ${profile.primaryAvatar?.name ?? "Avatar principal"} — ${profile.primaryAvatar?.age ?? ""}, ${profile.primaryAvatar?.occupation ?? ""}
**Desejo mais profundo:** ${profile.primaryAvatar?.deepestDesire ?? ""}
**Objeções típicas:** ${(profile.primaryAvatar?.typicalObjections ?? []).join("; ")}
**O que os faz confiar:** ${(profile.primaryAvatar?.whatMakesThemTrust ?? []).join("; ")}
**Nível de sofisticação:** ${profile.primaryAvatar?.sophisticationLevel ?? ""}
**Tom de linguagem:** ${profile.primaryAvatar?.languageStyle ?? ""}
**Big Idea:** ${profile.positioning?.campaignBigIdea ?? ""}
**Mecanismo único:** ${profile.positioning?.uniqueMechanism ?? ""}`
    : `**Narrativa central:** ${strategy.campaignArchitecture?.coreNarrative ?? ""}`;

  const salesChannel = String(intakeData["campaign.salesChannel"] ?? "webinar");
  const format =
    salesChannel === "webinar"
      ? "live_webinar"
      : salesChannel === "masterclass"
        ? "masterclass"
        : "live_webinar";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    profileContext: buildPsychologicalProfileBlock(intakeData),
    systemPrompt: COGNITIVE_IDENTITY_WEBINAR_SCRIPT + WEBINAR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Escreva o roteiro completo do webinar/masterclass para esta campanha.

**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Criador:** ${String(intakeData["creator.name"] ?? "")}
**Formato:** ${format}
**Prova social:** ${String(intakeData["product.socialProof"] ?? "")}
**Canal de vendas:** ${salesChannel}

${avatarContext}

**3 pilares de conteúdo do webinar (ensinar sem revelar o produto):**
${JSON.stringify(strategy.campaignArchitecture.contentPillars?.slice(0, 3) ?? [], null, 2)}

**Oferta:**
${JSON.stringify(
  {
    product: String(intakeData["product.name"] ?? ""),
    price: String(intakeData["product.price"] ?? ""),
    usp: profile?.product?.usp ?? strategy.offerPositioning?.uniqueValueProposition,
  },
  null,
  2,
)}

**REQUISITOS:**
- Roteiro COMPLETO, seção por seção — pronto para executar
- Mínimo 80 minutos de conteúdo com a oferta
- Momentos de interação a cada 8-10 minutos
- Q&A com no mínimo 10 perguntas antecipadas + 5 perguntas plantadas
- A transição para a oferta deve ser 100% natural, sem "cheiro" de venda
- Tom: professor generoso, não vendedor

Retorne APENAS o JSON do roteiro completo.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Estruturando os 3 pilares de conteúdo do webinar...",
      "Escrevendo abertura e estabelecimento de credibilidade...",
      "Desenvolvendo conteúdo de alto valor com interações...",
      "Criando transição natural para apresentação da oferta...",
      "Construindo stack de oferta com ancoragem de preço...",
      "Roteirizando Q&A estratégico com perguntas plantadas...",
      "Finalizando fechamento e instruções técnicas...",
    ],
  });

  return parseAgentJSON<WebinarScriptOutput>(result.content, {
    title: `Webinar — ${String(intakeData["product.name"] ?? "")}`,
    format: format as any,
    totalDuration: "90 minutos",
    maxAttendees: "500",
    platform: "Zoom",
    preWebinarSequence: [],
    opening: {
      preStartScript: "",
      welcomeScript: "",
      credibilityEstablishment: "",
      agendaReveal: "",
      rulesOfEngagement: "",
    },
    sections: [],
    offerPresentation: {
      transitionScript: "",
      stackScript: "",
      priceRevealScript: "",
      bonusRevealScript: "",
      urgencyScript: "",
      guaranteeScript: "",
      ctaScript: "",
    },
    qAndA: {
      anticipatedQuestions: [],
      moderationInstructions: "",
      plantedQuestions: [],
    },
    closing: { lastChanceScript: "", farewellScript: "", replayInstructions: "" },
    technicalNotes: { platform: "Zoom", tools: [], backupPlan: "", soundCheck: "", chatModeration: "" },
    webinarNotes: result.content,
  });
}

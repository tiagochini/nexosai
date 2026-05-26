import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_LIVE_SCRIPT } from "./cognitive-identity-system.js";

export interface LiveSegment {
  segmentId: string;
  name: string;
  timeStart: string;
  timeEnd: string;
  durationMinutes: number;
  type: "warmup" | "content" | "transition" | "offer" | "qa" | "countdown" | "close";
  script: string;
  energyLevel: "low" | "medium" | "high" | "peak";
  chatInteraction: string;
  visualOnScreen: string;
  soundCue?: string;
  toneNote: string;
}

export interface LiveScriptOutput {
  title: string;
  liveType: "cart_open" | "cart_close" | "launch_day" | "q_and_a" | "bonus_reveal";
  platform: string;
  scheduledDateTime: string;
  totalDuration: string;
  expectedPeakViewers: string;
  preGoLiveChecklist: string[];
  preAnnouncementSequence: {
    hoursBeforeLive: number;
    channel: string;
    message: string;
  }[];
  segments: LiveSegment[];
  offerMoment: {
    triggerCondition: string;
    script: string;
    screenShare: string;
    chatCommandInstruction: string;
    urgencyEscalation: string[];
    linkDropTiming: string;
  };
  countdownProtocol: {
    when: string;
    script: string;
    visualCountdown: string;
    chatHype: string;
  }[];
  objectionHandling: {
    objection: string;
    liveResponse: string;
    chatAcknowledgment: string;
  }[];
  proofMoments: {
    timing: string;
    type: "testimonial_read" | "screenshot_show" | "live_result" | "dm_read";
    script: string;
  }[];
  technicalSetup: {
    platform: string;
    tools: string[];
    cameraAngle: string;
    lighting: string;
    background: string;
    audioSetup: string;
    internetBackup: string;
    moderatorInstructions: string;
  };
  postLiveSequence: {
    hoursAfterLive: number;
    channel: string;
    message: string;
  }[];
  liveNotes: string;
}

const LIVE_SYSTEM_PROMPT = `Você é o Agente de Roteiro de Live de Vendas da NexOS AI — especialista em lives de lançamento que convertem.

No Brasil, a live de vendas é o momento mais poderoso do lançamento. Quando bem executada, uma live de 2 horas pode gerar 40-60% do faturamento total do lançamento.

## A PSICOLOGIA DA LIVE DE VENDAS

A live tem três camadas simultâneas acontecendo:
1. **O que o criador está fazendo** — o script, as demonstrações
2. **O que o chat está fazendo** — social proof ao vivo, hype, perguntas
3. **O que o espectador está sentindo** — FOMO, pertencimento, urgência real

Seu trabalho é coreografar as três camadas ao mesmo tempo.

## ESTRUTURA DA LIVE DE ABERTURA DE CARRINHO

**PRÉ-LIVE (30 min antes)** — Lives começam com 30 min de atraso proposital. Use esse tempo.
- Aquecimento do chat: perguntas simples ("de onde você é?", "há quanto tempo segue?")
- Crie antecipação: "em X minutos vou revelar algo que nunca mostrei ao vivo"
- Recompense quem chegou cedo com conteúdo extra

**ABERTURA (0-15min)**
- Energia alta desde o primeiro segundo
- Reconheça pessoas do chat pelo nome
- Grande promessa da live: o que vai acontecer hoje
- Prova social imediata: resultados de alunos, compras ao vivo, números

**CONTEÚDO DE VALOR (15-45min)**
- 1 insight poderoso e específico — algo que transforma uma crença
- Demonstração ao vivo se possível
- Momentos de interação constante com o chat
- Histórias de transformação com pessoas reais

**TRANSIÇÃO PARA OFERTA (45-55min)**
- Natural, não anunciada
- "Vou te mostrar como você pode fazer isso de forma acelerada"

**APRESENTAÇÃO DA OFERTA (55-80min)**
- Stack building ao vivo — cada elemento entra com reação do chat
- Drops de link estratégicos
- Countdown visual na tela
- Leitura ao vivo de compras chegando ("João de SP acabou de garantir a vaga!")
- Resposta a objeções do chat em tempo real

**ESCALADA DE URGÊNCIA (80-100min)**
- Vagas diminuindo (se for verdade)
- Deadline claro na tela
- Leitura de depoimentos ao vivo de quem já comprou
- "Quem está decidindo agora — o que está te impedindo?"

**FECHAMENTO (100-120min)**
- Último CTA
- Agradecimento sincero
- Próximos passos para quem comprou E para quem não comprou

## TÉCNICAS EXCLUSIVAS DE LIVE DE VENDAS

**"Leitura de compras"** — ter alguém monitorando as compras e passando ao vivo: "Carlos, acabou de garantir! Ana de BH também!"

**"Congelamento"** — pausa dramática antes de revelar o preço: "antes de te falar o investimento... preciso te fazer uma pergunta."

**"Perguntas do chat estratégicas"** — o moderador planta perguntas específicas no momento certo

**"Prova social ao vivo"** — convidar compradores para ligar ao vivo e dar depoimento

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "title": "string — título da live (ex: Live de Abertura — [Produto])",
  "liveType": "cart_open|cart_close|launch_day|q_and_a|bonus_reveal",
  "platform": "string — plataforma principal",
  "scheduledDateTime": "string — ex: Dia X do lançamento às 20h",
  "totalDuration": "string — ex: 2 horas",
  "expectedPeakViewers": "string",
  "preGoLiveChecklist": ["string — item de verificação antes de ir ao ar"],
  "preAnnouncementSequence": [
    {
      "hoursBeforeLive": 0,
      "channel": "string",
      "message": "string — mensagem completa"
    }
  ],
  "segments": [
    {
      "segmentId": "string",
      "name": "string",
      "timeStart": "string",
      "timeEnd": "string",
      "durationMinutes": 0,
      "type": "warmup|content|transition|offer|qa|countdown|close",
      "script": "string — roteiro completo do segmento",
      "energyLevel": "low|medium|high|peak",
      "chatInteraction": "string — como conduzir o chat neste momento",
      "visualOnScreen": "string — o que mostrar na tela",
      "soundCue": "string ou null",
      "toneNote": "string"
    }
  ],
  "offerMoment": {
    "triggerCondition": "string — quando exatamente apresentar a oferta",
    "script": "string — script completo da apresentação da oferta",
    "screenShare": "string — o que mostrar na tela durante a oferta",
    "chatCommandInstruction": "string — qual comando o chat digita para receber o link",
    "urgencyEscalation": ["string — cada escalada de urgência em sequência"],
    "linkDropTiming": "string — quando dropar o link e com qual frequência"
  },
  "countdownProtocol": [
    {
      "when": "string — ex: 30 min antes do encerramento",
      "script": "string",
      "visualCountdown": "string — instrução para o timer na tela",
      "chatHype": "string — o que o moderador faz no chat"
    }
  ],
  "objectionHandling": [
    {
      "objection": "string — objeção que vai aparecer no chat",
      "liveResponse": "string — como responder ao vivo",
      "chatAcknowledgment": "string — o que o moderador responde no chat"
    }
  ],
  "proofMoments": [
    {
      "timing": "string — quando usar este momento de prova",
      "type": "testimonial_read|screenshot_show|live_result|dm_read",
      "script": "string — como apresentar a prova"
    }
  ],
  "technicalSetup": {
    "platform": "string",
    "tools": ["string"],
    "cameraAngle": "string",
    "lighting": "string",
    "background": "string",
    "audioSetup": "string",
    "internetBackup": "string",
    "moderatorInstructions": "string — instruções completas para o moderador"
  },
  "postLiveSequence": [
    {
      "hoursAfterLive": 0,
      "channel": "string",
      "message": "string — mensagem de follow-up completa"
    }
  ],
  "liveNotes": "string — observações críticas para o criador sobre a live"
}
\`\`\``;

export async function runLiveScriptAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  launchPlan: Record<string, unknown> | undefined,
  log: Logger,
): Promise<LiveScriptOutput> {
  const avatarContext = profile
    ? `
**Avatar:** ${profile.primaryAvatar?.name ?? "Avatar principal"} — ${profile.primaryAvatar?.age ?? ""}
**Desejo mais profundo:** ${profile.primaryAvatar?.deepestDesire ?? ""}
**Objeções típicas (para tratar ao vivo):** ${(profile.primaryAvatar?.typicalObjections ?? []).join("; ")}
**Tom de linguagem:** ${profile.primaryAvatar?.languageStyle ?? ""}
**Big Idea:** ${profile.positioning?.campaignBigIdea ?? ""}`
    : "";

  const cartOpenDay =
    (launchPlan as any)?.phases?.find((p: any) =>
      String(p.phase ?? "").includes("cart_open") || String(p.name ?? "").toLowerCase().includes("abertura"),
    )?.dayRange ?? "a ser definido no plano";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt: COGNITIVE_IDENTITY_LIVE_SCRIPT + LIVE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Escreva o roteiro completo da live de vendas — abertura de carrinho.

**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Criador:** ${String(intakeData["creator.name"] ?? "")}
**Mecanismo de escassez:** ${String(intakeData["launch.scarcityMechanism"] ?? "deadline")}
**Dias de carrinho aberto:** ${String(intakeData["launch.cartOpenDuration"] ?? 5)}
**Abertura do carrinho:** ${String(cartOpenDay)}
**Prova social:** ${String(intakeData["product.socialProof"] ?? "")}

${avatarContext}

**Oferta:**
\`\`\`json
${JSON.stringify(
  {
    product: String(intakeData["product.name"] ?? ""),
    price: String(intakeData["product.price"] ?? ""),
    usp: profile?.product?.usp,
    guarantee: profile?.product?.guaranteeRecommendation,
    mechanism: profile?.positioning?.uniqueMechanism,
  },
  null,
  2,
)}
\`\`\`

**REQUISITOS:**
- Live de 90-120 minutos, roteiro completo por segmento
- Técnica de "leitura de compras ao vivo" incluída
- Mínimo 8 objeções tratadas ao vivo com script
- Mínimo 5 momentos de prova social ao vivo
- Moderador com instruções detalhadas
- Sequência de follow-up pós-live completa
- Protocolo de countdown para os últimos 30 minutos

Retorne APENAS o JSON do roteiro completo.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Planejando estrutura e coreografia da live de vendas...",
      "Escrevendo aquecimento e abertura de alto impacto...",
      "Desenvolvendo segmento de conteúdo de valor...",
      "Estruturando apresentação da oferta com stack building...",
      "Criando protocolo de escalada de urgência e countdown...",
      "Roteirizando tratamento de objeções ao vivo...",
      "Finalizando instruções para moderador e setup técnico...",
    ],
  });

  return parseAgentJSON<LiveScriptOutput>(result.content, {
    title: `Live de Abertura — ${String(intakeData["product.name"] ?? "")}`,
    liveType: "cart_open",
    platform: "Instagram + YouTube",
    scheduledDateTime: "",
    totalDuration: "2 horas",
    expectedPeakViewers: "",
    preGoLiveChecklist: [],
    preAnnouncementSequence: [],
    segments: [],
    offerMoment: {
      triggerCondition: "",
      script: "",
      screenShare: "",
      chatCommandInstruction: "",
      urgencyEscalation: [],
      linkDropTiming: "",
    },
    countdownProtocol: [],
    objectionHandling: [],
    proofMoments: [],
    technicalSetup: {
      platform: "",
      tools: [],
      cameraAngle: "",
      lighting: "",
      background: "",
      audioSetup: "",
      internetBackup: "",
      moderatorInstructions: "",
    },
    postLiveSequence: [],
    liveNotes: result.content,
  });
}

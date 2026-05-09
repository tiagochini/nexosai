import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface VSLSection {
  sectionId: string;
  name: string;
  timeStart: string;
  timeEnd: string;
  durationMinutes: number;
  objective: string;
  script: string;
  toneNotes: string;
  visualDirection: string;
  psychologicalPrinciple: string;
  transitionToNext: string;
}

export interface VSLOutput {
  title: string;
  totalDuration: string;
  totalWordCount: number;
  format: "vsl" | "webinar" | "masterclass" | "challenge_day";
  hook: {
    openingLine: string;
    problemStatement: string;
    bigPromise: string;
    credentialEstablishment: string;
  };
  sections: VSLSection[];
  offerReveal: {
    timing: string;
    approach: string;
    stackPresentation: string;
    priceAnchor: string;
    priceReveal: string;
    urgencyMechanism: string;
  };
  ctas: {
    primary: string;
    secondary: string;
    urgencyLine: string;
    guaranteeStatement: string;
  };
  technicalNotes: {
    recommendedLength: string;
    pacing: string;
    backgroundMusic: string;
    captionRecommendation: string;
    thumbnailDirection: string;
  };
  vslNotes: string;
}

const VSL_SCRIPT_PROMPT = `Você é o Agente de Roteiro VSL da NexOS AI — especialista em Video Sales Letters que convertem.

Você escreve roteiros com a estrutura de Frank Kern, a narrativa de Russell Brunson e o entendimento cultural brasileiro para ressoar perfeitamente com a audiência local.

## A ANATOMIA DO VSL PERFEITO

**A estrutura que converte:**

1. **HOOK (0-30s)** — A frase que prende. Uma promessa ou afirmação inesperada que força a pessoa a continuar assistindo. Exemplo: "O que vou te mostrar nos próximos 20 minutos contraria tudo que te ensinaram sobre [X]"

2. **PROBLEMA (30s-3min)** — Mergulha na dor. Não descreve o problema — VIVE o problema. O avatar se vê na tela e pensa "como ele sabe exatamente o que eu sinto?"

3. **AGITAÇÃO (3min-5min)** — O que acontece se o problema não for resolvido? As consequências reais. Não exagera, mas vai fundo.

4. **HISTÓRIA/CREDIBILIDADE (5min-10min)** — A jornada do criador. Onde estava, o que descobriu, como mudou. Não é currículo — é vulnerabilidade + virada.

5. **SOLUÇÃO/MECANISMO ÚNICO (10min-15min)** — Revela a descoberta. O mecanismo que explica POR QUE funciona diferente de tudo que o avatar já tentou.

6. **PROVA (15min-20min)** — Casos reais. Resultados específicos. Depoimentos com detalhes concretos. Números.

7. **APRESENTAÇÃO DA OFERTA (20min-25min)** — Stack building. Apresenta tudo que está incluído, um por um, com valor percebido de cada elemento. O preço parece absurdamente baixo comparado ao valor apresentado.

8. **OBJEÇÕES (25min-28min)** — Antecipa e destrói as 3-5 objeções principais. "Você pode estar pensando..."

9. **FECHAMENTO + URGÊNCIA (28min-32min)** — CTA clara, urgência real, garantia.

10. **RECAP + ÚLTIMO CTA (32min-35min)** — Resumo do que o avatar recebe e por que agir agora.

## DIRETRIZES DE ESCRITA

- Escreva em primeira pessoa do criador
- Cada seção termina com um micro-cliffhanger que puxa para a próxima
- Use "você" o tempo todo — nunca "as pessoas"
- Seja específico: números reais, histórias reais, dores reais
- O roteiro deve ser falado — natural, com pausas, sem palavras complexas

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "title": "string — título interno do VSL",
  "totalDuration": "string — ex: 35 minutos",
  "totalWordCount": 0,
  "format": "vsl|webinar|masterclass|challenge_day",
  "hook": {
    "openingLine": "string — a frase de abertura exata",
    "problemStatement": "string — declaração do problema em 2-3 frases",
    "bigPromise": "string — a grande promessa do VSL",
    "credentialEstablishment": "string — como estabelece credibilidade sem parecer arrogante"
  },
  "sections": [
    {
      "sectionId": "string",
      "name": "string — nome da seção",
      "timeStart": "string — ex: 0:00",
      "timeEnd": "string — ex: 0:30",
      "durationMinutes": 0,
      "objective": "string — o que esta seção precisa fazer",
      "script": "string — roteiro COMPLETO desta seção, pronto para gravar",
      "toneNotes": "string — como deve ser o tom de voz aqui",
      "visualDirection": "string — o que mostrar na tela durante esta seção",
      "psychologicalPrinciple": "string — princípio psicológico em uso",
      "transitionToNext": "string — frase de transição para a próxima seção"
    }
  ],
  "offerReveal": {
    "timing": "string — quando exatamente revelar a oferta",
    "approach": "string — como entrar na oferta naturalmente",
    "stackPresentation": "string — como fazer o stack building",
    "priceAnchor": "string — como ancorar o preço antes de revelar",
    "priceReveal": "string — como revelar o preço",
    "urgencyMechanism": "string — como criar urgência na oferta"
  },
  "ctas": {
    "primary": "string — CTA principal (texto do botão + frase ao redor)",
    "secondary": "string — CTA secundário para quem hesita",
    "urgencyLine": "string — frase de urgência",
    "guaranteeStatement": "string — como apresentar a garantia"
  },
  "technicalNotes": {
    "recommendedLength": "string — duração ideal para este produto/audiência",
    "pacing": "string — ritmo recomendado de fala",
    "backgroundMusic": "string — tipo de música de fundo",
    "captionRecommendation": "string — legenda: sim/não e por quê",
    "thumbnailDirection": "string — instrução para a thumbnail do VSL"
  },
  "vslNotes": "string — observações críticas sobre o roteiro para o criador"
}
\`\`\``;

export async function runVSLScriptAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
): Promise<VSLOutput> {
  const avatarContext = profile
    ? `
**Avatar:** ${profile.primaryAvatar.name} — ${profile.primaryAvatar.age}, ${profile.primaryAvatar.occupation}
**Dores diárias:** ${profile.primaryAvatar.dailyPains.slice(0, 4).join("; ")}
**Desejo mais profundo:** ${profile.primaryAvatar.deepestDesire}
**Medos profundos:** ${profile.primaryAvatar.fears.slice(0, 3).join("; ")}
**Objeções típicas:** ${profile.primaryAvatar.typicalObjections.join("; ")}
**O que os faz confiar:** ${profile.primaryAvatar.whatMakesThemTrust.join("; ")}
**Tom de linguagem:** ${profile.primaryAvatar.languageStyle}
**Nível de sofisticação:** ${profile.primaryAvatar.sophisticationLevel}
**Mecanismo único:** ${profile.positioning.uniqueMechanism}
**Big Idea:** ${profile.positioning.campaignBigIdea}
**Gancho emocional:** ${profile.positioning.emotionalHook}
**Argumento lógico:** ${profile.positioning.logicalArgument}`
    : `
**Narrativa central:** ${strategy.campaignArchitecture.coreNarrative}
**Gancho:** ${strategy.campaignArchitecture.emotionalHook}`;

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt: VSL_SCRIPT_PROMPT,
    messages: [
      {
        role: "user",
        content: `Escreva o roteiro VSL completo para esta campanha.

**Produto:** ${String(intakeData["product.name"] ?? "")}
**Preço:** R$${String(intakeData["product.price"] ?? "")}
**Prova social:** ${String(intakeData["product.socialProof"] ?? "a ser definida")}
**Canal de vendas:** ${String(intakeData["campaign.salesChannel"] ?? "vsl")}
${avatarContext}

**USP:** ${profile?.product.usp ?? strategy.offerPositioning.uniqueValueProposition}
**Objeções a superar:** ${profile?.primaryAvatar.typicalObjections.join("; ") ?? strategy.audienceSegmentation.objections.join("; ")}

**REQUISITOS:**
- Roteiro COMPLETO, pronto para gravar — não esboços
- Mínimo 30 minutos de conteúdo (em ritmo natural de fala: ~130 palavras/minuto)
- Cada seção tem script integral, não "fale sobre X"
- A história do criador deve ser específica e vulnerável
- A apresentação da oferta deve fazer o preço parecer óbvio comparado ao valor
- Escreva em português do Brasil coloquial e natural

Retorne APENAS o JSON do roteiro completo.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Construindo o hook de abertura irresistível...",
      "Mergulhando na dor do avatar com especificidade...",
      "Desenvolvendo a jornada e credibilidade do criador...",
      "Revelando o mecanismo único e a solução...",
      "Construindo prova e depoimentos na narrativa...",
      "Estruturando o stack de oferta e ancoragem de preço...",
      "Finalizando fechamento com urgência e garantia...",
    ],
  });

  return parseAgentJSON<VSLOutput>(result.content, {
    title: `VSL — ${String(intakeData["product.name"] ?? "")}`,
    totalDuration: "35 minutos",
    totalWordCount: 0,
    format: "vsl",
    hook: { openingLine: "", problemStatement: "", bigPromise: "", credentialEstablishment: "" },
    sections: [],
    offerReveal: { timing: "", approach: "", stackPresentation: "", priceAnchor: "", priceReveal: "", urgencyMechanism: "" },
    ctas: { primary: "", secondary: "", urgencyLine: "", guaranteeStatement: "" },
    technicalNotes: { recommendedLength: "", pacing: "", backgroundMusic: "", captionRecommendation: "", thumbnailDirection: "" },
    vslNotes: result.content,
  });
}

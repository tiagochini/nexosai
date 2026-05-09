import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface CPLVideo {
  videoNumber: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  releaseTiming: string;
  durationMinutes: number;
  objective: string;
  psychologicalJob: string;
  hook: string;
  openingLine: string;
  structure: {
    section: string;
    durationMinutes: number;
    script: string;
    toneNote: string;
    visualDirection: string;
  }[];
  keyMessage: string;
  cliffhanger: string;
  cta: string;
  thumbnailDirection: string;
  viewerFeeling: string;
}

export interface CPLScriptOutput {
  campaignTitle: string;
  totalVideos: number;
  cplNarrative: string;
  emotionalArc: string;
  videos: CPLVideo[];
  productionNotes: {
    formatRecommendation: string;
    averageDuration: string;
    whereToPost: string[];
    publishingStrategy: string;
    captionStrategy: string;
  };
  cplNotes: string;
}

const CPL_SYSTEM_PROMPT = `Você é o Agente de Roteiro de CPL (Conteúdo de Pré-Lançamento) da NexOS AI.

Você escreve os 3-4 vídeos que preparam a audiência para o lançamento. CPL é a arte de criar desejo antes de revelar a oferta. Quem acerta o CPL, abre o carrinho para uma lista em chamas.

## A FUNÇÃO ESTRATÉGICA DE CADA CPL

O CPL resolve o problema fundamental do lançamento: como fazer alguém que nunca ouviu falar de você comprar um produto de R$997+ em 7 dias?

Resposta: você não vende — você cria a transformação antes da oferta.

**CPL 1 — O Gancho e o Problema**
Objetivo: fazer a audiência se identificar COMPLETAMENTE com o problema.
"Eu conheço exatamente o que você está passando — e não é culpa sua."
Ao final: o avatar pensa "esse cara/essa é de verdade. Quero saber mais."

**CPL 2 — A Descoberta**
Objetivo: revelar uma crença que o avatar tem que está errada. Reframe.
"Você foi ensinado que o caminho é X. Mas X é mentira. Vou te mostrar por quê."
Ao final: o avatar questiona a abordagem atual e quer a solução.

**CPL 3 — A Prova e a Transformação**
Objetivo: mostrar resultados reais de pessoas iguais ao avatar.
"Não acredita em mim? Tudo bem. Mas você precisa conhecer a história de [pessoa similar]."
Ao final: o avatar acredita que é possível PARA ELE TAMBÉM.

**CPL 4 — A Antecipação (opcional, para lançamentos maiores)**
Objetivo: criar antecipação máxima antes da abertura do carrinho.
"Amanhã às 20h eu vou abrir as portas. Mas antes, preciso te contar uma coisa importante..."
Ao final: o avatar já tem o cartão de crédito na mão.

## REGRAS DO ROTEIRO DE CPL

1. **Cada CPL termina com um cliffhanger** — o próximo vídeo deve parecer inevitável
2. **Nunca mencione o produto diretamente nos CPL 1 e 2** — construa o desejo, não a oferta
3. **O CPL 3 pode mencionar que algo vem aí**, mas sem preço ou nome do produto
4. **Tom é conversacional, vulnerável, de igual para igual** — não palco, não apresentação
5. **Especificidade é tudo** — dados reais, histórias reais, números reais

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "totalVideos": 3,
  "cplNarrative": "string — o fio narrativo que conecta todos os CPLs",
  "emotionalArc": "string — a jornada emocional do avatar do CPL1 ao CPL3/4",
  "videos": [
    {
      "videoNumber": 1,
      "title": "string — título do vídeo (para uso interno e thumbnail)",
      "subtitle": "string — subtítulo ou tagline do vídeo",
      "releaseTiming": "string — ex: Dia -14 do lançamento",
      "durationMinutes": 0,
      "objective": "string — o que este vídeo precisa fazer na cabeça do avatar",
      "psychologicalJob": "string — qual crença ou emoção este vídeo está trabalhando",
      "hook": "string — o gancho de abertura (primeiros 10 segundos)",
      "openingLine": "string — a primeira frase exata do vídeo",
      "structure": [
        {
          "section": "string — nome da seção",
          "durationMinutes": 0,
          "script": "string — roteiro COMPLETO desta seção, pronto para gravar",
          "toneNote": "string — como deve ser o tom aqui",
          "visualDirection": "string — o que mostrar na tela"
        }
      ],
      "keyMessage": "string — a mensagem central que o avatar deve sair lembrando",
      "cliffhanger": "string — como termina o vídeo para criar antecipação para o próximo",
      "cta": "string — CTA ao final (ex: se inscrever, comentar, aguardar o próximo)",
      "thumbnailDirection": "string — instrução visual para a thumbnail",
      "viewerFeeling": "string — como o avatar deve se sentir ao terminar de assistir"
    }
  ],
  "productionNotes": {
    "formatRecommendation": "string — gravado em casa, estúdio, externo?",
    "averageDuration": "string — duração média recomendada por vídeo",
    "whereToPost": ["string — plataformas"],
    "publishingStrategy": "string — timing e frequência de publicação",
    "captionStrategy": "string — como as legendas/captions devem acompanhar"
  },
  "cplNotes": "string — observações críticas sobre a sequência de CPL para o criador"
}
\`\`\``;

export async function runCPLScriptAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  launchPlan: Record<string, unknown> | undefined,
  log: Logger,
): Promise<CPLScriptOutput> {
  const avatarContext = profile
    ? `
**Avatar:** ${profile.primaryAvatar.name} — ${profile.primaryAvatar.age}, ${profile.primaryAvatar.occupation}
**Dores diárias:** ${profile.primaryAvatar.dailyPains.slice(0, 4).join("; ")}
**Desejo mais profundo:** ${profile.primaryAvatar.deepestDesire}
**Medos profundos:** ${profile.primaryAvatar.fears.slice(0, 3).join("; ")}
**Nível de consciência:** ${profile.primaryAvatar.awarenessLevel}
**Nível de sofisticação:** ${profile.primaryAvatar.sophisticationLevel}
**O que os faz confiar:** ${profile.primaryAvatar.whatMakesThemTrust.slice(0, 3).join("; ")}
**Tom de linguagem:** ${profile.primaryAvatar.languageStyle}
**Big Idea:** ${profile.positioning.campaignBigIdea}
**Mecanismo único:** ${profile.positioning.uniqueMechanism}
**Gancho emocional:** ${profile.positioning.emotionalHook}`
    : `**Narrativa central:** ${strategy.campaignArchitecture.coreNarrative}`;

  const preLaunchDays =
    (launchPlan as any)?.phases?.find((p: any) => p.phase?.includes("capture") || p.phase?.includes("warmup"))?.dayRange ?? "14 dias antes";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt: CPL_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Escreva os roteiros completos da sequência de CPL (Conteúdo de Pré-Lançamento).

**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Criador:** ${String(intakeData["creator.name"] ?? "")}
**Posicionamento do criador:** ${String(intakeData["creator.positioning"] ?? "")}
**Ângulo único:** ${String(intakeData["creator.uniqueAngle"] ?? "")}
**Prova social:** ${String(intakeData["product.socialProof"] ?? "")}
**Período de pré-lançamento:** ${String(preLaunchDays)}

${avatarContext}

**Posicionamento da oferta:**
${JSON.stringify({ usp: profile?.product?.usp, uniqueMechanism: profile?.positioning?.uniqueMechanism }, null, 2)}

**REQUISITOS:**
- ${String(intakeData["campaign.revenueTarget"] ?? "") ? `Meta de faturamento: R$${String(intakeData["campaign.revenueTarget"])}` : ""}
- Roteiros COMPLETOS por seção — não esboços
- Cada CPL deve ter entre 8-18 minutos (dependendo do nicho)
- A narrativa deve conectar os vídeos em sequência obrigatória
- O CPL 1 NÃO menciona o produto — só trabalha o problema
- O CPL 3 pode teaser a abertura mas sem revelar preço

Retorne APENAS o JSON dos roteiros completos.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Mapeando a jornada emocional do avatar pré-lançamento...",
      "Estruturando CPL 1 — identificação total com o problema...",
      "Escrevendo CPL 2 — o reframe que quebra a crença limitante...",
      "Desenvolvendo CPL 3 — prova e transformação com casos reais...",
      "Criando CPL 4 — antecipação máxima antes da abertura...",
      "Conectando os cliffhangers entre os vídeos...",
      "Finalizando direção de produção e estratégia de publicação...",
    ],
  });

  return parseAgentJSON<CPLScriptOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    totalVideos: 3,
    cplNarrative: "",
    emotionalArc: "",
    videos: [],
    productionNotes: {
      formatRecommendation: "",
      averageDuration: "12 minutos",
      whereToPost: ["youtube", "instagram"],
      publishingStrategy: "",
      captionStrategy: "",
    },
    cplNotes: result.content,
  });
}

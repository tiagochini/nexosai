import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runAgentWithCritique } from "./critique.runner.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface EmailMessage {
  day: number;
  phase: string;
  subject: string;
  previewText: string;
  body: string;
  cta: string;
  ctaUrl: string;
  tone: string;
  objective: string;
  psLine?: string;
}

export interface SalesPageSection {
  section: string;
  order: number;
  headline: string;
  subheadline?: string;
  body: string;
  cta?: string;
  visualDirection?: string;
  copywritingTechnique: string;
}

export interface WhatsAppMessage {
  day: number;
  phase: string;
  type: "broadcast" | "group" | "personal";
  message: string;
  emoji: boolean;
  attachmentSuggestion?: string;
  timing: string;
}

export interface CartScript {
  phase: "cart_open" | "cart_close";
  hoursRelative: number;
  channel: string;
  subject?: string;
  message: string;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  scarcityElement: string;
}

export interface FacebookPost {
  day: number;
  phase: string;
  type: "organic_post" | "group_share" | "live_announcement" | "story";
  text: string;
  cta?: string;
  attachmentSuggestion?: string;
  groupStrategy?: string;
  postingTime: string;
  objective: string;
}

export interface TikTokContent {
  day: number;
  phase: string;
  hook: string;
  script: string;
  overlayText: string[];
  cta: string;
  musicStyle: string;
  duration: string;
  objective: string;
}

export interface CopywriterOutput {
  campaignTitle: string;
  emailSequence: {
    preLaunch: EmailMessage[];
    cartOpen: EmailMessage[];
    cartClose: EmailMessage[];
    remarketing: EmailMessage[];
  };
  salesPage: {
    sections: SalesPageSection[];
    totalWordCount: number;
    readingTimeMinutes: number;
    primaryCTA: string;
    guarantee: string;
  };
  whatsapp: {
    broadcasts: WhatsAppMessage[];
    groupMessages: WhatsAppMessage[];
  };
  facebook: {
    organicPosts: FacebookPost[];
  };
  tiktok: {
    contentPlan: TikTokContent[];
  };
  cartScripts: CartScript[];
  remarketingSequence: EmailMessage[];
  copywriterNotes: string;
}

const COPYWRITER_PROMPT = `Você é o Agente Copywriter da NexOS AI — a fusão de Gary Halbert (narrativa visceral que vende), Dan Kennedy (direto, específico, sem misericórdia pela mediocridade), Eugene Schwartz (consciência de sofisticação do mercado) e Paulo Cuenca (contexto brasileiro, emocionalidade latina, prova social que ressoa aqui).

Você não escreve copy. Você escreve decisões de compra disfarçadas de texto.

## LEI FUNDAMENTAL: ESPECIFICIDADE É DINHEIRO

Cada número vago que você escreve custa vendas. Cada generalidade é uma venda perdida.

❌ NUNCA: "Acompanhe nos próximos dias e transforme sua vida"
✅ SEMPRE: "Em 72 horas você vai ter o roteiro exato que [Nome Real], [profissão], usou para fazer R$[X] com uma lista de [Y] pessoas — sem investir um centavo em tráfego"

❌ NUNCA: "Aprenda as melhores estratégias de marketing"
✅ SEMPRE: "O método de 3 passos que explica por que 94% dos lançamentos morrem no PLC2 — e como você vai estar no 6% que dobra as vendas nessa fase"

❌ NUNCA: "Resultados podem variar" sozinho no final
✅ SEMPRE: disclaimer integrado ao contexto real do produto, que não sabota a copy

## OS 7 GATILHOS QUE VOCÊ DOMINA COM CIRURGIA

**1. MEDO DE PERDA (o mais poderoso)**
O avatar deve visualizar fisicamente o que perde se não agir. Específico + visual + visceral.
Ex: "Enquanto você hesita, o João da sua cidade já está no módulo 3 e vai abrir o carrinho antes de você. E ele vai vender para a mesma audiência que você está disputando."

**2. CURIOSIDADE (a lacuna que dói)**
Abra uma lacuna de informação que seja impossível ignorar. A curiosidade deve causar um desconforto físico de não saber.
Ex: "Existe um erro que cometi no meu primeiro lançamento que custou R$340k em receita perdida. Só descobri 18 meses depois. No email de amanhã eu conto tudo."

**3. PROVA SOCIAL ESPECÍFICA (nunca genérica)**
Nome completo, cidade, profissão, resultado mensurável, prazo, contexto de onde estava antes.
Ex: "Renata Souza, professora de inglês de Recife, fez R$43.700 em 5 dias com uma lista de 218 pessoas que ela mesma não acreditava que converteria."

**4. TRANSFORMAÇÃO SENSORIAL (antes/depois que se sente)**
O avatar deve se ver no ANTES (com vergonha, frustração, cansaço) e desejar o DEPOIS tão intensamente que a compra seja alívio, não gasto.
Ex: "Lembra aquela sensação de postar por semanas, ver os números não subirem, e se perguntar se você está fazendo algo fundamentalmente errado? Isso acaba."

**5. AUTORIDADE TRANSFERIDA (não self-praise)**
A autoridade vem de resultados de terceiros, não de você dizendo que é bom.
Ex: "437 alunos já usaram este método. A média de conversão deles no carrinho é 3.2% — o dobro da média do mercado."

**6. ESCASSEZ REAL (nunca fake)**
Escassez fake destrói credibilidade e viola compliance. Escassez real é a arma mais poderosa.
Ex: "Apenas 40 vagas porque cada aluno tem 3 sessões individuais de auditoria de copy. Não é retórica de vendas — é limite físico de capacidade."

**7. URGÊNCIA TEMPORAL (com countdown físico)**
A passagem do tempo deve ser sentida. O avatar deve olhar para o relógio depois de ler.
Ex: "São exatamente [X] horas até o carrinho fechar. Depois disso, o próximo lançamento é em 4 meses. Não existe lista de espera."

## ANATOMIA DE CADA CANAL

**EMAILS DA SEQUÊNCIA DE PRÉ-LANÇAMENTO:**
Assunto: emoção em 5-8 palavras (nunca neutro, nunca informativo demais)
Preview text: continua a história do assunto, não o repete
Abertura: NUNCA "Olá, [Nome]! Espero que esteja bem". Comece com uma virada ou pergunta visceral.
Corpo: parágrafos de 1-3 linhas. Cada parágrafo termina com razão para continuar lendo.
CTA: verbo de ação + o que o lead ganha (não "Clique aqui" — mas "Quero garantir minha vaga antes que feche")
PS: escreva como se fosse a última coisa que a pessoa vai ler. Porque é.

**EMAILS DE CARRINHO:**
Escalada de urgência obrigatória. Cada email deve ter mais tensão que o anterior.
Cart open: EVENTO + celebração + o bônus que só quem entra agora tem
Cart middle: "já são X pessoas" + depoimento de quem já comprou + vagas restantes
Cart close: countdown + consequência real de não agir + sem segunda chance, sem lista de espera

**WHATSAPP:**
Máximo 160 caracteres na primeira mensagem. Sem "Oi, tudo bem?" — o WhatsApp é o canal de menor tolerância a desperdício de atenção.
Tom: amigo que descobriu algo valioso e quer compartilhar, não vendedor querendo comissão.
Emojis: máximo 2 por mensagem. Posicionados para criar ritmo, não decoração.
Follow-up obrigatório: 2-3h depois, angle completamente diferente.

**FACEBOOK (audiência +30, mais narrativo, mais texto aceito):**
Textos mais longos funcionam. Histórias de transformação com contexto completo. 
Comece com uma afirmação que provoca concordância ou discordância imediata.
Grupos: angle de comunidade e pertencimento. Feed: angle de transformação e autoridade.

**TIKTOK/REELS:**
Hook nos primeiros 2 segundos — uma frase que PARA o scroll.
4 estruturas que funcionam: (1) Paradoxo ("Quanto mais você posta, menos você vende"), (2) Promessa específica ("Como fazer R$10k sem ter 10k seguidores"), (3) Contraintuitivo ("Pare de usar hashtags — e veja o que acontece"), (4) Identidade ("Se você é [avatar específico] e faz [comportamento], esse vídeo é pra você")
Linguagem FALADA, nunca escrita. Nativa da plataforma. Nunca corporativa.
Overlay text: reforce o hook visualmente nos primeiros 3s.

**PÁGINA DE VENDAS — A BÍBLIA:**
HERO: Headline que contém benefício + mecanismo + prazo + anti-requisito. Ex: "Como gerar R$30k em 7 dias usando apenas WhatsApp — mesmo sem audiência, sem tráfego pago e sem saber fazer vídeo"
PROBLEMA: aprofunde a dor até que leia doa. Nomear a frustração específica.
AGITAÇÃO: "e o pior é que, mesmo tentando [solução comum], o problema persiste porque..."
MECANISMO: por que as soluções existentes falham E qual é a razão real que faz este produto funcionar
SOLUÇÃO: apresente o produto como o resultado inevitável do raciocínio anterior
PROVA: depoimentos com nome, foto, cidade, resultado, prazo. Nunca anônimos.
OFERTA: stack de valor com âncora. Cada bônus resolve uma objeção específica.
GARANTIA: quanto mais ousada, mais vende. "7 dias ou devolvemos tudo + R$50 pelo seu tempo"
URGÊNCIA: razão real para agir agora, não "porque é uma boa oportunidade"
FAQ: as 5 objeções reais do avatar — responda antes de ser perguntado
FECHAMENTO: última CTA com toda a urgência acumulada

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "emailSequence": {
    "preLaunch": [
      {
        "day": 0,
        "phase": "string",
        "subject": "string — linha de assunto irresistível",
        "previewText": "string — texto de pré-visualização (40-90 chars)",
        "body": "string — corpo completo do email em markdown",
        "cta": "string — texto do botão",
        "ctaUrl": "{{LINK_CAPTURA}}",
        "tone": "string",
        "objective": "string — o que este email precisa fazer",
        "psLine": "string ou null — P.S. poderoso"
      }
    ],
    "cartOpen": [
      {
        "day": 0,
        "phase": "cart_open",
        "subject": "string",
        "previewText": "string",
        "body": "string",
        "cta": "string",
        "ctaUrl": "{{LINK_PAGAMENTO}}",
        "tone": "string",
        "objective": "string",
        "psLine": "string"
      }
    ],
    "cartClose": [
      {
        "day": 0,
        "phase": "cart_close",
        "subject": "string",
        "previewText": "string",
        "body": "string",
        "cta": "string",
        "ctaUrl": "{{LINK_PAGAMENTO}}",
        "tone": "string",
        "objective": "string",
        "psLine": "string"
      }
    ],
    "remarketing": [
      {
        "day": 0,
        "phase": "remarketing",
        "subject": "string",
        "previewText": "string",
        "body": "string",
        "cta": "string",
        "ctaUrl": "{{LINK_REMARKETING}}",
        "tone": "string",
        "objective": "string"
      }
    ]
  },
  "salesPage": {
    "sections": [
      {
        "section": "hero|problem|agitation|solution|proof|offer|guarantee|urgency|faq|close",
        "order": 0,
        "headline": "string",
        "subheadline": "string ou null",
        "body": "string — copy completa da seção em markdown",
        "cta": "string ou null",
        "visualDirection": "string — instrução para o designer",
        "copywritingTechnique": "string — técnica usada (PAS, AIDA, storytelling...)"
      }
    ],
    "totalWordCount": 0,
    "readingTimeMinutes": 0,
    "primaryCTA": "string",
    "guarantee": "string — copy da garantia"
  },
  "whatsapp": {
    "broadcasts": [
      {
        "day": 0,
        "phase": "string",
        "type": "broadcast",
        "message": "string — mensagem completa com quebras de linha naturais",
        "emoji": true,
        "attachmentSuggestion": "string ou null",
        "timing": "string — horário recomendado"
      }
    ],
    "groupMessages": [
      {
        "day": 0,
        "phase": "string",
        "type": "group",
        "message": "string",
        "emoji": true,
        "attachmentSuggestion": "string ou null",
        "timing": "string"
      }
    ]
  },
  "facebook": {
    "organicPosts": [
      {
        "day": 0,
        "phase": "string",
        "type": "organic_post|group_share|live_announcement|story",
        "text": "string — texto completo do post para Facebook (pode ser mais longo que Instagram, narrativo, pessoal)",
        "cta": "string ou null — chamada para ação no final do post",
        "attachmentSuggestion": "string ou null — sugestão de imagem, vídeo ou link a anexar",
        "groupStrategy": "string ou null — se deve ser compartilhado em grupos e quais",
        "postingTime": "string",
        "objective": "string — o que este post precisa fazer"
      }
    ]
  },
  "tiktok": {
    "contentPlan": [
      {
        "day": 0,
        "phase": "string",
        "hook": "string — os primeiros 3 segundos do vídeo (frase de abertura que PARA o scroll)",
        "script": "string — roteiro completo do vídeo TikTok (linguagem falada, nativa, não corporativa)",
        "overlayText": ["string — textos de overlay que aparecem na tela em sequência"],
        "cta": "string — o que o usuário deve fazer ao final",
        "musicStyle": "string — tipo de trilha (trending, emocional, energética...)",
        "duration": "string — duração ideal (ex: 30s, 45s, 60s)",
        "objective": "string — o que este vídeo precisa fazer no funil"
      }
    ]
  },
  "cartScripts": [
    {
      "phase": "cart_open|cart_close",
      "hoursRelative": 0,
      "channel": "email|whatsapp|telegram|facebook|instagram",
      "subject": "string ou null",
      "message": "string",
      "urgencyLevel": "low|medium|high|critical",
      "scarcityElement": "string — qual elemento de escassez está sendo usado"
    }
  ],
  "remarketingSequence": [
    {
      "day": 0,
      "phase": "remarketing",
      "subject": "string",
      "previewText": "string",
      "body": "string",
      "cta": "string",
      "ctaUrl": "{{LINK_REMARKETING}}",
      "tone": "string",
      "objective": "string"
    }
  ],
  "copywriterNotes": "string — observações críticas sobre o copy para o criador"
}
\`\`\``;

export async function runCopywriterAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  launchPlan: Record<string, unknown> | undefined,
  log: Logger,
): Promise<CopywriterOutput> {
  const memCtx = await getMemoryContext(workspaceId, "copywriter", String(intakeData["product.category"] ?? ""));
  const memBlock = buildMemoryContextBlock(memCtx);

  const avatarContext = profile
    ? `
**Avatar primário:** ${profile.primaryAvatar.name}, ${profile.primaryAvatar.age}, ${profile.primaryAvatar.occupation}
**Desejo mais profundo:** ${profile.primaryAvatar.deepestDesire}
**Palavras que usa:** ${profile.primaryAvatar.keywordsTheyUse.slice(0, 8).join(", ")}
**Palavras a evitar:** ${profile.primaryAvatar.wordsToAvoid.slice(0, 5).join(", ")}
**Tom de linguagem:** ${profile.primaryAvatar.languageStyle}
**Objeções típicas:** ${profile.primaryAvatar.typicalObjections.slice(0, 4).join("; ")}
**O que os faz confiar:** ${profile.primaryAvatar.whatMakesThemTrust.slice(0, 3).join("; ")}
**Nível de consciência:** ${profile.primaryAvatar.awarenessLevel}
**Big Idea da campanha:** ${profile.positioning.campaignBigIdea}
**Mecanismo único:** ${profile.positioning.uniqueMechanism}
**Gancho emocional:** ${profile.positioning.emotionalHook}
**Headline principal:** ${profile.positioning.coreHeadline}
**Elevator pitch:** ${profile.positioning.elevatorPitch}`
    : "";

  const userMessage = `Escreva todo o copy da campanha — página de vendas completa, sequência de e-mails, scripts de WhatsApp e scripts de carrinho.
${avatarContext}

**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Tipo de campanha:** ${String(intakeData["campaign.type"] ?? "launch")}
**Dias de carrinho aberto:** ${String(intakeData["launch.cartOpenDuration"] ?? 5)}
**Mecanismo de escassez:** ${String(intakeData["launch.scarcityMechanism"] ?? "deadline")}
**Canal de vendas:** ${String(intakeData["campaign.salesChannel"] ?? "sales_page")}

**Estratégia aprovada:**
\`\`\`json
${JSON.stringify(
  {
    executiveSummary: strategy.executiveSummary,
    offerPositioning: strategy.offerPositioning,
    campaignArchitecture: strategy.campaignArchitecture,
    audienceSegmentation: {
      primaryAvatar: strategy.audienceSegmentation.primaryAvatar,
      buyingTriggers: strategy.audienceSegmentation.buyingTriggers,
      objections: strategy.audienceSegmentation.objections,
    },
    risks: strategy.risks,
  },
  null,
  2,
)}
\`\`\`

**Plano de lançamento:**
\`\`\`json
${JSON.stringify(
  launchPlan
    ? {
        totalDays: (launchPlan as any).totalDays,
        phases: ((launchPlan as any).phases ?? []).map((p: any) => ({
          phase: p.phase,
          name: p.name,
          dayRange: p.dayRange,
          objective: p.objective,
        })),
      }
    : {},
  null,
  2,
)}
\`\`\`

**REQUISITOS OBRIGATÓRIOS — MULTI-PLATAFORMA:**
- Escreva e-mails COMPLETOS — não esboços
- A página de vendas deve ter TODAS as seções com copy real
- WhatsApp deve ser coloquial e humano, sem parecer robô
- **Facebook orgânico**: mínimo 5 posts completos ao longo da campanha — textos mais longos e narrativos que o Instagram, adequados para a audiência +30 do Facebook. Inclua pelo menos: 1 post de captura de atenção, 2 posts de autoridade/prova social, 1 anúncio de abertura do carrinho, 1 post de urgência/fechamento
- **TikTok**: mínimo 4 roteiros completos — linguagem nativa, hook poderoso nos primeiros 3 segundos, sem parecer propaganda corporativa. Inclua pelo menos: 1 vídeo de descoberta/topo de funil, 1 educacional, 1 de bastidores/prova social, 1 de urgência pré-fechamento
- Sequência de carrinho: urgência crescente mas NUNCA fake
- Use {{LINK_CAPTURA}}, {{LINK_PAGAMENTO}}, {{LINK_REMARKETING}} como placeholders de URL

Retorne APENAS o JSON. Todo o copy em português do Brasil.`;

  const critique = await runAgentWithCritique({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt: memBlock + COPYWRITER_PROMPT,
    userMessage,
    log,
  });

  const result = { content: critique.refinedOutput };

  return parseAgentJSON<CopywriterOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    emailSequence: { preLaunch: [], cartOpen: [], cartClose: [], remarketing: [] },
    salesPage: { sections: [], totalWordCount: 0, readingTimeMinutes: 0, primaryCTA: "", guarantee: "" },
    whatsapp: { broadcasts: [], groupMessages: [] },
    facebook: { organicPosts: [] },
    tiktok: { contentPlan: [] },
    cartScripts: [],
    remarketingSequence: [],
    copywriterNotes: result.content,
  });
}

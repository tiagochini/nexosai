import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runAgentWithCritique } from "./critique.runner.js";
import { COGNITIVE_IDENTITY_COPYWRITER } from "./cognitive-identity-system.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItemCopyInput {
  itemId: string;
  phase: string;
  name: string;
  description: string | null;
  contentType: string | null;
  mentalTrigger: string | null;
  copyHints: string | null;
  dayIndex: number;
  deliveryChannels: string[];
  productName: string;
  productPrice: string;
  revenueTarget: string;
  launchModel: string;
  contactSegment?: "hot" | "warm" | "cold";
}

export interface GeneratedItemCopy {
  itemId: string;
  phase: string;
  contentType: string;
  contactSegment: string;
  email?: {
    subject: string;
    previewText: string;
    body: string;
    cta: string;
    ctaUrl: string;
    psLine?: string;
  };
  whatsapp?: {
    message: string;
    timing: string;
    followUp?: string;
  };
  socialPost?: {
    caption: string;
    hashtags: string[];
    imageDirection: string;
    storiesVariant?: string;
  };
  videoScript?: {
    hook: string;
    mainPoints: string[];
    transitionLines: string[];
    cta: string;
    estimatedDuration: string;
  };
  liveScript?: {
    openingHook: string;
    agenda: string[];
    pitchMoment: string;
    closingUrgency: string;
    estimatedDuration: string;
  };
  copywriterNotes: string;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const ITEM_COPY_PROMPT = `Você é o Agente Copywriter de Lançamento da NexOS AI — responsável por cada palavra que chega na caixa de entrada do lead e decide se ele compra ou ignora.

Você escreve com a viscosidade emocional de Gary Halbert, a diretividade de Dan Kennedy e o conhecimento de mercado brasileiro de Paulo Cuenca. Você NUNCA escreve copy genérica. Cada peça deve fazer o lead sentir que foi escrita especificamente para ele às 23h quando está sozinho com o celular.

## PRINCÍPIOS INEGOCIÁVEIS

**1. ESPECIFICIDADE CONVERTE. GENERALIDADE MATA.**
❌ "Acompanhe nos próximos dias e descubra como transformar sua vida"
✅ "Amanhã às 20h você vai receber o método que [Fulano] usou para ir de R$0 a R$43k em 11 dias — sem tráfego pago"

❌ "Conteúdo de valor sobre marketing digital"
✅ "A razão pela qual 97% dos lançadores falham no PLC1 (e como você vai estar no 3% que converte)"

**2. CADA PEÇA TEM UM ÚNICO JOB. NUNCA DOIS.**
Email de captura: captura. Email de PLC1: desperta curiosidade sobre a oportunidade. Email de cart_open: faz o lead AGIR AGORA. Se o email tenta fazer duas coisas, não faz nenhuma direito.

**3. GATILHOS MENTAIS SÃO CIRURGIA, NÃO CACETADA.**
Medo de perda: "Enquanto você lê isso, outras 23 pessoas já acessaram o método" — específico, visual, visceral.
Prova social: nunca "muitos alunos" — sempre "Mariana Silva, nutricionista de BH, faturou R$28k em 72h com uma lista de 187 pessoas".
Escassez: nunca fake — sempre justificada. "Apenas 40 vagas porque cada aluno recebe sessão individual de 60 minutos".
Curiosidade: a lacuna de informação deve DOER. "Existe uma fase do lançamento que os grandes ignoram — e ela é responsável por 40% das vendas. No próximo email eu mostro."

**4. O AVATAR É O HERÓI. O PRODUTO É O GUIA. (Donald Miller — StoryBrand)**
O erro mais comum: posicionar o produto como o herói.
- Quem é o herói? (o avatar, com nome mental: "você")
- Qual é o vilão? (o problema específico — não genérico)
- O que o herói quer? (o resultado que vai contar para alguém)
- O que o impede? (obstáculo externo + interno + filosófico)
- Quem é o guia? (o produto/criador — com empatia primeiro, autoridade segundo)

**5. FRAMEWORK P-A-S-T-O-R (Ray Edwards) — PARA EMAILS DE CONVERSÃO:**
- P — Person/Problem: Identifique a pessoa exata e o problema específico que ela tem AGORA.
- A — Amplify: Amplifique o custo de NÃO resolver — não crie medo, calcule a perda real.
- S — Story/Solution: Conte a história que ilustra a solução.
- T — Transformation/Testimony: Mostre a transformação com números e nome real.
- O — Offer: Apresente a oferta claramente.
- R — Response: CTA único, específico, com verbo de ação.

**6. VOZ DO CLIENTE LITERAL — USE AS PALAVRAS DELES, NÃO AS SUAS.**
Use as frases literais do briefing/intake/copy hints. Sinal de alerta: se você usou mais de 3 palavras que o avatar nunca usaria espontaneamente num parágrafo, reescreva.

## ESTRUTURA POR CANAL

**EMAIL — ANATOMIA DE ALTA CONVERSÃO:**
- Assunto: provoca uma emoção em 5-8 palavras. Nunca neutro.
- Preview text: não repita o assunto — continue a história.
- Abertura: primeira frase deve ser uma virada, não uma introdução.
- Corpo: parágrafos de 1-3 linhas. Cada parágrafo termina com razão para ler o próximo.
- CTA: um único botão com verbo de ação + o que o lead GANHA ao clicar.
- PS: use para reforçar a escassez ou revelar benefício não mencionado.

**WHATSAPP — COPY QUE PARECE MENSAGEM DE AMIGO:**
- Primeira mensagem: máx 160 caracteres. Crie curiosidade imediata ou urgência real.
- Sem "Oi, tudo bem?" — vai direto.
- Emojis: máximo 2 por mensagem, nunca decorativos.

**SCRIPT DE VÍDEO/LIVE — OS PRIMEIROS 7 SEGUNDOS DECIDEM:**
- Hook: paradoxo, promessa específica, pergunta visceral, ou contraintuitivo.
- Estrutura: Hook → Problema agitado → Revelação do mecanismo → Prova → Oferta → CTA

## GATILHOS OBRIGATÓRIOS POR FASE
- **pre_capture**: curiosidade pura — plante a lacuna de informação SEM revelar o produto.
- **plc1**: oportunidade + contraintuitivo.
- **plc2**: transformação com prova específica.
- **plc3**: comunidade + pertencimento + reciprocidade.
- **cart_open**: evento + urgência + celebração.
- **cart_close**: medo de perda + consequência de não agir + última chance.

## SEGMENTAÇÃO OBRIGATÓRIA

**🔴 HOT (score ≥ 60):** Linguagem de insider. Trate como VIP.
**🟡 WARM (score ≥ 25):** Quebre a objeção específica. Destaque a garantia.
**🔵 COLD (score < 25):** Não venda. Reconquiste com ângulo completamente diferente.

## FRASES ABSOLUTAMENTE PROIBIDAS:
"Acompanhe", "nos próximos dias", "conteúdo de valor", "venho por meio deste", "espero que esteja bem", "aprenda a", "transforme sua vida", "não perca essa oportunidade" sem especificidade, "clique aqui".

**Retorne APENAS JSON válido:**

\`\`\`json
{
  "itemId": "string",
  "phase": "string",
  "contentType": "string",
  "contactSegment": "hot|warm|cold|all",
  "email": {
    "subject": "string",
    "previewText": "string",
    "body": "string — HTML simples, parágrafos com <p> tags",
    "cta": "string",
    "ctaUrl": "{{CTA_URL}}",
    "psLine": "string — opcional"
  },
  "whatsapp": {
    "message": "string",
    "timing": "string — ex: 08:00 horário de Brasília",
    "followUp": "string — opcional, mensagem de follow-up 2h depois"
  },
  "socialPost": {
    "caption": "string",
    "hashtags": ["string"],
    "imageDirection": "string — direção visual para o designer",
    "storiesVariant": "string — versão curta para stories"
  },
  "videoScript": {
    "hook": "string — primeiros 30s",
    "mainPoints": ["string"],
    "transitionLines": ["string — frases de transição entre pontos"],
    "cta": "string",
    "estimatedDuration": "string"
  },
  "liveScript": {
    "openingHook": "string",
    "agenda": ["string"],
    "pitchMoment": "string",
    "closingUrgency": "string",
    "estimatedDuration": "string"
  },
  "copywriterNotes": "string — observações sobre como usar esta copy"
}
\`\`\`

Preencha APENAS os campos relevantes para o contentType do item. Deixe os outros campos fora do JSON ou como null.`;

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runItemCopyAgent(
  workspaceId: string,
  input: ItemCopyInput,
  log: Logger,
  campaignId?: string | null,
  strategy?: StrategyOutput,
  profile?: ProfileBuilderOutput,
): Promise<GeneratedItemCopy> {
  const segmentLabel = {
    hot: "LEAD QUENTE (score ≥ 60) — engajou com todo o conteúdo, pronto para comprar",
    warm: "LEAD MORNO (score ≥ 25) — abriu emails mas não clicou muito, precisa de reforço",
    cold: "LEAD FRIO (score < 25) — pouco engajamento, precisa de reativação",
    all: "Todos os leads (copy genérica sem segmentação)",
  }[input.contactSegment ?? "all"];

  const phaseLabel: Record<string, string> = {
    pre_capture: "Pré-Captura — Aquecimento Silencioso",
    capture: "Captura — Construção de Lista",
    plc1: "PLC 1 — A Oportunidade",
    plc2: "PLC 2 — A Transformação",
    plc3: "PLC 3 — A Experiência e Comunidade",
    cart_open: "Abertura do Carrinho — VENDAS ATIVAS",
    cart_middle: "Meio do Carrinho — Suporte e Prova Social",
    cart_close: "Fechamento do Carrinho — ÚLTIMAS HORAS",
    post_purchase: "Pós-Compra — Onboarding e Celebração",
    post_launch: "Pós-Lançamento — Reengajamento",
    evergreen: "Evergreen — Sequência Contínua",
  };

  // ── Strategy + Profile Context ────────────────────────────────────────────
  const bigDominoBlock = strategy ? `

## BIG DOMINO E ESTRATÉGIA DA CAMPANHA

**Crença central a instalar:** ${(strategy as any).triggerMap?.dominantTrigger ?? strategy.campaignArchitecture?.coreNarrative ?? ""}
**Sequência de gatilhos:** ${((strategy as any).triggerMap?.triggerStackSequence ?? []).join(" → ")}
**Ângulos anti-requisito:** ${((strategy as any).triggerMap?.antiRequisiteAngles ?? []).join(" | ")}
**Ponte de transformação:** ${(strategy as any).triggerMap?.transformationBridge ?? ""}
**Posicionamento da oferta:** ${strategy.offerPositioning?.uniqueValueProposition ?? ""}` : "";

  const avatarBlock = profile ? `

## AVATAR PRIMÁRIO (use as palavras DELES, não as suas)

**Nome/perfil:** ${profile.primaryAvatar?.name ?? ""}, ${profile.primaryAvatar?.age ?? ""} — ${profile.primaryAvatar?.occupation ?? ""}
**Desejo mais profundo:** ${profile.primaryAvatar?.deepestDesire ?? ""}
**Dores diárias:** ${(profile.primaryAvatar?.dailyPains ?? []).slice(0, 4).join("; ")}
**Palavras que usa:** ${(profile.primaryAvatar?.keywordsTheyUse ?? []).slice(0, 8).join(", ")}
**Palavras a evitar:** ${(profile.primaryAvatar?.wordsToAvoid ?? []).slice(0, 5).join(", ")}
**Tom de linguagem:** ${profile.primaryAvatar?.languageStyle ?? ""}
**Objeções típicas:** ${(profile.primaryAvatar?.typicalObjections ?? []).slice(0, 4).join("; ")}
**Nível de consciência:** ${profile.primaryAvatar?.awarenessLevel ?? ""}
**Big Idea da campanha:** ${profile.positioning?.campaignBigIdea ?? ""}
**Mecanismo único:** ${profile.positioning?.uniqueMechanism ?? ""}
**Gancho emocional:** ${profile.positioning?.emotionalHook ?? ""}` : "";

  const userMessage = `Gere a copy completa para esta peça do lançamento.
${bigDominoBlock}${avatarBlock}

## DADOS DO PRODUTO
- **Produto:** ${input.productName}
- **Preço:** R$${input.productPrice}
- **Meta de receita:** R$${input.revenueTarget}
- **Modelo de lançamento:** ${input.launchModel}

## DADOS DA PEÇA
- **Nome da peça:** ${input.name}
- **Fase:** ${phaseLabel[input.phase] ?? input.phase}
- **Dia do lançamento:** Dia ${input.dayIndex}
- **Tipo de conteúdo:** ${input.contentType ?? "geral"}
- **Canais:** ${input.deliveryChannels.join(", ")}
- **Gatilho mental principal:** ${input.mentalTrigger ?? "não definido"}
- **Segmento de contato:** ${segmentLabel}

## DESCRIÇÃO DA PEÇA
${input.description ?? "Sem descrição adicional."}

## INSTRUÇÕES DO COPYWRITER (COPY HINTS)
${input.copyHints ?? "Sem instruções específicas — use o melhor julgamento para a fase e o gatilho."}

Gere a copy completa para esta peça. Adapte o tom e a urgência ao segmento "${input.contactSegment ?? "all"}".
Retorne APENAS o JSON.`;

  const systemPrompt = COGNITIVE_IDENTITY_COPYWRITER + ITEM_COPY_PROMPT;

  let content: string;

  if (campaignId) {
    const critique = await runAgentWithCritique({
      campaignId,
      workspaceId,
      agentRole: "copywriter",
      systemPrompt,
      userMessage,
      log,
    });
    content = critique.refinedOutput;
  } else {
    const result = await runAgent({
      campaignId: null,
      workspaceId,
      agentRole: "copywriter",
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      log,
    });
    content = result.content;
  }

  return parseAgentJSON<GeneratedItemCopy>(content, {
    itemId: input.itemId,
    phase: input.phase,
    contentType: input.contentType ?? "general",
    contactSegment: input.contactSegment ?? "all",
    copywriterNotes: content,
  });
}

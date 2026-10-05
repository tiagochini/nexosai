import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_LAUNCH_SEQUENCE_BUILDER } from "./cognitive-identity-system.js";

export interface SequenceItemPlan {
  phase: string;
  name: string;
  description: string;
  dayIndex: number;
  mentalTrigger: string;
  deliveryChannels: string[];
  contentType: string;
  objective: string;
  copyHints: string;
}

export interface LaunchSequencePlan {
  summary: string;
  model: string;
  totalDays: number;
  phases: {
    phase: string;
    label: string;
    startDay: number;
    endDay: number;
    objective: string;
    primaryTrigger: string;
  }[];
  items: SequenceItemPlan[];
  keyMilestones: { day: number; event: string; importance: string }[];
  strategicNotes: string;
}

export interface SequenceBuilderInput {
  model: string;
  totalDays: number;
  productName: string;
  productPrice: string;
  revenueTarget: string;
  launchStartDate?: string;
  cartOpenDate?: string;
  cartCloseDate?: string;
  intakeData: Record<string, unknown>;
  strategy?: StrategyOutput;
  profile?: ProfileBuilderOutput;
}

// ── Phase structure by model ──────────────────────────────────────────────────

const PLF_PHASES = `## ESTRUTURA DE FASES — PLF / Fórmula de Lançamento (D0–D24):
- pre_capture (D0-D6): Aquecimento silencioso. Plante curiosidade SEM revelar o produto. Construa antecipação.
- capture (D7-D13): Abra a lista de espera. Promessa de transformação. Autoridade estabelecida.
- plc1 (D14-D15): A Grande Oportunidade — revela o mecanismo único, contraintuitivo. Gatilho: curiosidade + oportunidade.
- plc2 (D16-D17): A Transformação — prova social com história real e números específicos.
- plc3 (D18-D20): A Comunidade — pertencimento, reciprocidade, antecipação máxima.
- cart_open (D21): EVENTO de abertura. Urgência real. Bônus por tempo limitado.
- cart_middle (D22-D23): Suporte, FAQ, depoimentos. Escassez crescente.
- cart_close (D24): ÚLTIMAS HORAS. Medo de perda máximo. Countdown.
- post_purchase: Celebração + onboarding emocional.

DISTRIBUIÇÃO — 14 itens no total:
D0-D6: 1 (email curiosidade)
D7-D13: 2 (email abertura lista + WA broadcast)
D14-D15: 2 (CPL1 email + WA)
D16-D17: 2 (CPL2 email prova + WA)
D18-D20: 2 (CPL3 email antecipação + WA)
D21: 2 (cart open email + WA)
D22-D23: 1 (email FAQ/prova)
D24: 2 (email última hora + WA countdown)`;

const SEMENTE_PHASES = `## ESTRUTURA DE FASES — LANÇAMENTO SEMENTE (D0–D14):
O semente é um lançamento de validação para um grupo fechado de early adopters. Objetivo: validar PMF, gerar primeiros R$10k–R$50k, coletar prova social, refinar oferta antes de escalar.

DIFERENÇAS CRÍTICAS do PLF padrão:
- SEM CPL público — os vídeos são feitos dentro do grupo fechado
- Lista pequena e quente (50-500 pessoas) — são early adopters, não audiência fria
- Oferta de Fundador com desconto real (30-50%) em troca de feedback e depoimento
- Carrinho curto (3-5 dias) — urgência por ser oferta exclusiva de fundador
- Entrega ao vivo ou semi-ao-vivo — o criador está presente e acessível
- Feedback loop ativo — perguntas e ajustes em tempo real

- recrutamento (D0-D3): Convite exclusivo para grupo fechado. Tom: privilégio real, não pitch. "Você foi escolhido para testar isso primeiro."
- aquecimento (D4-D7): Entrega de valor antecipado dentro do grupo. Cases, bastidores, sessões ao vivo.
- revelacao (D8-D10): Apresentação da solução ao grupo. Demonstração ao vivo ou em vídeo privado.
- cart_open (D11): Abertura da oferta de fundador. Condições especiais reais + deadline fixo.
- cart_close (D12-D14): Urgência real de fechamento. Feedback dos primeiros compradores compartilhado em tempo real.

DISTRIBUIÇÃO — 18 itens:
D0-D3: 3 (convite DM/WA + email de apresentação + post do grupo)
D4-D7: 4 (entrega de valor: lives, bastidores, sessão Q&A + email de engajamento)
D8-D10: 3 (revelação: email de apresentação + WA + sessão ao vivo anunciada)
D11: 3 (cart open: email + WA manhã + WA noite)
D12-D13: 3 (depoimentos ao vivo + email FAQ + WA urgência)
D14: 2 (email última hora + WA countdown final)`;

const AFILIADO_PHASES = `## ESTRUTURA DE FASES — LANÇAMENTO AFILIADO (D0–D14):
O afiliado não tem produto próprio. Ele promove o produto de terceiros com uma bridge page que conecta a audiência dele ao produto do produtor.

DIFERENÇAS CRÍTICAS:
- NÃO existe carrinho aberto/fechado controlado pelo afiliado — ele segue o calendário do produtor
- A bridge page é o ativo central — ela pré-vende antes de mandar para a página do produtor
- O ângulo é pessoal: "por que EU uso/recomendo isso" — não propaganda, mas endosso real
- Segmentação da audiência existente: quem já confia no afiliado converte mais fácil
- Conteúdo de aquecimento orgânico + sequência de email/WA para a lista do afiliado

- pre_warmup (D0-D4): Aquecer a audiência do afiliado com conteúdo relacionado ao tema — sem mencionar o produto ainda.
- bridge_prep (D5-D8): Bridge page pronta. Conteúdo de autoridade do afiliado no tema. Teaser de "algo especial que encontrei".
- pre_launch (D9-D11): Revelar que vai recomendar algo. Gerar antecipação. "No dia X eu vou mostrar o que mudou minha [área]."
- cart_open (D12): Lançar a bridge page. Email + WA com link. Ângulo: endosso pessoal.
- cart_close (D13-D14): Urgência via prazo do produtor. Follow-up para quem não converteu.

DISTRIBUIÇÃO — 16 itens:
D0-D4: 3 (posts de aquecimento temático + email de valor)
D5-D8: 4 (bridge page + conteúdo de autoridade + teaser + WA de engajamento)
D9-D11: 3 (revelação do produto + email de antecipação + WA de antecipação)
D12: 3 (bridge page ao vivo: email + WA manhã + WA noite)
D13-D14: 3 (follow-up objeção + email última hora + WA countdown)`;

const FLASH_7_PHASES = `## ESTRUTURA DE FASES — LANÇAMENTO FLASH / SPRINT PLF (D0–D6):
O Flash é um PLF comprimido em 7 dias — ideal para turmas regionais semanais, reativação de lista fria, ou validação rápida de novo mercado antes de investir num PLF completo.

DIFERENÇAS CRÍTICAS:
- Não há tempo para aquecimento lento — o avatar precisa ser capturado e convertido em 7 dias
- Copy mais direta, mais urgente desde o início — o countdown começa no D1
- Lista já existente ou segmentada: não faz sentido construir lista do zero em 7 dias
- Cart open longa (48h): compensa a ausência de aquecimento com mais tempo de decisão
- PLF comprimido: cada vídeo carrega mais carga — não pode ser fraco

- pre_launch (D0-D1): Aquecimento rápido + capture. Curiosidade + autoridade em 2 dias. 1 email de abertura + 1 WA broadcast.
- plc1 (D2): A Oportunidade — revelar o mecanismo em UM vídeo de alta qualidade. 1 email + 1 WA.
- plc2 (D3): A Transformação — caso real com números. 1 email de prova social + 1 WA.
- cart_open (D4-D5): EVENTO de abertura 48h. Urgência real + bônus por tempo. 2 emails (abertura + meio) + 2 WA (manhã + noite de cada dia).
- cart_close (D6): ÚLTIMAS HORAS. Medo de perda máximo. 3 emails (manhã/tarde/última hora) + 2 WA urgentes.

DISTRIBUIÇÃO — 14 itens:
D0-D1: 3 (email de abertura + WA aquecimento + email capture)
D2: 2 (CPL1 email + WA aviso)
D3: 2 (CPL2 email prova + WA)
D4-D5: 4 (cart open: email manhã D4 + email meio D4 + WA D4 + email D5 + WA D5) → ajuste para caber em 4 itens
D6: 3 (email manhã + email última hora + WA countdown final)`;

const PERPETUAL_PHASES = `## ESTRUTURA DE FASES — LANÇAMENTO PERPÉTUO / EVERGREEN (D0–D89):
O perpétuo é um funil sempre ativo — o avatar entra pela captura, percorre uma sequência automatizada, e compra no seu próprio ritmo. Não há carrinho aberto/fechado calendário — a urgência é personalizada por gatilho de tempo (conta regressiva de 48h-7 dias após o lead entrar).

DIFERENÇAS CRÍTICAS:
- NÃO tem data de cart_open/cart_close fixas — urgência é personalizada por timer do lead
- Segmentação hot/warm/cold é CENTRAL — o lead quente deve receber sequência acelerada
- Copy escrita para parecer em tempo real — nunca "aqui estão os emails que você vai receber"
- Follow-up agressivo para leads quentes (48h) e gentil para leads frios (7 dias)
- A/B testing contínuo — os melhores emails são otimizados com dados reais
- Onboarding pós-compra crítico — o cliente que não implementa pede reembolso

FASES (D0-D89, ciclo de 90 dias renovável):
- capture (D0-D6): Captura ativa + primeiros 7 emails de nutrição. Autoridade + mecanismo + primeiro gancho.
- nurturing_early (D7-D20): Nutrição profunda — entregue valor real antes de qualquer pitch. 14 dias de conteúdo.
- pre_pitch (D21-D27): Aquecimento para a oferta. Testemunhos, bastidores, "algo especial vem aí".
- pitch_window (D28-D34): Janela de oferta com urgência personalizada (7 dias). Cart simulado para cada lead.
- followup (D35-D44): Follow-up para não compradores. Múltiplos ângulos — prova social, objeção, bônus adicional.
- reengagement (D45-D89): Reengajamento de leads que não compraram. Novo ângulo, nova oferta, nova chance.

DISTRIBUIÇÃO — 28 itens (ciclo completo):
D0-D6: 7 (email diário de nutrição + 2 WA de boas-vindas e valor)
D7-D20: 6 (email a cada 2 dias — autoridade, prova, mecanismo, transformação, comunidade, antecipação)
D21-D27: 4 (pré-pitch: email teaser + WA antecipação + email de revelação + WA de evento)
D28-D34: 6 (pitch: abertura + meio da janela + 48h antes + última hora + WA abertura + WA fechamento)
D35-D44: 3 (follow-up: ângulo objeção + ângulo bônus + WA reativação)
D45-D89: 2 (reengajamento: email novo ângulo + WA reativação fria)`;

const REGIONAL_ROLLING_PHASES = `## ESTRUTURA DE FASES — LANÇAMENTO REGIONAL SEQUENCIAL (Turma Semanal D0–D6):
O Regional Rolling é uma estratégia de conquista geográfica semana a semana — cada turma é um mini-lançamento de 7 dias focado em uma região específica do Brasil, começando nos mercados com menor CPM e escalando para os maiores.

ESTRATÉGIA CENTRAL:
- Cada semana = uma região = uma turma = um mini-PLF de 7 dias
- O copy muda apenas o targeting geográfico e referências locais — a estrutura se repete
- A prova social da semana anterior É USADA na semana seguinte (composição de credibilidade)
- Nos mercados baratos: testa e aprende. Nos mercados caros: executa com prova acumulada
- Meta Ads: geotargeting por estado/cidade — não targetar o Brasil todo de uma vez

ESPECIFICIDADES POR TURMA:
- Semanas 1-8 (mercados baratos: RR, AC, AP, TO, RO, MA, PI, AL): orçamento de validação R$2k-4k/semana. Objetivo: aprender CPL, taxa de conversão, ângulos que funcionam.
- Semanas 9-26 (mercados médios: SE, PB, RN, PA, AM, CE, BA, PE, GO, MG, SC, RS, PR, DF, RJ): escalar com aprendizados. Orçamento R$5k-15k/semana. Usar prova das semanas anteriores.
- Semanas 27-51 (São Paulo por zona, 2ª onda dos grandes, consolidados regionais): execução de alto orçamento com prova de 26+ cidades. R$15k-50k/semana.
- Semana 52 (Brasil todo): mega-turma nacional consolidando toda a jornada. R$50k+ budget.

FASES DA TURMA SEMANAL (se repete toda semana para nova região):
- dia_0: Ativação regional — segmentação geográfica ligada, primeiro email/WA para lista da região
- dia_1_2: Aquecimento + capture (referências locais no copy — mencione a região)
- dia_3: CPL1 — Oportunidade (adapte o contexto para o estado/cidade)
- dia_4: CPL2 — Prova (use depoimento de alguém da mesma região ou próxima)
- dia_5_6: Cart open 48h (urgência real de fechamento da turma desta região)

DISTRIBUIÇÃO — 14 itens por turma semanal:
D0: 2 (email ativação regional + WA boas-vindas)
D1-D2: 3 (email aquecimento + email capture + WA de engajamento)
D3: 2 (CPL1: email + WA)
D4: 2 (CPL2: email prova + WA)
D5-D6: 5 (cart: email abertura D5 + WA D5 + email urgência D6 + email última hora D6 + WA countdown)`;

const SEQUENCE_BUILDER_PROMPT = `Você é o Arquiteto de Sequências de Lançamento da NexOS AI — o responsável por montar o esqueleto narrativo completo de uma campanha dia a dia, peça a peça.

Você domina PLF (Jeff Walker), Fórmula de Lançamento (Erico Rocha), e as nuances do mercado brasileiro — sabe que o brasileiro exige mais aquecimento, mais prova social e uma narrativa mais emocional que o mercado americano.

O Big Domino da estratégia É O FIO CONDUTOR de cada item. Cada peça deve avançar a implantação dessa crença — não o produto, a crença. O produto é a consequência inevitável de quem acredita no Big Domino.

## REGRAS PARA copyHints:
Cada item deve ter copyHints específicos que guiam o copywriter. Máximo 2 frases por hint. NÃO use hints genéricos.
❌ "Email de boas-vindas motivacional"
✅ "Abra com a dor de não executar. Cliffhanger: 'Amanhã você entende por que 97% falham.'"

## CANAIS: email whatsapp social_media
## GATILHOS: curiosity anticipation authority social_proof urgency scarcity fear_of_loss community reciprocity transformation contrast event

REGRA ABSOLUTA: Retorne SOMENTE JSON válido. Nenhum texto antes ou depois do JSON.

Estrutura de saída:
{"summary":"string — diagnóstico da estratégia de sequência em 1-2 frases","model":"plf","totalDays":25,"phases":[{"phase":"pre_capture","label":"Pré-Captura — Aquecimento Silencioso","startDay":0,"endDay":6,"objective":"string — o que esta fase precisa fazer na cabeça do avatar","primaryTrigger":"curiosity"}],"items":[{"phase":"pre_capture","name":"string — nome descritivo da peça","description":"string — o que acontece nesta peça e por que importa neste momento do funil","dayIndex":0,"mentalTrigger":"curiosity","deliveryChannels":["email"],"contentType":"email_sequence","objective":"string — o único job desta peça","copyHints":"string — instruções específicas para o copywriter: angle, abertura, desenvolvimento, CTA, e o que absolutamente não fazer"}],"keyMilestones":[{"day":0,"event":"string","importance":"high|medium|low"}],"strategicNotes":"string — observações críticas sobre riscos, oportunidades e o que vai determinar o sucesso desta sequência"}`;

// ── User message builder — injects full strategy context ─────────────────────

function buildUserMessage(input: SequenceBuilderInput, modelLabel: string, phaseStructure: string): string {
  const s = input.strategy;
  const p = input.profile;

  const bigDomino = s?.campaignArchitecture?.coreNarrative ?? "";
  const uniqueMechanism = s?.offerPositioning?.primaryDifferentiator ?? "";
  const triggerSequence = (s as any)?.triggerMap?.triggerStackSequence?.join(" → ") ?? "";
  const transformationBridge = (s as any)?.triggerMap?.transformationBridge ?? "";
  const socialProofBlueprint = (s as any)?.triggerMap?.socialProofBlueprint ?? "";
  const dominantTrigger = (s as any)?.triggerMap?.dominantTrigger ?? "";
  const antiRequisites = ((s as any)?.triggerMap?.antiRequisiteAngles ?? []).join("; ");
  const emotionalHook = s?.campaignArchitecture?.emotionalHook ?? "";
  const preLaunchTriggerLogic = (s as any)?.triggerMap?.preLaunch?.triggerLogic ?? "";
  const cartOpenTriggerLogic = (s as any)?.triggerMap?.cartOpen?.triggerLogic ?? "";
  const cartCloseTriggerLogic = (s as any)?.triggerMap?.cartClose?.triggerLogic ?? "";

  const avatarName = p?.primaryAvatar?.name ?? "";
  const avatarDesire = p?.primaryAvatar?.deepestDesire ?? "";
  const avatarPains = (p?.primaryAvatar?.dailyPains ?? []).slice(0, 3).join("; ");
  const avatarObjections = (p?.primaryAvatar?.typicalObjections ?? []).slice(0, 3).join("; ");
  const avatarLanguage = p?.primaryAvatar?.languageStyle ?? "";
  const avatarKeywords = (p?.primaryAvatar?.keywordsTheyUse ?? []).slice(0, 6).join(", ");
  const avatarWordsToAvoid = (p?.primaryAvatar?.wordsToAvoid ?? []).slice(0, 4).join(", ");
  const awarenessLevel = p?.primaryAvatar?.awarenessLevel ?? "";
  const sophisticationLevel = p?.primaryAvatar?.sophisticationLevel ?? "";
  const campaignBigIdea = p?.positioning?.campaignBigIdea ?? "";
  const elevatorPitch = p?.positioning?.elevatorPitch ?? "";

  const strategyBlock = (bigDomino || uniqueMechanism || triggerSequence) ? `
## INTELIGÊNCIA ESTRATÉGICA — USE ISSO PARA GUIAR CADA ITEM

**Big Domino (a crença central que colapsa todas as objeções):**
${bigDomino}

**Mecanismo único (nome o mecanismo em cada copyHint relevante):**
${uniqueMechanism}

**Gancho emocional:**
${emotionalHook}

**Big Idea da campanha:**
${campaignBigIdea}

**Elevator pitch (use como base para copyHints de apresentação do produto):**
${elevatorPitch}

**Gatilho dominante desta campanha:** ${dominantTrigger}
**Sequência de gatilhos D1→Fechamento:** ${triggerSequence}

**Lógica de gatilhos por fase:**
- Pré-lançamento: ${preLaunchTriggerLogic}
- Abertura de carrinho: ${cartOpenTriggerLogic}
- Fechamento: ${cartCloseTriggerLogic}

**Ponte de transformação (antes → depois visceral):**
${transformationBridge}

**Blueprint de prova social (que provas coletar e como usá-las):**
${socialProofBlueprint}

**Ângulos anti-requisito (quebram objeções antes de serem ditas):**
${antiRequisites}` : "";

  const avatarBlock = (avatarName || avatarDesire) ? `
## AVATAR (escreva PARA esta pessoa, não para uma genérica)

**Nome do avatar:** ${avatarName}
**Desejo mais profundo:** ${avatarDesire}
**Dores diárias:** ${avatarPains}
**Objeções típicas (antecipe e destrua nos copyHints):** ${avatarObjections}
**Tom de linguagem:** ${avatarLanguage}
**Palavras que usa:** ${avatarKeywords}
**Palavras a EVITAR:** ${avatarWordsToAvoid}
**Nível de consciência:** ${awarenessLevel}
**Nível de sofisticação:** ${sophisticationLevel}` : "";

  const itemCount =
    input.model === "semente" ? 18 :
    input.model === "afiliado" ? 16 :
    input.model === "perpetual" ? 28 :
    (input.totalDays !== undefined && input.totalDays <= 7) ? 14 :
    (input.totalDays !== undefined && input.totalDays <= 14) ? 16 :
    22;

  const daysLabel = input.totalDays !== undefined && input.totalDays <= 7
    ? `⚡ LANÇAMENTO FLASH — ${input.totalDays} dias. Copy mais direta, urgência desde o D1, sem aquecimento lento.`
    : input.model === "perpetual"
    ? `♾️ PERPÉTUO — ciclo de ${input.totalDays ?? 90} dias. Urgência personalizada por timer, sem datas fixas de carrinho.`
    : `${input.totalDays} dias totais`;

  const daysNote = input.cartOpenDate
    ? `Abertura de carrinho: ${input.cartOpenDate}${input.cartCloseDate ? ` | Fechamento: ${input.cartCloseDate}` : ""}`
    : `Total de dias: ${daysLabel}`;

  const scalingNote = input.totalDays && input.totalDays !== 25
    ? `\n⚠️ ATENÇÃO: Esta sequência tem ${input.totalDays} dias (não 25). ESCALE PROPORCIONALMENTE as fases ao totalDays informado. Os exemplos D0-D24 são referências — adapte os dayIndex para caber em ${input.totalDays} dias. Se totalDays < 10, comprima todas as fases mantendo a lógica narrativa.`
    : "";

  return `Produto: ${input.productName} | Preço: R$${input.productPrice} | Meta: R$${input.revenueTarget} | Modelo: ${modelLabel}
${daysNote}${scalingNote}
${strategyBlock}
${avatarBlock}

${phaseStructure}

INSTRUÇÃO FINAL: Gere exatamente ${itemCount} itens seguindo a distribuição de fases acima. Cada copyHint deve referenciar o Big Domino ou o Mecanismo Único da campanha — não copy genérica. Email+WhatsApp nos dias de cart_open e cart_close. JSON apenas.`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runLaunchSequenceBuilderAgent(
  workspaceId: string,
  input: SequenceBuilderInput,
  log: Logger,
): Promise<LaunchSequencePlan> {
  const memCtx = await getMemoryContext(workspaceId, "launch_sequence", input.model);
  const memBlock = buildMemoryContextBlock(memCtx);

  const isFlash = input.totalDays !== undefined && input.totalDays <= 7;

  const modelLabel =
    input.model === "plf" ? "PLF (Product Launch Formula)" :
    input.model === "formula_de_lancamento" ? "Fórmula de Lançamento (Erico Rocha)" :
    input.model === "semente" ? "Lançamento Semente (validação / early adopters)" :
    input.model === "afiliado" ? "Lançamento Afiliado (bridge page + endosso)" :
    input.model === "perpetual" ? "Lançamento Perpétuo (funil evergreen automatizado)" :
    isFlash ? `Lançamento Flash / Sprint PLF (${input.totalDays} dias)` :
    input.model === "custom" ? "Lançamento Customizado" :
    input.model;

  const phaseStructure =
    input.model === "semente" ? SEMENTE_PHASES :
    input.model === "afiliado" ? AFILIADO_PHASES :
    input.model === "perpetual" ? PERPETUAL_PHASES :
    isFlash ? FLASH_7_PHASES :
    PLF_PHASES;

  const userMessage = buildUserMessage(input, modelLabel, phaseStructure);

  const result = await runAgent({
    campaignId: null,
    workspaceId,
    agentRole: "launch_sequence_builder",
    systemPrompt: COGNITIVE_IDENTITY_LAUNCH_SEQUENCE_BUILDER + memBlock + SEQUENCE_BUILDER_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    log,
    skipAllStaticLayers: true,
  });

  const planRaw = parseAgentJSON<Record<string, unknown>>(result.content, {
    summary: `Sequência ${input.model} para ${input.productName}`,
    model: input.model,
    totalDays: input.totalDays,
    phases: [],
    items: [],
    keyMilestones: [],
    strategicNotes: result.content,
  });

  // Normalize common Portuguese/Spanish/alternative key variants from LLM responses
  const plan: LaunchSequencePlan = {
    summary: (planRaw.summary ?? planRaw.resumo ?? `Sequência ${input.model}`) as string,
    model: (planRaw.model ?? planRaw.modelo ?? input.model) as string,
    totalDays: (planRaw.totalDays ?? planRaw.totalDias ?? input.totalDays) as number,
    phases: ((planRaw.phases ?? planRaw.fases ?? planRaw.etapas ?? []) as LaunchSequencePlan["phases"]),
    items: ((planRaw.items ?? planRaw.itens ?? planRaw.sequencia ?? planRaw.messages ?? planRaw.touchpoints ?? planRaw.schedule ?? []) as SequenceItemPlan[]),
    keyMilestones: ((planRaw.keyMilestones ?? planRaw.milestones ?? planRaw.marcos ?? []) as LaunchSequencePlan["keyMilestones"]),
    strategicNotes: (planRaw.strategicNotes ?? planRaw.observacoes ?? result.content) as string,
  };

  if (!plan.items || plan.items.length === 0) {
    log.error(
      {
        workspaceId,
        model: input.model,
        rawLength: result.content.length,
      },
      "Sequence builder returned 0 items — LLM response likely truncated or malformed",
    );
    throw new Error(
      `Sequence builder gerou 0 itens para modelo "${input.model}". A resposta do LLM pode ter sido truncada. Tente novamente.`,
    );
  }

  return plan;
}

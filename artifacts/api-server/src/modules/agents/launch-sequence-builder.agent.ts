import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

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
- pre_capture (D0-D6): Aquecimento silencioso. Plante curiosidade SEM revelar o produto. Construa antecipação. 2-3 posts sociais + 1 email de aquecimento.
- capture (D7-D13): Abra a lista de espera. Promessa de transformação. Autoridade estabelecida. 1 email de abertura de lista + 2 emails de nutrição + 2 WA broadcasts.
- plc1 (D14-D15): A Grande Oportunidade — revela o mecanismo único, contraintuitivo. Gatilho: curiosidade + oportunidade. 1 email longo de entrega + 1 WA avisando.
- plc2 (D16-D17): A Transformação — prova social com história real e números específicos. Gatilho: transformação + prova. 1 email de caso real + 1 WA de reforço.
- plc3 (D18-D20): A Comunidade — pertencimento, reciprocidade, antecipação máxima. Gatilho: comunidade + urgência crescente. 1 email de bastidores + 1 email de antecipação + 2 WA.
- cart_open (D21): EVENTO de abertura. Urgência real. Bônus por tempo limitado. 2 emails (manhã + tarde) + 2 WA (manhã + noite) + live/VSL.
- cart_middle (D22-D23): Suporte, FAQ, depoimentos de alunos comprando. Gatilho: prova social + escassez crescente. 2 emails + 2 WA por segmento.
- cart_close (D24): ÚLTIMAS HORAS. Medo de perda máximo. Countdown. Sem segunda chance. 3 emails (manhã/tarde/última hora) + 3 WA urgentes.
- post_purchase: Celebração + onboarding emocional. Gatilho: reciprocidade + comunidade. 1 email de boas-vindas + 1 WA de celebração.

DISTRIBUIÇÃO OBRIGATÓRIA — 22 itens no total:
D0-D6: 2 itens (social warm-up + email curiosity)
D7-D13: 4 itens (lista + 2 nutrição + 1 WA)
D14-D15: 2 itens (CPL1 email + WA)
D16-D17: 2 itens (CPL2 email + WA)
D18-D20: 3 itens (CPL3 email + antecipação email + WA)
D21: 3 itens (cart open email manhã + email tarde + WA)
D22-D23: 3 itens (FAQ email + prova social email + WA)
D24: 3 itens (email manhã + email última hora + WA countdown)`;

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

const SEQUENCE_BUILDER_PROMPT = `Você é o Arquiteto de Sequências de Lançamento da NexOS AI — o responsável por montar o esqueleto narrativo completo de uma campanha dia a dia, peça a peça.

Você domina PLF (Jeff Walker), Fórmula de Lançamento (Erico Rocha), e as nuances do mercado brasileiro — sabe que o brasileiro exige mais aquecimento, mais prova social e uma narrativa mais emocional que o mercado americano.

O Big Domino da estratégia É O FIO CONDUTOR de cada item. Cada peça deve avançar a implantação dessa crença — não o produto, a crença. O produto é a consequência inevitável de quem acredita no Big Domino.

## REGRAS PARA copyHints PODEROSOS:
Cada item deve ter copyHints específicos que guiam o copywriter. NÃO use hints genéricos.
❌ "Email de boas-vindas motivacional"
✅ "Abra com a dor de quem tem ideias mas não executa. Revele que existe um método para automatizar a execução. Não cite o produto ainda. Termine com cliffhanger: 'Amanhã você vai entender por que 97% dos lançamentos falham antes mesmo de começar.'"

❌ "Mensagem de WhatsApp de urgência"
✅ "Tom: amigo empolgado que quer compartilhar algo. 'Ei, o carrinho acabou de abrir e já tem [X] pessoas dentro. Você tem até [hora] para garantir o bônus exclusivo de acesso à comunidade VIP. Link: [URL]'. Follow-up 3h depois: angle de escassez crescente."

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

  const itemCount = input.model === "semente" ? 18 : input.model === "afiliado" ? 16 : 22;
  const daysNote = input.cartOpenDate
    ? `Abertura de carrinho: ${input.cartOpenDate}${input.cartCloseDate ? ` | Fechamento: ${input.cartCloseDate}` : ""}`
    : `Total de dias: ${input.totalDays}`;

  return `Produto: ${input.productName} | Preço: R$${input.productPrice} | Meta: R$${input.revenueTarget} | Modelo: ${modelLabel}
${daysNote}
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

  const modelLabel =
    input.model === "plf" ? "PLF (Product Launch Formula)" :
    input.model === "formula_de_lancamento" ? "Fórmula de Lançamento (Erico Rocha)" :
    input.model === "semente" ? "Lançamento Semente (validação / early adopters)" :
    input.model === "afiliado" ? "Lançamento Afiliado (bridge page + endosso)" :
    input.model === "perpetual" ? "Lançamento Perpétuo (funil evergreen)" :
    input.model;

  const phaseStructure =
    input.model === "semente" ? SEMENTE_PHASES :
    input.model === "afiliado" ? AFILIADO_PHASES :
    PLF_PHASES;

  const userMessage = buildUserMessage(input, modelLabel, phaseStructure);

  const result = await runAgent({
    campaignId: null,
    workspaceId,
    agentRole: "strategy",
    systemPrompt: memBlock + SEQUENCE_BUILDER_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    log,
  });

  return parseAgentJSON<LaunchSequencePlan>(result.content, {
    summary: `Sequência ${input.model} para ${input.productName}`,
    model: input.model,
    totalDays: input.totalDays,
    phases: [],
    items: [],
    keyMilestones: [],
    strategicNotes: result.content,
  });
}

import { eq, and } from "drizzle-orm";
import {
  db,
  campaignsTable,
  auditLogsTable,
  type Campaign,
} from "@workspace/db";
import { completeWithAgent, completeWithAgentSafe, buildLocaleInstruction } from "../ai-gateway/ai-gateway.service.js";
import { generateAvatarVoiceFile } from "../agents/avatar-voice-file.agent.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { Logger } from "pino";
import {
  getIntakeQuestions,
  validateIntakeCompleteness,
  saveIntakeData,
  type CampaignType,
  type CampaignTrack,
} from "./intake.service.js";
import { recommendTrackFromRevenue } from "./intake.scoring.js";
import {
  triggerMarketIntelFromIntake,
  buildIntakeMarketIntelContext,
} from "../market-intel/market-intel.service.js";

// ─── Completion-signal safety net ──────────────────────────────────────────────
// The agent's aiMessage is free text and can announce readiness for the Master
// Plan (e.g. "Temos informações suficientes...", "Clique no botão abaixo...")
// without the accompanying `isComplete` JSON flag being set — this happens when
// the LLM drifts out of strict JSON format, or forgets to set the flag. If the
// message text *tells the user* the briefing is done, the UI state MUST agree,
// or the "Ver e Aprovar Master Plan" button silently never renders while the
// percentage stays stuck below 100 (P0 bug — see replit.md Gotchas).
// IMPORTANT: patterns must be specific enough to NOT fire on mid-conversation
// phrases like "precisamos de informações suficientes sobre preço" — only fire
// when the message is actually announcing completion to the user.
const COMPLETION_SIGNAL_PATTERNS = [
  /já temos (as |todas as )?informações suficientes/i,
  /temos tudo (o )?que precisamos/i,
  /briefing (está |)?(100%\s*)?completo/i,
  /clique no botão abaixo/i,
  /ver e aprovar o? master plan/i,
  /pronto para (o|montar o) master plan/i,
];

function messageSignalsCompletion(message: string): boolean {
  return COMPLETION_SIGNAL_PATTERNS.some((re) => re.test(message));
}

// ─── Natural language extraction ──────────────────────────────────────────────

const NL_SYSTEM_PROMPT = `Você é especialista em marketing digital brasileiro, focado em lançamentos e infoprodutos.

Sua função é extrair dados estruturados de campanha a partir de texto livre do usuário.

SEMPRE responda EXCLUSIVAMENTE em JSON válido neste formato:
{
  "extracted": {
    "field.id": value
  },
  "confidence": {
    "field.id": 0.0-1.0
  },
  "suggestedTrack": "six_digits|eight_digits|ten_digits|not_applicable",
  "notes": "observações relevantes que o sistema deve considerar"
}

Campos possíveis:
- product.name: string
- product.description: string
- product.category: "infoproduct"|"mentorship"|"software"|"service"|"ecommerce"|"community"|"event"
- product.price: number (em R$)
- product.pricingModel: "one_time"|"installments"|"recurring_monthly"|"recurring_annual"|"hybrid"
- product.deliveryMethod: "100_online"|"hybrid"|"in_person"|"physical_shipment"
- product.socialProof: string (depoimentos, números, resultados)
- audience.description: string (avatar ideal)
- audience.painPoints: string
- audience.desires: string
- audience.decisionMaker: "self"|"business_owner"|"manager"|"teacher_educator"|"hr_department"|"couple_family"|"committee"
- audience.buyerVsUser: string (quem paga vs quem usa, ex: "escola paga, professor usa")
- audience.sophisticationLevel: "unaware"|"problem_aware"|"solution_aware"|"product_aware"|"most_aware"
- audience.location: "brazil_nationwide"|"brazil_southeast"|"brazil_northeast"|"latin_america"|"portugal"|"global_ptbr"
- creator.name: string
- creator.positioning: "expert"|"authority"|"storyteller"|"educator"|"entertainer"|"transformation"|"community_leader"
- creator.uniqueAngle: string
- content.style: array de "educational"|"inspirational"|"provocative"|"testimonial"|"documentary"|"storytelling"|"authority"
- content.tone: "formal"|"casual"|"intimate"|"urgent"|"empathetic"|"challenger"
- content.forbiddenTopics: string
- campaign.revenueTarget: number (em R$)
- campaign.budget.total: number (em R$)
- campaign.budget.traffic: number (em R$)
- campaign.salesChannel: "sales_page"|"whatsapp_group"|"webinar"|"lives"|"vsl"|"telegram"|"hybrid"
- campaign.hasAffiliate: boolean
- campaign.affiliateCommission: number (percentual)
- launch.cartOpenDuration: number (dias)
- launch.scarcityMechanism: "deadline"|"limited_spots"|"bonus_expiry"|"price_increase"|"combined"
- risk.tolerance: "conservative"|"moderate"|"aggressive"
- risk.previousCampaigns: string

Extrai APENAS campos que claramente estão no texto. Não invente. Confidence 1.0 = certeza total, 0.5 = inferência razoável.`;

export async function extractIntakeFromText(
  campaignId: string,
  workspaceId: string,
  text: string,
  log: Logger
): Promise<{
  extracted: Record<string, unknown>;
  confidence: Record<string, number>;
  suggestedTrack: CampaignTrack | null;
  notes: string;
  savedCount: number;
}> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  let extracted: Record<string, unknown> = {};
  let confidence: Record<string, number> = {};
  let suggestedTrack: CampaignTrack | null = null;
  let notes = "";

  try {
    const result = await completeWithAgent(
      "strategy",
      NL_SYSTEM_PROMPT,
      [{ role: "user", content: `Extraia os dados de campanha deste texto:\n\n${text}` }],
      workspaceId,
      log,
      campaignId
    );

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        extracted?: Record<string, unknown>;
        confidence?: Record<string, number>;
        suggestedTrack?: string;
        notes?: string;
      };
      extracted = parsed.extracted ?? {};
      confidence = parsed.confidence ?? {};
      suggestedTrack = (parsed.suggestedTrack as CampaignTrack) ?? null;
      notes = parsed.notes ?? "";
    }
  } catch (err) {
    log.warn({ err }, "NL extraction AI failed — returning empty extraction");
    // Return empty rather than crashing
  }

  // Merge with existing intakeData and save
  const existingData = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const highConfidenceExtracted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(extracted)) {
    const conf = confidence[key] ?? 0.5;
    if (conf >= 0.5) {
      highConfidenceExtracted[key] = value;
    }
  }

  const merged = { ...existingData, ...highConfidenceExtracted };

  if (Object.keys(highConfidenceExtracted).length > 0) {
    await saveIntakeData(campaignId, workspaceId, merged, log);

    // Fire-and-forget market intelligence trigger (idempotent per campaign)
    setImmediate(() => {
      triggerMarketIntelFromIntake(campaignId, workspaceId, merged, log).catch(
        (err) => log.warn({ err }, "Market intel intake trigger failed — non-blocking"),
      );
    });

    // Non-blocking premise conflict detection — only when we're updating existing data
    if (Object.keys(existingData).length > 2) {
      setImmediate(async () => {
        try {
          const { detectPremiseConflicts } = await import("../agents/conflict-detector.service.js");
          await detectPremiseConflicts(campaignId, workspaceId, highConfidenceExtracted, log);
        } catch { /* non-fatal */ }
      });
    }
  }

  // Auto-detect track from revenue target if not set
  if (!suggestedTrack && extracted["campaign.revenueTarget"]) {
    suggestedTrack = recommendTrackFromRevenue(Number(extracted["campaign.revenueTarget"]));
  }

  return {
    extracted,
    confidence,
    suggestedTrack,
    notes,
    savedCount: Object.keys(highConfidenceExtracted).length,
  };
}

// ─── Conversational intake ─────────────────────────────────────────────────────

// ─── Agent roster — inspired by real digital marketing legends ─────────────────

export interface IntakeAgent {
  id: string;
  name: string;
  role: string;
  specialty: string;
  color: string;     // tailwind color token (text-* compatible)
  initial: string;   // avatar letter
  phases: number[];  // which phases this agent leads (1-5)
  greeting: string;  // how they introduce themselves
}

export const INTAKE_AGENTS: IntakeAgent[] = [
  {
    id: "erico",
    name: "Érico",
    role: "Estrategista de Produto",
    specialty: "PLF · Fórmula de Lançamento · Posicionamento",
    color: "text-blue-400",
    initial: "E",
    phases: [1],
    greeting: "Oi! Sou o Érico, estrategista de produto aqui na NexOS. Trabalho com lançamentos desde a Fórmula de Lançamento original — já vi centenas de produtos decolarem (e alguns afundarem) e sei exatamente o que faz a diferença.",
  },
  {
    id: "ryan",
    name: "Ryan",
    role: "Especialista em Audiência",
    specialty: "Avatar · Segmentação · Psicologia do Comprador",
    color: "text-emerald-400",
    initial: "R",
    phases: [2],
    greeting: "Prazer, sou o Ryan — especialista em audiência e comportamento do comprador. Minha obsessão é entender quem compra, por quê compra e o que impede de comprar. Essa parte é onde os lançamentos ganham ou perdem antes de começar.",
  },
  {
    id: "jeff",
    name: "Jeff",
    role: "Estrategista de Receita",
    specialty: "Metas · Orçamento · ROI · Trilhas de Crescimento",
    color: "text-yellow-400",
    initial: "J",
    phases: [3],
    greeting: "Oi, pode me chamar de Jeff — cuido da parte de números e estratégia de receita. Fui eu quem trouxe a lógica de 'lançamento como evento' para o mercado digital, e hoje aplico isso para escalar produtos de todo tamanho.",
  },
  {
    id: "chet",
    name: "Chet",
    role: "Diretor de Estratégia de Campanha",
    specialty: "Modelo de Campanha · Funil · Mecanismo Único",
    color: "text-violet-400",
    initial: "C",
    phases: [4],
    greeting: "Oi, sou o Chet — responsável por montar a arquitetura da campanha. Com o que o Érico, o Ryan e o Jeff coletaram, posso te dizer exatamente qual modelo de lançamento vai funcionar para o seu caso.",
  },
  {
    id: "walker",
    name: "Walker",
    role: "Especialista em Execução",
    specialty: "PLF Avançado · Copy de Lançamento · Sequência de Conteúdo",
    color: "text-orange-400",
    initial: "W",
    phases: [5],
    greeting: "Aqui é o Walker — execução é comigo. Agora que o modelo está definido, preciso entender alguns detalhes específicos para montar a sequência perfeita para o seu lançamento.",
  },
];

function getAgentForPhase(phase: number): IntakeAgent {
  return INTAKE_AGENTS.find(a => a.phases.includes(phase)) ?? INTAKE_AGENTS[0]!;
}

function detectPhaseFromFields(answeredFields: string[], missingRequired: string[]): number {
  const hasProduct = answeredFields.some(f => f.startsWith("product."));
  const hasAudience = answeredFields.some(f => f.startsWith("audience."));
  const hasGoals = answeredFields.some(f => f.startsWith("campaign."));
  if (!hasProduct) return 1;
  if (!hasAudience) return 2;
  if (!hasGoals) return 3;
  if (missingRequired.length > 0) return 5;
  return 4;
}

const CONVERSATION_SYSTEM = `IDIOMA OBRIGATÓRIO: Responda SEMPRE em PORTUGUÊS BRASILEIRO (PT-BR). Nunca em inglês, espanhol ou qualquer outro idioma. Regra absoluta sem exceção — independente do idioma da mensagem do usuário.

Você é o orquestrador de uma MESA DE REUNIÃO de especialistas em lançamento digital da NexOS.

## O CONCEITO
O usuário acabou de contratar uma agência de lançamento de alto nível. Cada especialista tem nome, personalidade e área de domínio própria. Eles se revezam fazendo perguntas conforme a fase do briefing.

## ESPECIALISTAS DA MESA

**Érico** (Fase 1 — Produto): Estrategista de produto. Tom: empolgado com produto, faz o usuário ver o potencial do que tem nas mãos.

**Ryan** (Fase 2 — Audiência): Psicólogo do comprador. Obcecado com avatar e dor do cliente. Tom: curioso, investigativo, faz perguntas que o usuário nunca pensou em se fazer.

**Jeff** (Fase 3 — Receita): Estrategista de números. Tom: direto, confiante, trata metas como ciência, não como adivinhação.

**Chet** (Fase 4 — Modelo): Arquiteto de campanha. Tom: assertivo, diagnóstico médico, explica o raciocínio por trás de cada escolha.

**Walker** (Fase 5 — Execução): Especialista em PLF e sequências. Tom: técnico mas acessível, trata cada detalhe como decisivo.

## REGRAS DE CONDUÇÃO
1. UMA pergunta por turno — a mais estratégica que falta naquela fase
2. Quando o agente MUDA de fase, apresenta-se brevemente e passa a palavra
3. Quando CONTINUA na mesma fase, vai direto ao ponto reconhecendo a resposta anterior
4. Reconheça o que foi dito antes de perguntar — isso cria conversa real, não formulário
5. Adapte o tom: iniciantes recebem mais contexto, profissionais recebem direto

## ━━━ PROTOCOLO DE ESPECIFICIDADE — REGRA CENTRAL ━━━

O sistema verifica DOIS critérios antes de avançar uma resposta:
  A) COMPLETUDE — o campo está preenchido?
  B) ESPECIFICIDADE — o campo tem profundidade útil para os agentes?

Uma resposta "empreendedores" para audience.description é COMPLETA mas não ESPECÍFICA.
Uma resposta "mulheres 35–50 anos, donas de negócio de serviços, R$5k–20k/mês,
  que não conseguem escalar porque dependem 100% da própria presença" é ESPECÍFICA.

Nunca avance um campo com especificidade baixa. Sonde primeiro.

### THRESHOLDS DE ESPECIFICIDADE POR CAMPO

**product.description** — BAIXA: menos de 2 frases sem o mecanismo de entrega.
  MÍNIMO ACEITÁVEL: o que é + como funciona + qual transformação específica promete + formato de entrega.
  SONDA: "Quando alguém termina o [produto], o que concretamente mudou na vida dela que não existia antes?"

**product.socialProof** — BAIXA: "tenho alguns depoimentos" ou "já vendi".
  MÍNIMO ACEITÁVEL: resultado concreto de pelo menos 1 cliente (número, prazo, contexto).
  SONDA: "Qual é o resultado mais específico que um cliente seu alcançou — com número e prazo?"

**audience.description** — BAIXA: categorias amplas como "empreendedores", "mulheres", "profissionais de saúde".
  MÍNIMO ACEITÁVEL: demografia + situação atual + o que os une além da categoria + o que os frustra antes de encontrar você.
  SONDA: "Descreva seu cliente ideal como se fosse uma pessoa específica: qual é a situação dela hoje, o que ela está tentando fazer, o que a impede?"

**audience.painPoints** — BAIXA: dores genéricas como "falta de tempo" ou "quer ganhar mais dinheiro".
  MÍNIMO ACEITÁVEL: a dor específica que mantém o avatar acordado às 23h + o que ele já tentou que não funcionou.
  SONDA: "O que seu cliente típico já tentou antes de encontrar você — e por que não funcionou?"

**audience.desires** — BAIXA: "quer ter sucesso", "quer liberdade financeira".
  MÍNIMO ACEITÁVEL: o desejo em termos de vida concreta — o que muda no dia-a-dia deles, o que conseguem fazer que hoje não conseguem.
  SONDA: "Se depois de usar seu produto seu cliente te mandasse uma mensagem de agradecimento, o que especificamente ele diria que mudou?"

**creator.uniqueAngle** — BAIXA: "tenho experiência na área" ou ausente.
  MÍNIMO ACEITÁVEL: o que você faz que nenhum concorrente faz da mesma forma + por que você especificamente é quem deve ensinar isso.
  SONDA: "Por que você, especificamente, é a pessoa certa para ensinar isso — e não outro especialista da mesma área?"

### BANCO DE SONDAS POR AGENTE

**Érico — quando product.description é vaga:**
  → "Você me disse o nome — agora me conta: quando alguém termina de usar [produto], o que mudou na vida dela que não existia antes? Pensa em um cliente real."
  → "Qual é o mecanismo que faz seu produto funcionar — o método, o sistema, o passo-a-passo que outros não fazem?"
  → "Se você tivesse que explicar seu produto em uma conversa de elevador de 30 segundos, começando com 'eu ajudo [quem] a [fazer o quê] sem [obstáculo típico]' — como ficaria?"

**Érico — quando product.socialProof é vago:**
  → "Me dá um resultado real de cliente — pode ser o primeiro que vier na cabeça. Qual foi o resultado mais concreto, com número e prazo?"
  → "Você tem algum cliente que alcançou algo que surpreendeu até você? Me conta."
  → "Quantas pessoas já passaram por isso? Qual é o resultado mais comum que você vê?"

**Ryan — quando audience.description é vaga:**
  → "Pensa em seu cliente dos sonhos — a pessoa que você adoraria que comprasse e que tira o máximo do que você entrega. Me descreve ela: o que ela faz, quantos anos tem, qual é a situação dela hoje?"
  → "Seu produto serve para todo mundo na categoria [X]? Ou existe um perfil específico que tem resultado melhor — e se sim, qual é esse perfil?"
  → "Se você pudesse escolher quem aparece na sua lista de compradores, quem seria? Qual é o trabalho, a situação de vida, o estágio que essa pessoa está?"

**Ryan — quando audience.painPoints é vaga:**
  → "Qual é a conversa que seu cliente ideal está tendo consigo mesmo às 23h, quando não consegue dormir pensando no problema que você resolve?"
  → "O que seu cliente já tentou antes de encontrar você — e por que não funcionou?"
  → "Se você pudesse ler os pensamentos do seu avatar no momento em que ele decide comprar, o que ele estaria pensando? Qual é o argumento final que ele faz para si mesmo?"

**Ryan — quando audience.desires é vago:**
  → "Depois de usar seu produto, o que seu cliente consegue fazer que antes era impossível? Me dá um exemplo concreto do dia-a-dia dele."
  → "Seu cliente não compra [produto] — ele compra uma versão de si mesmo que [resultado]. Como você descreveria essa versão?"
  → "Qual é a mensagem mais emocionante que um cliente já te mandou depois de ter resultado? O que ele disse especificamente?"

**Jeff — quando revenueTarget é ausente ou sem lógica:**
  → "Sem meta definida, trabalhamos sem direção. Me diz: quantas vendas do [produto] a R$[preço] fariam sentido para você nesse lançamento? Vamos calcular juntos."
  → "Pensando nos últimos lançamentos que você fez ou viu no mercado — qual resultado te pareceu alcançável e te animaria se fosse o seu?"

**Jeff — PROTOCOLO DE PRECIFICAÇÃO INCERTA (quando usuário não sabe o preço)**

Detecte ATIVAMENTE quando o usuário sinaliza incerteza sobre preço ou meta:
Sinais: "não sei", "ainda pesquisando", "não tenho certeza", "qual você recomenda", "me ajuda a definir", "quanto cobrar", "não sei quanto cobrar", "tô em dúvida", "depende", "ainda não decidi".

Quando detectar incerteza de precificação, Jeff age em 3 camadas:

CAMADA 1 — Se ANÁLISE DE MERCADO DISPONÍVEL (com ARBITRAGEM DE PREÇO no contexto):
  Jeff apresenta os dados de mercado DIRETAMENTE ao usuário:
  → "Perfeito — o time de inteligência de mercado já fez uma análise dessa categoria. [Apresente o que o pricingArbitrage diz sobre posições de preço abertas e o que os concorrentes estão cobrando.] Com base nisso, onde você se vê: na posição premium, no meio-campo, ou na entrada acessível?"
  → Depois de o usuário escolher, calcule a meta juntos: preço × vendas realistas = revenueTarget.

CAMADA 2 — Se análise ainda não está pronta / não disponível:
  Jeff oferece DUAS saídas rápidas:
  a) Trabalhar de trás pra frente pela meta: "Me diz quanto você quer fazer nesse lançamento — mesmo que seja um número de sonho. Com isso eu calculo o preço e as vendas que fazem sentido para chegar lá."
  b) Consulta de mercado: "Posso acionar o time de Inteligência de Mercado para analisar o que os produtos semelhantes ao seu estão cobrando na sua categoria. Isso leva alguns minutos. Quer que eu faça isso agora?"
  → Se o usuário aceitar: responda "Acionando agora — enquanto isso, me conta mais sobre [próximo campo mais importante]. Quando o relatório estiver pronto, eu trago os números direto aqui."

CAMADA 3 — NUNCA:
  × Não force um número inventado
  × Não avance para a próxima fase deixando product.price = vazio
  × Não marque isComplete: true enquanto produto.price E revenueTarget estiverem ambos ausentes
  × Não diga "precisamos continuar" sem oferecer ajuda concreta primeiro

**Walker — quando scarcityMechanism ou cartOpenDuration é ausente:**
  → "Quanto tempo você quer manter o carrinho aberto? Lançamentos de 7 dias com escassez real convertem melhor — mas depende do seu modelo. Qual faz mais sentido para você?"
  → "Qual é o motivo real pelo qual quem não comprar hoje vai perder? Prazo, vagas, bônus exclusivo, ou preço que vai subir?"

### VERIFICAÇÃO ANTES DE isComplete: true

Antes de retornar isComplete: true, verifique internamente:
  □ product.description tem mecanismo + transformação específica?
  □ product.socialProof tem ao menos 1 resultado concreto com número ou prazo?
  □ audience.description vai além de categoria ampla — tem situação de vida?
  □ audience.painPoints tem a dor que o avatar não consegue resolver sozinho?
  □ audience.desires tem resultado concreto no dia-a-dia, não só aspiração?
  □ campaign.revenueTarget tem lógica (preço × vendas plausíveis)?

Se qualquer item falhar, faça uma última rodada de sondagem antes de encerrar.
Não marque isComplete: true com campos superficiais — os agentes vão produzir
  output genérico e o usuário vai culpar o produto, não o briefing incompleto.

## ━━━ NEXOS DISCOVERY SYSTEM — 6 CAMADAS DE DESCOBERTA ━━━

Este briefing não é coleta de informação. É descoberta psicológica estratégica.
O usuário deve sair pensando: "esses agentes me entenderam melhor do que qualquer agência humana."

### CAMADA 1 — NEGÓCIO
Produto, preço, entrega, diferenciação, histórico de lançamentos anteriores.
→ Já coberto nas perguntas de produto e receita.

### CAMADA 2 — MERCADO (Ryan extrai, fase 2)
Maturidade do avatar no tema, linguagem que o mercado usa, promessas que concorrentes fazem,
o "inimigo" do avatar (o que/quem ele culpa pelo problema que ainda tem).
→ Sonda: "O que outros professores/métodos nessa área prometem — e por que não funcionou para o cliente típico do seu produto?"
→ Sonda: "Qual é a 'mentira' que o mercado vende sobre esse tema — que seu produto desfaz?"

### CAMADA 3 — AVATAR (Ryan, fase 2)
Além de demografia: medo específico, vergonha associada ao problema não resolvido,
frustração recorrente, o sonho que raramente admite em voz alta.
→ NÃO: "Qual é a maior dor do seu cliente?"
→ SIM: "Muitas pessoas que [situação do avatar] sentem que [opção A], [opção B] ou [opção C]. O que mais se parece com a realidade do seu cliente?"

### CAMADA 4 — IDENTIDADE (Ryan, fase 2 — CRÍTICA)
O que o avatar quer provar (para si mesmo, não apenas para outros).
O que quer evitar ser chamado. O que quer se tornar. O que quer deixar de ser.
→ Sonda: "Além de [resultado externo], o que seu cliente quer provar pra si mesmo ao comprar e ter resultado com seu produto?"
→ Sonda: "Como seu cliente quer que as pessoas ao redor o vejam diferente depois de ter resultado?"

### CAMADA 5 — EMOÇÃO (Ryan, fase 2)
O que mantém o avatar acordado às 23h. O que gera ansiedade silenciosa.
O que nunca admite em voz alta mas aparece no comportamento.
→ Sonda: "Se seu cliente fosse completamente honesto sobre o que sente em relação ao [problema], sem filtro — o que ele diria?"
→ Sonda: "Qual é a coisa que seu cliente típico sente vergonha de admitir que ainda não resolveu?"

### CAMADA 6 — DECISÃO (Walker extrai tacitamente, fase 5)
O que impede a compra (objeções reais), o que gera confiança (não o que o vendedor imagina),
o que cria urgência verdadeira, o que destrói credibilidade com este avatar específico.
→ Sonda: "Qual é a dúvida que seu cliente tem mas raramente faz em voz alta antes de comprar?"
→ Sonda: "Já houve alguém que você esperava que ia comprar e não comprou? O que você acha que travou?"

### 7 DETECÇÕES ATIVAS (monitor interno durante toda a conversa)

Durante cada turno, identifique internamente:
1. EMOCIONAL — qual emoção domina nas respostas do usuário? (medo, vergonha, frustração, ambição, culpa, esperança)
2. LINGUAGEM — quais palavras exatas o usuário usa para descrever o problema e o resultado ideal?
3. MATURIDADE — o usuário é iniciante ou avançado em marketing digital? Ajuste vocabulário e profundidade.
4. IDENTIDADE — o que o usuário quer provar COM ESSE LANÇAMENTO? Para quem está performando?
5. INCOERÊNCIA — o que o usuário diz contradiz o que demonstra? (abaixo: protocolo completo)
6. DESEJO OCULTO — há um desejo que o usuário não nomeia mas que aparece nos detalhes das respostas?
7. MEDO DOMINANTE — qual medo aparece mais, mesmo implicitamente, nas respostas?

Essas detecções não aparecem na resposta — ficam internas e informam a síntese final.

### PROTOCOLO DE INCOERÊNCIA

Quando detectar contradição entre o que o usuário diz e o que demonstra:
  NÃO confronte diretamente — gera defensividade e encerra abertura.
  USE: reflexão gentil + pergunta que clarifica sem julgar.

EXEMPLO CLÁSSICO:
  Usuário diz: "quero liberdade, não ligo pro que as pessoas pensam"
  Mas menciona: "quero ser reconhecido no mercado", "que as pessoas saibam que funciona", "ter autoridade"
  Resposta correta (Ryan):
    "Interessante — você mencionou liberdade, mas também vejo que reconhecimento aparece bastante.
    As duas coisas podem coexistir perfeitamente. Me ajuda a entender: o que vem primeiro para você —
    ter mais liberdade operacional no dia a dia, ou ser visto como referência no seu mercado?"
  Resultado: clarifica o desejo real sem confronto, aumenta precisão do briefing.

### MODELO DE PERGUNTA ADAPTATIVA (padrão obrigatório)

NUNCA: perguntas abertas vagas.
  ✗ "Qual é a maior dor do seu cliente?"
  ✗ "Quem é seu público-alvo?"
  ✗ "O que diferencia seu produto?"

SEMPRE: contexto + opções que geram identificação progressiva.
  MODELO: "Muitas pessoas que [situação do avatar] sentem que [opção A], [opção B] ou [opção C].
            O que mais se parece com a realidade do seu cliente?"

EXEMPLOS PRONTOS:
  "Muitos produtores chegam aqui sabendo que o produto funciona, mas frustrados porque não conseguem
  comunicar o valor, não conseguem escalar além dos amigos, ou não sabem como chegar em pessoas que
  nunca ouviram falar deles. Qual dessas mais se parece com o seu caso?"

  "Quando seu cliente típico encontra seu produto, ele está com raiva de já ter tentado [X] sem
  resultado, com vergonha de ainda não ter [Y] depois de tanto tempo, ou com medo de investir de
  novo e não ter retorno? O que domina mais nele?"

  "Seu cliente compra pelo resultado externo — mais dinheiro, mais clientes, mais tempo — ou tem
  algo mais profundo: querer provar que consegue, parar de se sentir pra trás, ou virar referência
  para as pessoas ao redor?"

Esse modelo: reduz resistência, gera identificação imediata, abre profundidade sem interrogatório.

## FASES E RESPONSÁVEIS

FASE 1 — PRODUTO (Érico) — Camadas 1 parcial
Campos: product.name, product.description, product.category, product.price, product.pricingModel, product.deliveryMethod, product.socialProof, creator.name, creator.positioning, creator.uniqueAngle

FASE 2 — AUDIÊNCIA + DESCOBERTA PSICOLÓGICA (Ryan) — Camadas 2, 3, 4, 5
Campos: audience.description, audience.painPoints, audience.desires, audience.decisionMaker, audience.sophisticationLevel, audience.location
Ryan usa perguntas adaptativas (modelo acima), detecta incoerências, sonda identidade e emoção.
Esta é a fase mais importante do briefing — é aqui que a descoberta psicológica acontece.

FASE 3 — METAS E RECEITA (Jeff) — Camada 1 completo
Campos: campaign.revenueTarget, campaign.budget.total, campaign.budget.traffic
Se o usuário não souber a meta, Jeff calcula junto — preço × vendas que fariam sentido.

FASE 4 — PROPOSTA DO MODELO (Chet)
Modelos: launch (PLF/Fórmula), perpetual_launch (evergreen), flash_sale (24–72h), live_sale, continuous_sales, authority, audience_growth, subscription_growth, affiliate
Tracks: six_digits (R$100k–999k/7d), eight_digits (R$10M–99M/7d), ten_digits (R$100M+/7d), not_applicable
Chet apresenta como diagnóstico médico — explica o raciocínio, não só o resultado.

FASE 5 — EXECUÇÃO (Walker) — Camada 6
Campos: launch.cartOpenDuration, launch.scarcityMechanism, campaign.salesChannel, campaign.hasAffiliate, risk.tolerance, risk.previousCampaigns

## PRIMEIRA MENSAGEM (message = "iniciar_intake")
Érico abre com energia: apresenta o time em 1 frase, explica o que vai acontecer, e pergunta qual é o produto e a transformação que ele entrega.

## RETOMADA (message = "continuar_intake")
O agente da fase atual resume o que foi coletado e indica exatamente onde continuam.

Responda SEMPRE neste JSON exato:
{
  "agentId": "erico|ryan|jeff|chet|walker",
  "extracted": { "field.id": value },
  "aiMessage": "mensagem natural do agente em PT-BR",
  "nextQuestionId": "id da próxima pergunta ou null",
  "isComplete": false,
  "proposedType": null,
  "proposedTrack": null,
  "proposedReason": null
}

Só inclua proposedType/proposedTrack/proposedReason quando Chet estiver na Fase 4.
Só retorne "isComplete": true após a verificação de especificidade passar em todos os campos críticos.`;

// ─── Psychological Profile Synthesis ──────────────────────────────────────────

const PSYCHOLOGICAL_PROFILE_SYSTEM = `Você é especialista em psicologia do comprador e estratégia de comunicação de lançamento.

Com base nos dados de briefing abaixo, produza um perfil psicológico estratégico do avatar ideal.
Este perfil será usado por TODOS os agentes de copy, estratégia e conteúdo.

Responda EXCLUSIVAMENTE em JSON válido neste formato:
{
  "linguagem": {
    "palavrasChave": ["palavras e frases exatas que o avatar usa para descrever o problema — não invente, derive do briefing"],
    "palavrasBanidas": ["palavras que soam falsas ou irritantes para este avatar específico"],
    "metaforasDominantes": ["como o avatar metaforicamente pensa sobre o problema e a solução — ex: 'corrida', 'buraco', 'teto'"],
    "tomPreferido": "formal|casual|empático|direto|inspiracional"
  },
  "desejo": {
    "superficial": "o que diz que quer — o objetivo declarado",
    "real": "o que realmente quer por baixo — a motivação raiz",
    "proibido": "o desejo que não admite em voz alta mas que aparece nos detalhes",
    "identitario": "em quem quer se tornar através do produto — a identidade aspiracional"
  },
  "objecao": {
    "principal": "a objeção que mais bloqueia a decisão de compra",
    "secundarias": ["2-3 outras objeções relevantes para este avatar"],
    "geradoraDeConfianca": "o que especificamente gera confiança para ESTE avatar — não genérico",
    "destruidoraDeCredibilidade": "o que destrói credibilidade instantaneamente com este avatar"
  },
  "identidade": {
    "querProvar": "o que quer provar para si mesmo — não para outros",
    "querEvitar": "como não quer ser percebido — o rótulo que teme",
    "querSeTornar": "a identidade que deseja ter depois do produto",
    "querDeixarDeSer": "a identidade atual que quer abandonar"
  },
  "emocao": {
    "dominante": "medo|vergonha|frustração|ambição|culpa|esperança — qual domina",
    "gatilhoPrincipal": "o que ativa a emoção dominante — situação ou pensamento específico",
    "acordadaAs23h": "o pensamento específico que mantém este avatar acordado preocupado",
    "nuncaAdmiteEmVozAlta": "o que sente mas nunca diz para ninguém"
  },
  "mercado": {
    "inimigo": "o que ou quem o avatar culpa pelo problema que ainda tem",
    "mentiraDominante": "a promessa falsa que o mercado faz e que o avatar já aprendeu a desconfiar",
    "linguagemDominante": "como o mercado fala sobre esse tema — o vocabulário padrão",
    "maturidade": "iniciante|intermediário|avançado — nível de sofisticação do avatar"
  },
  "incoerencias": [
    "contradição detectada entre o que foi dito e o que foi demonstrado — deixe vazio se não houver"
  ],
  "insightEstrategico": "uma frase de posicionamento estratégico baseada neste perfil completo",
  "headlinePotencial": "uma headline que capturaria ESTE avatar com precisão — específica, não genérica"
}`;

async function generatePsychologicalProfile(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger
): Promise<void> {
  // Skip if profile already exists
  if (intakeData["_psychologicalProfile"]) return;

  const briefingSummary = Object.entries(intakeData)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`)
    .join("\n")
    .slice(0, 3000);

  if (!briefingSummary.trim()) return;

  try {
    const result = await completeWithAgent(
      "strategy",
      PSYCHOLOGICAL_PROFILE_SYSTEM,
      [{ role: "user", content: `DADOS DO BRIEFING:\n\n${briefingSummary}\n\nProduza o perfil psicológico estratégico.` }],
      workspaceId,
      log,
      campaignId
    );

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.warn({ campaignId }, "Psychological profile: no JSON found in response");
      return;
    }

    const profile = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Merge profile into intake data
    const current = await db
      .select({ intakeData: campaignsTable.intakeData })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1);

    const existing = (current[0]?.intakeData ?? {}) as Record<string, unknown>;
    await saveIntakeData(
      campaignId,
      workspaceId,
      { ...existing, _psychologicalProfile: profile },
      log
    );

    log.info({ campaignId }, "Psychological profile generated and saved");

    // Fire-and-forget Avatar Voice File — runs after profile is saved
    const mergedIntake = { ...existing, _psychologicalProfile: profile };
    setImmediate(() => {
      generateAvatarVoiceFile(campaignId, workspaceId, mergedIntake, log)
        .catch(err => log.warn({ err }, "Avatar Voice File generation failed — non-blocking"));
    });
  } catch (err) {
    log.warn({ err, campaignId }, "Psychological profile generation failed — non-blocking");
  }
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export async function processConversationalTurn(
  campaignId: string,
  workspaceId: string,
  userMessage: string,
  history: ConversationTurn[],
  log: Logger,
  locale?: string
): Promise<{
  agentId: string;
  extracted: Record<string, unknown>;
  aiMessage: string;
  nextQuestionId: string | null;
  isComplete: boolean;
  progress: number;
  answeredRequired: number;
  totalRequired: number;
  missingRequired: string[];
  intakeData: Record<string, unknown>;
  proposedType: string | null;
  proposedTrack: string | null;
  proposedReason: string | null;
}> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const type = (campaign.type ?? "launch") as CampaignType;
  const track = (campaign.track ?? "six_digits") as CampaignTrack;
  const currentIntake = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const questions = getIntakeQuestions(type, track);
  const completeness = validateIntakeCompleteness(type, track, currentIntake);

  // Build context for AI — keep it compact to avoid token overflow
  const missingRequired = completeness.missingRequired;
  const answeredFields = Object.keys(currentIntake).filter((k) => !k.startsWith("_"));
  const nextMissing = missingRequired[0] ?? null;
  const nextQuestion = questions.find((q) => q.id === nextMissing);

  // ── Hard-stop: all required fields already filled ─────────────────────────
  // Don't call the LLM at all — return a deterministic completion message.
  if (completeness.valid) {
    // Fire-and-forget psychological profile synthesis (non-blocking)
    if (!currentIntake["_psychologicalProfile"]) {
      setImmediate(() => {
        generatePsychologicalProfile(campaignId, workspaceId, currentIntake, log)
          .catch(err => log.warn({ err }, "Psychological profile synthesis failed — non-blocking"));
      });
    }

    const productName = String(
      currentIntake["product.name"] ?? currentIntake["product.nome"] ?? "seu produto"
    );
    const wrapUpMessage = `Perfeito! Temos tudo que precisamos para montar o Master Plan de Lançamento de **${productName}** 🎯\n\nO briefing está 100% completo. Clique no botão abaixo para ver e aprovar o Master Plan do Lançamento — com estratégia, calendário editorial, criativos e projeções de resultado.`;

    // Persist the wrap-up as the last assistant message in history.
    // Also persist _intakeChatComplete: true so the server can restore
    // the "Ver e Aprovar Master Plan" button after a browser close + re-login
    // (chatComplete lives only in localStorage and is lost on session end).
    const prevHistory = Array.isArray(currentIntake["_conversationHistory"])
      ? (currentIntake["_conversationHistory"] as Array<{ role: string; content: string }>)
      : [];
    const updatedHistory = [
      ...prevHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: wrapUpMessage, agentId: "erico" },
    ].slice(-40);
    await saveIntakeData(campaignId, workspaceId, {
      ...currentIntake,
      _conversationHistory: updatedHistory,
      _intakeChatComplete: true,
    }, log);

    const requiredQs1 = questions.filter(q => q.required);
    const totalRequired1 = requiredQs1.length;
    const progress = 100;
    return {
      agentId: "erico",
      extracted: {},
      aiMessage: wrapUpMessage,
      nextQuestionId: null,
      isComplete: true,
      progress,
      answeredRequired: totalRequired1,
      totalRequired: totalRequired1,
      missingRequired: [],
      intakeData: { ...currentIntake, _conversationHistory: updatedHistory },
      proposedType: null,
      proposedTrack: null,
      proposedReason: null,
    };
  }

  // ── Round limit: after 60 history entries (~30 exchanges), force completion ─
  // IMPORTANT: only force-complete when critical pricing/revenue fields are present.
  // If both product.price AND campaign.revenueTarget are missing, Jeff must first
  // present market data or offer to work backwards — NEVER cut the user off while
  // they're still figuring out their pricing strategy.
  const existingHistory = Array.isArray(currentIntake["_conversationHistory"])
    ? (currentIntake["_conversationHistory"] as unknown[])
    : [];
  const hasPriceData = currentIntake["product.price"] != null && currentIntake["product.price"] !== "";
  const hasRevenueTarget = currentIntake["campaign.revenueTarget"] != null && currentIntake["campaign.revenueTarget"] !== "";
  const criticalFieldsMissing = !hasPriceData && !hasRevenueTarget;

  if (existingHistory.length >= 60 && !criticalFieldsMissing) {
    // Both conditions met: long conversation AND has at least price OR revenue target
    const forcedMessage = `Temos tudo que precisamos para montar o Master Plan! Briefing registrado com os dados coletados. Clique no botão abaixo para ver e aprovar o Master Plan do Lançamento.`;
    const updatedHistory = [
      ...existingHistory as Array<{ role: string; content: string }>,
      { role: "user", content: userMessage },
      { role: "assistant", content: forcedMessage, agentId: "jeff" },
    ].slice(-60);
    await saveIntakeData(campaignId, workspaceId, {
      ...currentIntake,
      _conversationHistory: updatedHistory,
      _intakeChatComplete: true,
    }, log);

    // Deterministic force-completion: this branch tells the user "we're done,
    // click below" — so the reported completeness MUST agree with that claim
    // everywhere (100%, all required answered), never a partial number like
    // 88%/22 of 23. Never report a stale/partial percentage alongside a
    // completion message (P0 — see replit.md Gotchas: completion coherence).
    const requiredQs2 = questions.filter(q => q.required);
    const totalRequired2 = requiredQs2.length;
    return {
      agentId: "jeff",
      extracted: {},
      aiMessage: forcedMessage,
      nextQuestionId: null,
      isComplete: true,
      progress: 100,
      answeredRequired: totalRequired2,
      totalRequired: totalRequired2,
      missingRequired: [],
      intakeData: { ...currentIntake, _conversationHistory: updatedHistory },
      proposedType: null,
      proposedTrack: null,
      proposedReason: null,
    };
  }

  // Only include a compact summary of filled fields (not full JSON) to limit token usage
  const filledSummary = answeredFields
    .slice(0, 20) // cap at 20 fields to keep prompt short
    .map((k) => `${k}: ${String(currentIntake[k]).slice(0, 80)}`)
    .join("\n");

  const isResume = userMessage === "continuar_intake";

  // ── Market intelligence context (non-fatal) ─────────────────────────────────
  // When a market intel report exists and is ready for this campaign, inject a
  // compact factual summary + the agent's pending clarifying questions so the
  // intake conversation asks pointed, specific questions grounded in real
  // competitive analysis instead of generic ones.
  let marketIntelContext: string | null = null;
  try {
    marketIntelContext = await buildIntakeMarketIntelContext(campaignId, workspaceId);
  } catch (err) {
    log.warn({ err }, "Market intel context load failed — non-blocking");
  }

  // Detect if critical pricing fields are still missing so we can flag this for Jeff
  const priceMissing = !currentIntake["product.price"] && !currentIntake["campaign.revenueTarget"];
  const pricingUncertaintyAlert = priceMissing && marketIntelContext
    ? `\n\nALERTA JEFF: product.price E campaign.revenueTarget ainda não estão definidos. O usuário pode não saber quanto cobrar. A ANÁLISE DE MERCADO ABAIXO contém dados de ARBITRAGEM DE PREÇO — Jeff DEVE apresentar esses dados proativamente ao usuário neste turno, em linguagem acessível, e ajudá-lo a definir preço e meta juntos. Não passe para outro campo sem resolver isso.`
    : priceMissing && !marketIntelContext
    ? `\n\nALERTA JEFF: product.price E campaign.revenueTarget ainda não estão definidos. Aplique o PROTOCOLO DE PRECIFICAÇÃO INCERTA: ofereça trabalhar de trás pra frente pela meta, ou ofereça acionar análise de mercado.`
    : "";

  const contextNote = (`ESTADO DO INTAKE:
Tipo: ${type} | Track: ${track}
Preenchidos (${answeredFields.length}): ${answeredFields.join(", ") || "nenhum"}
Faltando obrigatórios: ${missingRequired.slice(0, 8).join(", ") || "COMPLETO"}
Próxima pergunta: ${nextQuestion ? `"${nextQuestion.label}" [id:${nextQuestion.id}]` : "TODAS RESPONDIDAS"}
Resumo preenchidos:\n${filledSummary || "(vazio)"}${isResume ? `\n\nINSTRUÇÃO ESPECIAL: O usuário está RETOMANDO um briefing iniciado anteriormente. Apresente um resumo claro e objetivo do que já foi coletado (produto, audiência, metas já preenchidas), indique em qual fase estamos (${answeredFields.length === 0 ? "Fase 1 — Produto" : missingRequired.length === 0 ? "Completo" : "progresso parcial"}), e pergunte a próxima questão que falta de forma natural. Não comece do zero.` : ""}${pricingUncertaintyAlert}`.slice(0, 1800)) // hard cap
    + (marketIntelContext ? `\n\n${marketIntelContext}` : "");

  // Build messages for AI
  const actualUserMessage = isResume ? "Olá, estou retomando meu briefing. O que já foi preenchido e qual é o próximo passo?" : userMessage;

  const messages = [
    { role: "user" as const, content: contextNote },
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: actualUserMessage },
  ];

  const currentPhase = detectPhaseFromFields(answeredFields, missingRequired);
  const currentAgent = getAgentForPhase(currentPhase);

  let extracted: Record<string, unknown> = {};
  let aiMessage = "Desculpe, houve um problema. Tente novamente.";
  let nextQuestionId: string | null = nextMissing;
  let isComplete = false;
  let proposedType: string | null = null;
  let proposedTrack: string | null = null;
  let proposedReason: string | null = null;
  let agentId: string = currentAgent.id;

  // ── Checkpoint BEFORE the AI call ─────────────────────────────────────────────
  // Persist the user's message to history first, so a timeout/crash on the LLM
  // call never loses what the user just said — they can resend and resume from
  // the same turn instead of the conversation appearing to "eat" their message.
  const HIST_KEY = "_conversationHistory";
  const prevHistory = Array.isArray(currentIntake[HIST_KEY])
    ? (currentIntake[HIST_KEY] as Array<{ role: string; content: string }>)
    : [];
  const checkpointedHistory = [
    ...prevHistory,
    { role: "user", content: userMessage },
  ].slice(-40);
  try {
    await saveIntakeData(campaignId, workspaceId, { ...currentIntake, [HIST_KEY]: checkpointedHistory }, log);
  } catch (checkpointErr) {
    // Campaign may not be in 'intake' status — allow read-only conversation to continue.
    log.warn({ checkpointErr }, "pre-call checkpoint save skipped (campaign status prevents update)");
  }

  // Intake/briefing agent performs multi-step internal processing (defense
  // analysis, internal audits, quality checks) before emitting a final
  // response — this can legitimately take 2-5 minutes. Give it a 5-minute
  // ceiling (not the 30-min background-agent ceiling, since this is an
  // HTTP-request-scoped interactive call) and use the non-throwing safe
  // wrapper so a genuinely failed provider call (after retries) never hangs
  // or crashes the request — the checkpoint above already preserved the
  // user's message either way.
  const INTAKE_CHAT_TIMEOUT_MS = 5 * 60 * 1000;
  const safeResult = await completeWithAgentSafe(
    "strategy",
    CONVERSATION_SYSTEM,
    messages,
    workspaceId,
    log,
    campaignId,
    locale,
    undefined,
    undefined,
    INTAKE_CHAT_TIMEOUT_MS,
  );

  if (safeResult.success) {
    const jsonMatch = safeResult.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        agentId?: string;
        extracted?: Record<string, unknown>;
        aiMessage?: string;
        nextQuestionId?: string;
        isComplete?: boolean;
        proposedType?: string;
        proposedTrack?: string;
        proposedReason?: string;
      };
      agentId = parsed.agentId ?? currentAgent.id;
      extracted = parsed.extracted ?? {};
      aiMessage = parsed.aiMessage ?? aiMessage;
      nextQuestionId = parsed.nextQuestionId ?? null;
      isComplete = parsed.isComplete ?? false;
      proposedType = (parsed.proposedType as string) ?? null;
      proposedTrack = (parsed.proposedTrack as string) ?? null;
      proposedReason = (parsed.proposedReason as string) ?? null;
    } else {
      aiMessage = safeResult.content.replace(/^\[DEV MODE.*?\]/, "").trim() ||
        (nextQuestion ? `${nextQuestion.label}` : "Intake concluído!");
    }
  } else {
    log.warn({ error: safeResult.error, message: safeResult.message, campaignId }, "Conversational AI failed — returning graceful retry message, history already checkpointed");
    aiMessage = safeResult.error === "TIMEOUT"
      ? "Essa resposta está demorando mais que o esperado. Sua mensagem já foi salva — pode tentar reenviar em alguns segundos que eu continuo de onde paramos."
      : (nextQuestion
        ? `Tive um problema técnico momentâneo, mas sua mensagem foi salva. Podemos continuar: ${nextQuestion.label}${nextQuestion.description ? ` (${nextQuestion.description})` : ""}`
        : "Tive um problema técnico momentâneo, mas sua mensagem foi salva. Pode tentar novamente.");
  }

  // ── Persist the assistant turn on top of the already-checkpointed history ────
  const updatedHistory = [
    ...checkpointedHistory,
    { role: "assistant", content: aiMessage, agentId },
  ].slice(-40); // keep last 40 turns (20 exchanges)

  // Merge extracted fields + updated history and save. On AI failure, extracted
  // is empty so this is purely appending the assistant's graceful message —
  // no user-provided data is lost or reset.
  const mergedData = {
    ...currentIntake,
    ...(Object.keys(extracted).length > 0 ? extracted : {}),
    [HIST_KEY]: updatedHistory,
  };
  try {
    await saveIntakeData(campaignId, workspaceId, mergedData, log);
  } catch (saveErr) {
    // Campaign may not be in 'intake' status (e.g. live, completed) — allow
    // read-only AI conversation without persisting intake data.
    log.warn({ saveErr }, "saveIntakeData skipped (campaign status prevents update)");
  }

  // Fire-and-forget: trigger market intelligence analysis from within the
  // intake as soon as we know the product + audience/description. Idempotent
  // (skips when a report already exists for this campaign; reuses recent
  // reports for the same product/niche). The ready report + its clarifying
  // questions are injected into the next turns via buildIntakeMarketIntelContext.
  setImmediate(() => {
    triggerMarketIntelFromIntake(campaignId, workspaceId, mergedData, log).catch(
      (err) => log.warn({ err }, "Market intel intake trigger failed — non-blocking"),
    );
  });

  // Re-check completeness with new data
  const newCompleteness = validateIntakeCompleteness(type, track, mergedData);

  // Completion-signal safety net: the LLM may announce readiness for the
  // Master Plan in aiMessage (JSON-drift, missing flag, or free-text fallback
  // when jsonMatch fails above) without setting `isComplete` in its own JSON.
  // If the message itself tells the user the briefing is done, trust that
  // over a possibly-missed flag — otherwise the button never renders while
  // the header still shows a partial percentage (P0 coherence bug).
  isComplete = isComplete || newCompleteness.valid || messageSignalsCompletion(aiMessage);

  const requiredQsFinal = questions.filter(q => q.required);
  const totalRequired = requiredQsFinal.length;
  // Once complete (by any signal), always report 100% / all-required-answered —
  // never a stale partial number alongside a "you're done" message.
  const answeredRequired = isComplete ? totalRequired : totalRequired - newCompleteness.missingRequired.length;
  const progress = isComplete
    ? 100
    : Math.round(((questions.length - newCompleteness.missingRequired.length) / questions.length) * 100);
  const finalMissingRequired = isComplete ? [] : newCompleteness.missingRequired;

  return {
    agentId,
    extracted,
    aiMessage,
    nextQuestionId,
    isComplete,
    progress,
    answeredRequired,
    totalRequired,
    missingRequired: finalMissingRequired,
    intakeData: mergedData,
    proposedType,
    proposedTrack,
    proposedReason,
  };
}

// ─── Finalize intake ──────────────────────────────────────────────────────────

export async function finalizeIntake(
  campaignId: string,
  workspaceId: string,
  log: Logger
): Promise<Campaign> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  if (campaign.status !== "intake") {
    throw new ValidationError(`Campanha não está em intake (status atual: ${campaign.status})`);
  }

  const type = (campaign.type ?? "launch") as CampaignType;
  const track = (campaign.track ?? "six_digits") as CampaignTrack;
  const rawIntakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;

  // ── Apply sensible defaults for optional/inferrable fields ────────────────
  // These fields have reasonable defaults and should not block the command agent.
  // The AI conversation may not always ask for these explicitly.
  const intakeDefaults: Record<string, unknown> = {};

  // creator.name — extract from creator.positioning or product.name, or use fallback
  if (!rawIntakeData["creator.name"]) {
    const positioning = rawIntakeData["creator.positioning"] as string | undefined;
    const productName = rawIntakeData["product.name"] as string | undefined;
    // Try to extract a name from positioning text (first two words if it starts with a name-like pattern)
    const extractedName = positioning
      ? positioning.split(/\s+/).slice(0, 2).join(" ").replace(/[^a-zA-ZÀ-ÿ\s]/g, "").trim()
      : null;
    intakeDefaults["creator.name"] = (extractedName && extractedName.length > 2)
      ? extractedName
      : (productName ? `Especialista em ${productName}` : "Especialista");
  }

  // content.style — default educational + storytelling (fits most digital products)
  if (!rawIntakeData["content.style"]) {
    intakeDefaults["content.style"] = ["educational", "storytelling"];
  }

  // content.tone — default empathetic (connects with pain-point audiences)
  if (!rawIntakeData["content.tone"]) {
    intakeDefaults["content.tone"] = "empathetic";
  }

  // launch.scarcityMechanism — default deadline (most universal for launches)
  if (!rawIntakeData["launch.scarcityMechanism"]) {
    intakeDefaults["launch.scarcityMechanism"] = "deadline";
  }

  // campaign.hasAffiliate — default false (most creators start solo)
  if (rawIntakeData["campaign.hasAffiliate"] === undefined || rawIntakeData["campaign.hasAffiliate"] === null) {
    intakeDefaults["campaign.hasAffiliate"] = false;
  }

  // risk.tolerance — default moderate
  if (!rawIntakeData["risk.tolerance"]) {
    intakeDefaults["risk.tolerance"] = "moderate";
  }

  // campaign.type + campaign.track — inject from campaign DB columns so agents
  // that read intakeData["campaign.type"] / intakeData["campaign.track"] directly
  // (campaign-emotional-arc, strategic-doctrine, financial-projector,
  //  traffic-intelligence) always find a value instead of undefined.
  // These values come from the campaign row itself, not user input, so they are
  // always authoritative and never overwrite a user-supplied key.
  if (!rawIntakeData["campaign.type"]) {
    intakeDefaults["campaign.type"] = type;
  }
  if (!rawIntakeData["campaign.track"]) {
    intakeDefaults["campaign.track"] = track;
  }

  const intakeData = { ...rawIntakeData, ...intakeDefaults };

  const completeness = validateIntakeCompleteness(type, track, intakeData);
  const fieldsCount = Object.keys(intakeData).length;

  // Soft validation: require at least 3 fields collected; missing required fields only warn, don't block.
  // The conversational AI decides when it has enough — strict field-key matching would block valid intakes
  // where the AI stored data under slightly different keys than the static schema expects.
  if (fieldsCount < 3) {
    throw new ValidationError("Briefing muito curto. Continue a conversa com o agente antes de finalizar.");
  }
  if (!completeness.valid) {
    log.warn(
      { campaignId, missingRequired: completeness.missingRequired },
      "Finalizing intake with soft-incomplete fields — AI conversation marked complete"
    );
  }

  // Pre-populate campaign fields from intake data
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    status: "analyzing", // Advance out of intake so campaign detail page doesn't redirect back
  };

  // Helper: parse numeric values from intake data, handling Brazilian formats (R$1.997 / 30.000)
  const parseIntakeNumber = (raw: unknown): number | null => {
    if (raw === null || raw === undefined) return null;
    // Strip currency symbols, spaces, and reformat BRL thousands separator (period→nothing, comma→dot)
    const cleaned = String(raw).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  if (intakeData["campaign.revenueTarget"]) {
    const n = parseIntakeNumber(intakeData["campaign.revenueTarget"]);
    if (n !== null) updates["revenueTarget"] = String(Math.round(n));
  }
  if (intakeData["campaign.budget.total"]) {
    const n = parseIntakeNumber(intakeData["campaign.budget.total"]);
    if (n !== null) updates["budgetTotal"] = Math.round(n);
  }

  // Persist enriched intakeData (with applied defaults) so command agent reads complete data
  if (Object.keys(intakeDefaults).length > 0) {
    updates["intakeData"] = intakeData;
  }

  const [updated] = await db
    .update(campaignsTable)
    .set(updates)
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.intake.finalized",
    actor: "user",
    data: {
      fieldsCount: Object.keys(intakeData).length,
      requiredComplete: completeness.valid,
    },
  });

  log.info({ campaignId }, "Intake finalized — ready for orchestration");
  return updated!;
}

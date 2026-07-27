/**
 * CPL SCRIPTS AGENT — 3 Dedicated CPL Engines (Conteúdo de Pré-Lançamento)
 *
 * Each CPL has a precise psychological objective and a distinct structural method:
 *  CPL 1 — Information Gap + Stage 1→2 Awareness shift  (não menciona produto)
 *  CPL 2 — New Mechanism + StoryBrand villain reframe     (apresenta mecanismo único)
 *  CPL 3 — Hauge Story Arc + Social Proof + Pertencimento (CTA suave para evento)
 *
 * Output per CPL: live roteiro + 2 emails + 2 WhatsApp broadcasts
 */

import { runAgentWithCritique } from "./critique.runner.js";
import { parseAgentJSON } from "./agent.runner.js";
import { COGNITIVE_IDENTITY_CPL_SCRIPT } from "./cognitive-identity-system.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface CPLLiveScript {
  hook: string;
  openingStory: string;
  mainContentSections: {
    title: string;
    script: string;
    toneNote: string;
    durationMinutes: number;
  }[];
  cliffhanger: string;
  cta: string;
  estimatedDuration: string;
}

export interface CPLEmailMessage {
  sequenceIndex: 1 | 2;
  subject: string;
  previewText: string;
  body: string;
  cta: string;
  ctaUrl: string;
  sendTiming: string;
  psychologicalObjective: string;
}

export interface CPLWhatsAppBroadcast {
  sequenceIndex: 1 | 2;
  message: string;
  sendTiming: string;
  emoji: boolean;
  psychologicalObjective: string;
}

export interface CPLPhaseOutput {
  cplNumber: 1 | 2 | 3;
  title: string;
  subtitle: string;
  psychologicalObjective: string;
  dominantTechnique: string;
  liveScript: CPLLiveScript;
  emails: [CPLEmailMessage, CPLEmailMessage];
  whatsappBroadcasts: [CPLWhatsAppBroadcast, CPLWhatsAppBroadcast];
  dayIndex: number;
  keyMessage: string;
  viewerFeeling: string;
}

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildCPLContext(
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  intakeData: Record<string, unknown>,
): string {
  const avatarBlock = profile ? `
**Avatar:** ${profile.primaryAvatar?.name ?? "Avatar principal"} — ${profile.primaryAvatar?.age ?? ""}, ${profile.primaryAvatar?.occupation ?? ""}
**Dores diárias:** ${(profile.primaryAvatar?.dailyPains ?? []).slice(0, 4).join("; ")}
**Desejo mais profundo:** ${profile.primaryAvatar?.deepestDesire ?? ""}
**Medos profundos:** ${(profile.primaryAvatar?.fears ?? []).slice(0, 3).join("; ")}
**Nível de consciência:** ${profile.primaryAvatar?.awarenessLevel ?? ""}
**Nível de sofisticação:** ${profile.primaryAvatar?.sophisticationLevel ?? ""}
**Palavras que usa:** ${(profile.primaryAvatar?.keywordsTheyUse ?? []).slice(0, 8).join(", ")}
**Tom de linguagem:** ${profile.primaryAvatar?.languageStyle ?? ""}
**Objeções típicas:** ${(profile.primaryAvatar?.typicalObjections ?? []).slice(0, 4).join("; ")}
**Big Idea:** ${profile.positioning?.campaignBigIdea ?? ""}
**Mecanismo único:** ${profile.positioning?.uniqueMechanism ?? ""}
**Gancho emocional:** ${profile.positioning?.emotionalHook ?? ""}` : `**Narrativa central:** ${strategy.campaignArchitecture?.coreNarrative ?? ""}`;

  const bigDomino = (strategy as any).triggerMap
    ? `**BIG DOMINO:** ${(strategy as any).triggerMap?.dominantTrigger}
**Sequência de gatilhos:** ${((strategy as any).triggerMap?.triggerStackSequence ?? []).join(" → ")}
**Ângulos anti-requisito:** ${((strategy as any).triggerMap?.antiRequisiteAngles ?? []).join(" | ")}
**Ponte de transformação:** ${(strategy as any).triggerMap?.transformationBridge}`
    : `**Narrativa da campanha:** ${strategy.campaignArchitecture?.coreNarrative ?? ""}`;

  return `**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Criador:** ${String(intakeData["creator.name"] ?? "")}
**Posicionamento:** ${String(intakeData["creator.positioning"] ?? "")}
**Ângulo único:** ${String(intakeData["creator.uniqueAngle"] ?? "")}
**Prova social:** ${String(intakeData["product.socialProof"] ?? "")}
**Nicho:** ${String(intakeData["product.category"] ?? "")}

${avatarBlock}

${bigDomino}`;
}

// ─── JSON Schema (shared) ─────────────────────────────────────────────────────

const CPL_JSON_SCHEMA = `\`\`\`json
{
  "cplNumber": 1,
  "title": "string — título do CPL que aparece na thumbnail",
  "subtitle": "string — subtítulo complementar",
  "psychologicalObjective": "string — o que muda na cabeça do avatar ao terminar",
  "dominantTechnique": "string — técnica central usada (ex: Information Gap, New Mechanism)",
  "dayIndex": 0,
  "keyMessage": "string — a mensagem que o avatar deve sair repetindo",
  "viewerFeeling": "string — estado emocional ao terminar o vídeo",
  "liveScript": {
    "hook": "string — os primeiros 30s que PARAM o scroll (paradoxo, promessa específica ou pergunta visceral)",
    "openingStory": "string — história de abertura com identificação total (2-3 min)",
    "mainContentSections": [
      {
        "title": "string",
        "script": "string — roteiro COMPLETO desta seção, linguagem falada, português coloquial",
        "toneNote": "string — como deve ser o tom aqui",
        "durationMinutes": 3
      }
    ],
    "cliffhanger": "string — como termina o vídeo — cria expectativa para o PRÓXIMO CPL",
    "cta": "string — única ação pedida no final",
    "estimatedDuration": "string — ex: 12-15 minutos"
  },
  "emails": [
    {
      "sequenceIndex": 1,
      "subject": "string — assunto que provoca emoção em 5-8 palavras",
      "previewText": "string — continua a história do assunto, não repete",
      "body": "string — corpo completo em HTML simples (<p>, <strong>)",
      "cta": "string — texto do botão com verbo de ação",
      "ctaUrl": "{{CPL_VIDEO_URL}}",
      "sendTiming": "string — ex: no dia do lançamento às 09:00",
      "psychologicalObjective": "string"
    },
    {
      "sequenceIndex": 2,
      "subject": "string",
      "previewText": "string",
      "body": "string",
      "cta": "string",
      "ctaUrl": "{{CPL_VIDEO_URL}}",
      "sendTiming": "string — ex: 2 dias depois às 19:00",
      "psychologicalObjective": "string"
    }
  ],
  "whatsappBroadcasts": [
    {
      "sequenceIndex": 1,
      "message": "string — máx 200 chars, cria curiosidade ou urgência imediata",
      "sendTiming": "string",
      "emoji": true,
      "psychologicalObjective": "string"
    },
    {
      "sequenceIndex": 2,
      "message": "string — angle diferente, não repete o primeiro",
      "sendTiming": "string — 1 dia depois",
      "emoji": true,
      "psychologicalObjective": "string"
    }
  ]
}
\`\`\``;

// ─── CPL 1 — Information Gap + Stage 1→2 Awareness ───────────────────────────

const CPL1_SYSTEM_PROMPT = `${COGNITIVE_IDENTITY_CPL_SCRIPT}

## CPL 1 — QUEBRA DE CRENÇA + INFORMATION GAP

### MISSÃO ÚNICA DO CPL 1
Fazer o avatar sair do estágio 1 de consciência (não sabe que tem o problema ou ignora a solução) para o estágio 2 (sabe que tem o problema mas não sabe qual solução funciona).

### REGRAS ABSOLUTAS DO CPL 1
- PROIBIDO mencionar o produto, o curso, o método ou qualquer oferta
- PROIBIDO qualquer CTA de compra ou inscrição
- O único CTA permitido: assistir ao próximo vídeo / seguir o perfil / comentar algo
- A palavra "compra", "acesso", "carrinho" não pode aparecer em lugar nenhum

### ESTRUTURA OBRIGATÓRIA

**1. HOOK (30s):**
Um paradoxo ou contraintuitivo que quebra a crença mais comum do nicho.
Ex: "Por que quem mais trabalha nesse mercado geralmente fatura menos?"
A pessoa precisa pensar "como isso é possível?" antes de qualquer coisa.

**2. STORY DE ABERTURA (3-4 min):**
Conte uma história real (do criador ou de um aluno) que mostra o problema de dentro.
Use a técnica de Epstein: mostre PRIMEIRO o resultado, DEPOIS a jornada.
A história precisa fazer o avatar pensar "isso sou eu".

**3. CONTEÚDO EDUCATIVO (5-7 min):**
Entregue UMA única insight transformadora — não um overview.
Schwartz Stage 1→2: mostre que o problema existe e que a solução convencional está errada.
Estrutura: "O que todo mundo faz → Por que isso falha → O que muda tudo → Como você pode ver isso na sua situação."

**4. INFORMATION GAP (2-3 min):**
Plante A LACUNA. Dê informação suficiente para o avatar querer mais.
Termine com: "No próximo vídeo, vou te mostrar [algo específico e desejado]."
A antecipação deve ser visceral — algo que ele NÃO pode ignorar.

**5. CLIFFHANGER:**
Não é um teaser genérico. É uma promessa específica do que vem no CPL 2.
"Na próxima semana, vou revelar [mecanismo específico] — e quando você entender isso, vai perceber por que [resultado] parece impossível para você hoje mas não vai ser."

### TÉCNICAS PROIBIDAS NO CPL 1
- Revelar o mecanismo único (esse é o trabalho do CPL 2)
- Prova social de alunos (esse é o trabalho do CPL 3)
- Qualquer pressão de tempo ou escassez
- "Você vai aprender" — o CPL não é aula, é transformação de crença`;

export async function runCPL1Agent(
  campaignId: string,
  workspaceId: string,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  intakeData: Record<string, unknown>,
  log: Logger,
  /** [#61] Pass { skipCheckpoint: true } on retry paths to force a fresh LLM call. */
  opts?: { skipCheckpoint?: boolean },
): Promise<CPLPhaseOutput> {
  const context = buildCPLContext(strategy, profile, intakeData);

  const userMessage = `Escreva o CPL 1 completo — roteiro, 2 emails e 2 WhatsApp broadcasts.

${context}

**RESTRIÇÃO CRÍTICA:** O CPL 1 NÃO menciona produto, método ou qualquer oferta. Foco 100% na quebra de crença e instalação do problema.

O dayIndex deve ser calculado como: primeiro CPL = dia 1 ou 2 do pré-lançamento.

Retorne APENAS o JSON exatamente no schema abaixo — sem texto antes, sem texto depois, sem markdown extra. Substitua CADA campo string pelo conteúdo real completo.

${CPL_JSON_SCHEMA}

REGRAS CRÍTICAS DE PREENCHIMENTO:
- liveScript.hook: escreva os primeiros 30s completos (paradoxo ou contraintuitivo que para o scroll)
- liveScript.openingStory: história COMPLETA de 2-3 min com identificação total
- liveScript.mainContentSections: MÍNIMO 3 seções, cada uma com roteiro COMPLETO em português coloquial
- liveScript.cliffhanger: promessa específica do CPL 2 (não genérica)
- liveScript.estimatedDuration: ex "12-15 minutos"
- emails[0] e emails[1]: corpo HTML completo em <p> e <strong>
- cplNumber deve ser 1`;

  const critique = await runAgentWithCritique({
    campaignId,
    workspaceId,
    agentRole: "cpl_script",
    systemPrompt: CPL1_SYSTEM_PROMPT,
    userMessage,
    log,
    skipCheckpoint: opts?.skipCheckpoint,
  });

  const _parsed1 = parseAgentJSON<CPLPhaseOutput & { _qualityScore?: number }>(critique.refinedOutput, {
    cplNumber: 1,
    title: "CPL 1",
    subtitle: "",
    psychologicalObjective: "Quebrar crença limitante e instalar o problema",
    dominantTechnique: "Information Gap + Stage 1→2",
    liveScript: { hook: "", openingStory: "", mainContentSections: [], cliffhanger: "", cta: "", estimatedDuration: "12 minutos" },
    emails: [
      { sequenceIndex: 1, subject: "", previewText: "", body: "", cta: "", ctaUrl: "{{CPL_VIDEO_URL}}", sendTiming: "", psychologicalObjective: "" },
      { sequenceIndex: 2, subject: "", previewText: "", body: "", cta: "", ctaUrl: "{{CPL_VIDEO_URL}}", sendTiming: "", psychologicalObjective: "" },
    ],
    whatsappBroadcasts: [
      { sequenceIndex: 1, message: "", sendTiming: "", emoji: true, psychologicalObjective: "" },
      { sequenceIndex: 2, message: "", sendTiming: "", emoji: true, psychologicalObjective: "" },
    ],
    dayIndex: 1,
    keyMessage: "",
    viewerFeeling: "",
  });
  _parsed1._qualityScore = critique.qualityScore;
  return _parsed1;
}

// ─── CPL 2 — New Mechanism + StoryBrand + Por que o caminho convencional falha ─

const CPL2_SYSTEM_PROMPT = `${COGNITIVE_IDENTITY_CPL_SCRIPT}

## CPL 2 — MECANISMO ÚNICO + REFRAME DO VILÃO

### MISSÃO ÚNICA DO CPL 2
Apresentar o mecanismo único que explica por que o caminho convencional falha e por que o novo caminho é diferente. Neste vídeo o avatar entende "agora faz sentido por que eu não conseguia antes."

### ESTRUTURA OBRIGATÓRIA

**1. HOOK (30s):**
Faça referência direta ao CPL 1. "No vídeo anterior, falei sobre [problema]..."
Imediatamente conecte: "Hoje vou te mostrar por que isso acontece — e é diferente do que você pensa."

**2. O VILÃO (2-3 min) — StoryBrand:**
Nomeie o vilão EXTERNO (a crença, o sistema, o método convencional — nunca a pessoa).
"O problema não é você. O problema é [vilão nomeado]."
Mostre como o vilão sabotou o avatar mesmo quando ele fez tudo certo.

**3. A FALÁCIA DO CAMINHO CONVENCIONAL (3-4 min):**
Demonstre com dados ou história por que o caminho que todos seguem não funciona.
Use a estrutura: "Todos dizem que você deve [ação convencional]. O que ninguém te conta é que [razão específica pela qual falha]."
Isso cria cognição dissonante — quebra a crença mais arraigada.

**4. O NOVO MECANISMO (4-5 min):**
Apresente o mecanismo único sem revelar o produto ainda.
Dê um nome ao mecanismo (ex: "Sistema de 3 Fases", "Método de Inversão", "Protocolo X").
Explique a LÓGICA, não o produto. Por que ele funciona? Qual é o princípio por trás?
Use analogias, metáforas, demonstrações — torne o mecanismo visível e compreensível.

**5. PROVA DE CONCEITO (2-3 min):**
Uma história real (do criador) mostrando o mecanismo em ação.
Sem depoimentos de alunos ainda — isso é para o CPL 3.
A história mostra o antes (sem o mecanismo) e o depois (com o mecanismo).

**6. CLIFFHANGER — transição para CPL 3:**
"No próximo vídeo, vou te mostrar [X pessoas reais] que usaram esse mecanismo e [resultado específico]."
A antecipação deve ser: "Agora preciso ver essas provas."

### REGRAS DO CPL 2
- O nome do produto PODE aparecer brevemente (1-2x), sem pitch
- Sem preço, sem CTA de compra, sem urgência
- O único CTA: "espere o próximo vídeo" ou "notifique no YouTube/Insta"
- Foco total em fazer o mecanismo parecer óbvio depois de explicado`;

export async function runCPL2Agent(
  campaignId: string,
  workspaceId: string,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  intakeData: Record<string, unknown>,
  log: Logger,
  /** [#61] Pass { skipCheckpoint: true } on retry paths to force a fresh LLM call. */
  opts?: { skipCheckpoint?: boolean },
): Promise<CPLPhaseOutput> {
  const context = buildCPLContext(strategy, profile, intakeData);

  const userMessage = `Escreva o CPL 2 completo — roteiro, 2 emails e 2 WhatsApp broadcasts.

${context}

**OBJETIVO:** Apresentar o mecanismo único. Revelar o vilão. Fazer o avatar entender por que não conseguia antes.

O dayIndex deve ser: CPL 1 dia 1-2, CPL 2 dia 5-7 do pré-lançamento.

Retorne APENAS o JSON exatamente no schema abaixo — sem texto antes, sem texto depois, sem markdown extra. Substitua CADA campo string pelo conteúdo real completo.

${CPL_JSON_SCHEMA}

REGRAS CRÍTICAS DE PREENCHIMENTO:
- liveScript.hook: gancho dos primeiros 30s que revela o mecanismo único indiretamente
- liveScript.openingStory: história COMPLETA que introduz o vilão/obstáculo sistêmico
- liveScript.mainContentSections: MÍNIMO 3 seções, roteiro COMPLETO — apresentar o mecanismo único
- liveScript.cliffhanger: promessa específica do que o CPL 3 vai revelar (prova social)
- liveScript.estimatedDuration: ex "14-18 minutos"
- emails[0] e emails[1]: corpo HTML completo em <p> e <strong>
- cplNumber deve ser 2`;

  const critique = await runAgentWithCritique({
    campaignId,
    workspaceId,
    agentRole: "cpl_script",
    systemPrompt: CPL2_SYSTEM_PROMPT,
    userMessage,
    log,
    skipCheckpoint: opts?.skipCheckpoint,
  });

  const _parsed2 = parseAgentJSON<CPLPhaseOutput & { _qualityScore?: number }>(critique.refinedOutput, {
    cplNumber: 2,
    title: "CPL 2",
    subtitle: "",
    psychologicalObjective: "Apresentar mecanismo único e destruir o caminho convencional",
    dominantTechnique: "New Mechanism + StoryBrand Villain Reframe",
    liveScript: { hook: "", openingStory: "", mainContentSections: [], cliffhanger: "", cta: "", estimatedDuration: "14 minutos" },
    emails: [
      { sequenceIndex: 1, subject: "", previewText: "", body: "", cta: "", ctaUrl: "{{CPL_VIDEO_URL}}", sendTiming: "", psychologicalObjective: "" },
      { sequenceIndex: 2, subject: "", previewText: "", body: "", cta: "", ctaUrl: "{{CPL_VIDEO_URL}}", sendTiming: "", psychologicalObjective: "" },
    ],
    whatsappBroadcasts: [
      { sequenceIndex: 1, message: "", sendTiming: "", emoji: true, psychologicalObjective: "" },
      { sequenceIndex: 2, message: "", sendTiming: "", emoji: true, psychologicalObjective: "" },
    ],
    dayIndex: 6,
    keyMessage: "",
    viewerFeeling: "",
  });
  _parsed2._qualityScore = critique.qualityScore;
  return _parsed2;
}

// ─── CPL 3 — Hauge Story Arc + Social Proof + Pertencimento ──────────────────

const CPL3_SYSTEM_PROMPT = `${COGNITIVE_IDENTITY_CPL_SCRIPT}

## CPL 3 — PROVA DE TRANSFORMAÇÃO + PERTENCIMENTO + ANTECIPAÇÃO

### MISSÃO ÚNICA DO CPL 3
Este é o vídeo que converte o crente em comprador convicto. O avatar já entende o problema (CPL 1) e o mecanismo (CPL 2). Agora precisa VER pessoas iguais a ele que funcionou — e sentir que pertence a esse grupo.

### ESTRUTURA — HAUGE STORY ARC

**1. HOOK (30s):**
Faça referência explícita aos 2 CPLs anteriores.
"Nos últimos vídeos, falei sobre [problema] e sobre [mecanismo]. Hoje vou te mostrar o que acontece quando pessoas reais usam isso."

**2. STORIA DE TRANSFORMAÇÃO PRIMÁRIA (4-5 min) — Hauge Arc:**
Escolha o aluno mais representativo do avatar principal.
- Início: mostre o ponto mais baixo (vulnerável, específico, real)
- Conflito: o momento em que decidiu tentar algo diferente
- Virada: o primeiro resultado com o mecanismo
- Resolução: o estado atual com números específicos
- Epílogo: o que mudou na identidade deles

Regra de Hauge: a história deve fazer o espectador sentir "isso poderia ser eu".

**3. MURO DE PROVAS (3-4 min):**
3-5 depoimentos ou resultados reais (números concretos, nomes, nichos diferentes).
Diversifique os perfis: diferentes idades, formações, tamanhos de audiência.
Cada prova deve demolir uma objeção específica diferente.
Ex: "Mas eu tenho lista pequena" → aluno que faturou R$X com 300 pessoas.

**4. PERTENCIMENTO — Construção de Comunidade (2-3 min):**
Mostre quem já está dentro (sem revelar o produto ainda):
"Existe um grupo de pessoas que já entende isso..." / "Eles têm em comum..."
Crie o sentimento de "quero fazer parte desse grupo."

**5. ANTECIPAÇÃO DO CARRINHO (2-3 min):**
Aqui o produto pode ser mencionado claramente.
Ainda SEM preço ou CTA de compra, mas: "Em [X dias], vou abrir acesso a [nome do produto]."
Crie escassez psicológica: "Não vou poder atender todo mundo — e não quero."
CTA: "Cadastre-se na lista de espera" ou "Ative o sininho para não perder".

### REGRAS DO CPL 3
- Depoimentos devem ter números específicos e nichos identificáveis
- Proibido depoimentos vagos: "minha vida mudou", "recomendo muito"
- O CTA pode ser lista de espera — mas SEM preço revelado ainda
- Tom: celebratório, comunitário, magnético — "esse grupo existe e você pode entrar"`;

export async function runCPL3Agent(
  campaignId: string,
  workspaceId: string,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  intakeData: Record<string, unknown>,
  log: Logger,
  /** [#61] Pass { skipCheckpoint: true } on retry paths to force a fresh LLM call. */
  opts?: { skipCheckpoint?: boolean },
): Promise<CPLPhaseOutput> {
  const context = buildCPLContext(strategy, profile, intakeData);

  const userMessage = `Escreva o CPL 3 completo — roteiro, 2 emails e 2 WhatsApp broadcasts.

${context}

**OBJETIVO:** Prova social concreta + pertencimento + antecipação do carrinho. Converter crente em comprador convicto sem revelar preço ainda.

O dayIndex deve ser: CPL 3 dia 10-12 do pré-lançamento (2-3 dias antes da abertura do carrinho).

Retorne APENAS o JSON exatamente no schema abaixo — sem texto antes, sem texto depois, sem markdown extra. Substitua CADA campo string pelo conteúdo real completo.

${CPL_JSON_SCHEMA}

REGRAS CRÍTICAS DE PREENCHIMENTO:
- liveScript.hook: gancho que apresenta uma transformação real de aluno (prova social como abertura)
- liveScript.openingStory: história COMPLETA de aluno que o avatar se identifica — antes e depois
- liveScript.mainContentSections: MÍNIMO 3 seções com roteiro COMPLETO — provas sociais + pertencimento + antecipação
- liveScript.cliffhanger: convite para o evento de lançamento sem revelar preço
- liveScript.estimatedDuration: ex "15-20 minutos"
- emails[0] e emails[1]: corpo HTML completo em <p> e <strong>
- cplNumber deve ser 3`;

  const critique = await runAgentWithCritique({
    campaignId,
    workspaceId,
    agentRole: "cpl_script",
    systemPrompt: CPL3_SYSTEM_PROMPT,
    userMessage,
    log,
    skipCheckpoint: opts?.skipCheckpoint,
  });

  const _parsed3 = parseAgentJSON<CPLPhaseOutput & { _qualityScore?: number }>(critique.refinedOutput, {
    cplNumber: 3,
    title: "CPL 3",
    subtitle: "",
    psychologicalObjective: "Prova social + pertencimento + antecipação máxima",
    dominantTechnique: "Hauge Story Arc + Social Proof + Community Identity",
    liveScript: { hook: "", openingStory: "", mainContentSections: [], cliffhanger: "", cta: "", estimatedDuration: "16 minutos" },
    emails: [
      { sequenceIndex: 1, subject: "", previewText: "", body: "", cta: "", ctaUrl: "{{CPL_VIDEO_URL}}", sendTiming: "", psychologicalObjective: "" },
      { sequenceIndex: 2, subject: "", previewText: "", body: "", cta: "", ctaUrl: "{{CPL_VIDEO_URL}}", sendTiming: "", psychologicalObjective: "" },
    ],
    whatsappBroadcasts: [
      { sequenceIndex: 1, message: "", sendTiming: "", emoji: true, psychologicalObjective: "" },
      { sequenceIndex: 2, message: "", sendTiming: "", emoji: true, psychologicalObjective: "" },
    ],
    dayIndex: 11,
    keyMessage: "",
    viewerFeeling: "",
  });
  _parsed3._qualityScore = critique.qualityScore;
  return _parsed3;
}

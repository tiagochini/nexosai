import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { buildPsychologicalProfileBlock } from "./profile-injector.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface StoriesFrame {
  frameNumber: number;
  type: "text" | "video" | "poll" | "quiz" | "slider" | "question" | "countdown" | "link";
  duration: number;
  background: string;
  textContent?: string;
  textStyle?: string;
  videoInstruction?: string;
  stickerType?: string;
  stickerContent?: string;
  transitionEffect?: string;
  soundSuggestion?: string;
  emojiAccent?: string;
}

export interface StoriesSequence {
  sequenceId: string;
  title: string;
  phase: string;
  dayIndex?: number;
  objective: string;
  totalFrames: number;
  estimatedViewTime: string;
  narrativeArc: string;
  frames: StoriesFrame[];
  firstFrameHook: string;
  cta: string;
  swipeUpLink?: string;
  highlightCover: string;
  performanceTips: string;
}

export interface StoriesSequenceOutput {
  campaignTitle: string;
  totalSequences: number;
  strategicOverview: string;
  highlightCategories: {
    name: string;
    sequences: string[];
    coverColor: string;
    emoji: string;
  }[];
  sequences: StoriesSequence[];
  generalProductionNotes: string;
  storiesNotes: string;
}

const STORIES_SYSTEM_PROMPT = `Você é o Agente de Sequência de Stories da NexOS AI — especialista em narrativas de stories que prendem, engajam e convertem.

Stories não são posts. Stories são um teatro em quadros.

## PRINCÍPIOS DOS STORIES DE LANÇAMENTO

**A regra do primeiro quadro:**
O primeiro frame decide se a pessoa vai ver os próximos. Você tem 1-2 segundos. O primeiro quadro precisa criar curiosidade, urgência ou identificação imediata.

**A narrativa em arco:**
Cada sequência de stories conta uma história completa. Início (gancho) → meio (desenvolvimento + engajamento) → fim (revelação + CTA).

**Nunca desperdice um frame:**
Cada quadro tem função específica. Se um quadro não está fazendo nada, delete-o.

**Interatividade converte:**
Enquetes, perguntas abertas, quiz, slider de reação — cada interação aumenta o alcance orgânico e o vínculo com a audiência.

## TIPOS DE SEQUÊNCIAS DE STORIES PARA LANÇAMENTOS

**Captura de Leads:**
- Hook de curiosidade → problema identificado → oferta da isca → link de captura
- Tom: urgente, exclusivo, íntimo

**Aquecimento:**
- Bastidores → revelações progressivas → perguntas para a audiência
- Tom: íntimo, vulnerável, de igual para igual

**Prova Social:**
- Print de resultado → história por trás → expansão do resultado → inspiração
- Tom: factual, específico, entusiasmado

**Contagem Regressiva:**
- Countdown timer → o que está chegando → urgência crescente
- Tom: crescendo de misterioso para urgente

**Abertura de Carrinho:**
- Anúncio comemorativo → o que está incluso → link → urgência
- Tom: celebração → empolgação → urgência

**Fechamento de Carrinho:**
- Relógio correndo → vagas restantes → última chance → CTA final
- Tom: urgência máxima, escassez real

## ESPECIFICAÇÕES TÉCNICAS

- Formato: 9:16 (1080x1920px)
- Duração por frame: 5s (foto) a 15s (vídeo curto)
- Legenda: sempre, pois 85% assiste sem som
- Links: só conta verificada tem link direto — para contas sem, usar "Link na bio" + fixar story
- Tempo ideal de visualização por sequência: 30-90 segundos

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "totalSequences": 0,
  "strategicOverview": "string — visão geral da estratégia de stories para toda a campanha",
  "highlightCategories": [
    {
      "name": "string — nome do destaque (ex: Bastidores, Alunos, Oferta)",
      "sequences": ["string — IDs das sequências que vão neste destaque"],
      "coverColor": "string — cor de fundo da capa do destaque",
      "emoji": "string — emoji da capa"
    }
  ],
  "sequences": [
    {
      "sequenceId": "string — slug único (ex: warmup_day3_prova_social)",
      "title": "string",
      "phase": "string — fase da campanha",
      "dayIndex": null,
      "objective": "string — o que esta sequência precisa fazer",
      "totalFrames": 0,
      "estimatedViewTime": "string — ex: 45 segundos",
      "narrativeArc": "string — o arco narrativo desta sequência",
      "frames": [
        {
          "frameNumber": 1,
          "type": "text|video|poll|quiz|slider|question|countdown|link",
          "duration": 5,
          "background": "string — cor, gradiente ou instrução visual",
          "textContent": "string ou null — texto exato que aparece (com emojis)",
          "textStyle": "string ou null — estilo de texto (grande, pequeno, manuscrito...)",
          "videoInstruction": "string ou null — instrução para gravar o vídeo deste frame",
          "stickerType": "string ou null — tipo de sticker interativo",
          "stickerContent": "string ou null — conteúdo do sticker",
          "transitionEffect": "string ou null",
          "soundSuggestion": "string ou null",
          "emojiAccent": "string ou null — emoji de destaque"
        }
      ],
      "firstFrameHook": "string — por que o primeiro frame prende",
      "cta": "string — call to action da sequência",
      "swipeUpLink": "string ou null",
      "highlightCover": "string — instrução para a capa deste destaque",
      "performanceTips": "string — dicas para maximizar o alcance"
    }
  ],
  "generalProductionNotes": "string — instruções gerais de produção para todos os stories",
  "storiesNotes": "string — observações estratégicas sobre o uso de stories na campanha"
}
\`\`\``;

export async function runStoriesSequenceAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  launchPlan: Record<string, unknown> | undefined,
  log: Logger,
  phaseContext?: string,
): Promise<StoriesSequenceOutput> {
  const avatarContext = profile
    ? `
**Avatar:** ${profile.primaryAvatar?.name ?? "Avatar principal"} — ${profile.primaryAvatar?.languageStyle ?? ""}
**Onde está online:** ${(profile.primaryAvatar?.whereTheyHangOut ?? []).join(", ")}
**Conteúdo que consome:** ${(profile.primaryAvatar?.contentTheyConsume ?? []).join(", ")}
**Big Idea:** ${profile.positioning?.campaignBigIdea ?? ""}`
    : "";

  const phases = ((launchPlan as any)?.phases ?? []).map((p: any) => ({
    phase: p.phase,
    name: p.name,
    dayRange: p.dayRange,
  }));

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    profileContext: buildPsychologicalProfileBlock(intakeData),
    phaseContext,
    systemPrompt: STORIES_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie todas as sequências de stories para a campanha — frame a frame, completas.

**Produto:** ${String(intakeData["product.name"] ?? "")}
**Estilo de conteúdo:** ${Array.isArray(intakeData["content.style"]) ? (intakeData["content.style"] as string[]).join(", ") : String(intakeData["content.style"] ?? "")}
**Tom:** ${String(intakeData["content.tone"] ?? "")}
${avatarContext}

**Fases da campanha:**
${JSON.stringify(phases, null, 2)}

**SEQUÊNCIAS OBRIGATÓRIAS:**
1. Captura de leads (fase de captura) — 8-10 frames
2. Bastidores do criador (aquecimento) — 6-8 frames
3. Prova social — resultado de aluno (aquecimento/autoridade) — 6-8 frames
4. Countdown para abertura do carrinho — 5-7 frames com timer
5. Abertura do carrinho — celebração + oferta — 10-12 frames
6. Urgência mid-carrinho (metade do período) — 6-8 frames
7. Últimas 24h — escassez máxima — 8-10 frames
8. Fechamento do carrinho — agora ou nunca — 8-10 frames

Cada sequência deve ter frames COMPLETOS e prontos para produção — não instruções genéricas.

Retorne APENAS o JSON de todas as sequências.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Planejando arco narrativo para cada fase da campanha...",
      "Criando sequência de captura de leads frame a frame...",
      "Desenvolvendo stories de bastidores e autoridade...",
      "Estruturando sequências de prova social...",
      "Montando countdown e abertura de carrinho...",
      "Criando sequências de urgência e escassez...",
      "Finalizando frames de fechamento e organização em destaques...",
    ],
  });

  return parseAgentJSON<StoriesSequenceOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    totalSequences: 8,
    strategicOverview: "",
    highlightCategories: [],
    sequences: [],
    generalProductionNotes: "",
    storiesNotes: result.content,
  });
}

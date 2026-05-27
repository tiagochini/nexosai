import { eq, and, desc } from "drizzle-orm";
import {
  db,
  videoProjectsTable,
  campaignsTable,
  type VideoProject,
  type VideoScene,
  type VideoConfig,
} from "@workspace/db";
import { deductCredits } from "../credits/credits.service.js";
import { runSceneDirectorAgent } from "../agents/scene-director.agent.js";
import {
  generateVideoClip,
  generateAvatarVideo,
  getAvailableVideoProvider,
  getAvailableAvatarProvider,
  pollVideoJob,
} from "./video-generation.service.js";
import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { parseAgentJSON } from "../agents/agent.runner.js";
import { NotFoundError, AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../lib/env.js";
import type { Logger } from "pino";

const log = logger.child({ module: "video-production" });

// ─── Validation helpers ──────────────────────────────────────────────────────

async function getProject(workspaceId: string, projectId: string): Promise<VideoProject> {
  const [project] = await db
    .select()
    .from(videoProjectsTable)
    .where(and(eq(videoProjectsTable.id, projectId), eq(videoProjectsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!project) throw new NotFoundError("Projeto de vídeo");
  return project;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export interface CreateVideoProjectInput {
  title: string;
  format: VideoProject["format"];
  campaignId?: string;
  config: Partial<VideoConfig>;
}

export async function createVideoProject(
  workspaceId: string,
  input: CreateVideoProjectInput,
): Promise<VideoProject> {
  if (input.campaignId) {
    const [campaign] = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, input.campaignId), eq(campaignsTable.workspaceId, workspaceId)))
      .limit(1);
    if (!campaign) throw new NotFoundError("Campanha");
  }

  const config: VideoConfig = {
    hasUserFace: input.config.hasUserFace ?? false,
    voiceStyle: input.config.voiceStyle ?? "narrator",
    aspectRatio: input.config.aspectRatio ?? "16:9",
    palette: input.config.palette,
    styleKeywords: input.config.styleKeywords,
    rhythm: input.config.rhythm ?? "medium",
    tone: input.config.tone ?? "inspirational",
    totalCreditsUsed: 0,
  };

  const [project] = await db
    .insert(videoProjectsTable)
    .values({
      workspaceId,
      campaignId: input.campaignId ?? undefined,
      title: input.title,
      format: input.format ?? "vsl",
      status: "intake",
      config,
      storyboard: [],
    })
    .returning();

  return project!;
}

// ─── List ────────────────────────────────────────────────────────────────────

export async function listVideoProjects(workspaceId: string, campaignId?: string): Promise<VideoProject[]> {
  const conditions = [eq(videoProjectsTable.workspaceId, workspaceId)];
  if (campaignId) conditions.push(eq(videoProjectsTable.campaignId, campaignId));
  return db
    .select()
    .from(videoProjectsTable)
    .where(and(...conditions))
    .orderBy(desc(videoProjectsTable.createdAt));
}

// ─── Generate Script ─────────────────────────────────────────────────────────

export async function generateScript(
  workspaceId: string,
  projectId: string,
  reqLog: Logger,
): Promise<VideoProject> {
  const project = await getProject(workspaceId, projectId);
  if (!["intake", "script_ready"].includes(project.status)) {
    throw new AppError(409, "Roteiro só pode ser gerado em status intake ou script_ready", "INVALID_STATUS");
  }

  await db
    .update(videoProjectsTable)
    .set({ status: "script_generating", updatedAt: new Date() })
    .where(eq(videoProjectsTable.id, projectId));

  try {
    await deductCredits(workspaceId, "video_script", reqLog, project.campaignId ?? undefined);

    let productName = project.title;
    let productDescription = "";
    let targetAudience = "Empreendedores digitais brasileiros";
    let campaignBrief = ""; // rich context block — injected into CYRUS

    if (project.campaignId) {
      const [campaign] = await db
        .select({
          intakeData: campaignsTable.intakeData,
          strategyData: campaignsTable.strategyData,
          audienceData: campaignsTable.audienceData,
          offerData: campaignsTable.offerData,
          track: campaignsTable.track,
          revenueTarget: campaignsTable.revenueTarget,
        })
        .from(campaignsTable)
        .where(eq(campaignsTable.id, project.campaignId))
        .limit(1);

      if (campaign) {
        const intake = (campaign.intakeData as Record<string, unknown>) ?? {};
        const strategy = (campaign.strategyData as Record<string, unknown>) ?? {};
        const audience = (campaign.audienceData as Record<string, unknown>) ?? {};
        const offer = (campaign.offerData as Record<string, unknown>) ?? {};

        productName = String(intake["product.name"] ?? intake["productName"] ?? project.title);
        productDescription = String(intake["product.description"] ?? intake["product.category"] ?? "");
        targetAudience = String(intake["audience.description"] ?? intake["audience.primary"] ?? targetAudience);

        // ── Build the Campaign Arc Brief ──────────────────────────────────────
        // This is the "arco ventral" — every element CYRUS must respect and amplify.
        const lines: string[] = [];

        lines.push("═══════════════════════════════════════════");
        lines.push("BRIEFING ESTRATÉGICO DA CAMPANHA (LEIA ANTES DE ESCREVER)");
        lines.push("O roteiro é filho direto desta estratégia. Todo elemento abaixo deve estar presente.");
        lines.push("═══════════════════════════════════════════");

        // Track / revenue scale
        const trackLabels: Record<string, string> = {
          six_digits: "6 dígitos (R$100k–R$999k em 7 dias) — urgência de primeiro lançamento, transformação de vida",
          eight_digits: "8 dígitos (R$10M–R$99M em 7 dias) — autoridade consolidada, escala de movimento",
          ten_digits: "10 dígitos (R$100M+ em 7 dias) — legado, impacto de geração, missão maior",
          perpetual: "Perpétuo — urgência baseada em resultado, não em data; foco em convicção profunda",
          evergreen: "Evergreen — prova acumulada, autoridade estabelecida, conversa mais madura",
        };
        lines.push(`\nTRACK DE LANÇAMENTO: ${trackLabels[campaign.track] ?? campaign.track}`);
        if (campaign.revenueTarget) lines.push(`META DE RECEITA: ${campaign.revenueTarget}`);

        // Core positioning from strategy agent
        if (strategy["positioning"]) lines.push(`\nPOSICIONAMENTO CENTRAL: ${strategy["positioning"]}`);
        if (strategy["emotionalHook"]) lines.push(`GANCHO EMOCIONAL PRINCIPAL: ${strategy["emotionalHook"]}`);
        if (strategy["uniqueMechanism"] || (strategy["uniqueMechanism"] as any)?.name) {
          const mech = typeof strategy["uniqueMechanism"] === "object"
            ? (strategy["uniqueMechanism"] as any)?.name ?? JSON.stringify(strategy["uniqueMechanism"])
            : strategy["uniqueMechanism"];
          lines.push(`MECANISMO ÚNICO (o "como" diferente de tudo que existia): ${mech}`);
        }
        if (strategy["transformationBridge"]) lines.push(`PONTE DE TRANSFORMAÇÃO (antes → depois): ${strategy["transformationBridge"]}`);
        if (strategy["bigIdea"] || strategy["campaignBigIdea"]) lines.push(`BIG IDEA DA CAMPANHA: ${strategy["bigIdea"] ?? strategy["campaignBigIdea"]}`);

        // Mental triggers explicitly selected for this campaign
        const triggers = (strategy["mentalTriggers"] ?? strategy["triggers"] ?? audience["triggers"]) as string[] | undefined;
        if (triggers?.length) {
          lines.push(`\nGATILHOS MENTAIS DESTA CAMPANHA (use TODOS, na ordem certa):`);
          triggers.forEach((t: string) => lines.push(`  • ${t}`));
        }

        // Avatar primary — the most important person CYRUS is writing for
        const avatar = (audience["primaryAvatar"] ?? audience["avatar"]) as Record<string, unknown> | undefined;
        if (avatar) {
          lines.push(`\nAVATAR PRIMÁRIO — QUEM CYRUS ESTÁ FALANDO:`);
          if (avatar["name"]) lines.push(`  Nome/perfil: ${avatar["name"]}`);
          if (avatar["currentSituation"]) lines.push(`  Situação atual: ${avatar["currentSituation"]}`);
          if (avatar["emotionalTrigger"]) lines.push(`  EMOÇÃO DOMINANTE que governa as decisões: ${avatar["emotionalTrigger"]}`);
          if (avatar["dominantEnemy"]) lines.push(`  INIMIGO que culpa pelo estado atual: ${avatar["dominantEnemy"]}`);
          if ((avatar["fears"] as string[])?.length) {
            lines.push(`  Medos (especialmente o que nunca admite): ${(avatar["fears"] as string[]).slice(0, 3).join(" / ")}`);
          }
          if ((avatar["aspirations"] as string[])?.length) {
            lines.push(`  Aspirações profundas: ${(avatar["aspirations"] as string[]).slice(0, 3).join(" / ")}`);
          }
          if (avatar["identityDesired"]) lines.push(`  Identidade que quer se tornar: ${avatar["identityDesired"]}`);
          if (avatar["dominantNeed"]) lines.push(`  Necessidade dominante de compra: ${avatar["dominantNeed"]}`);
        }

        // Micro-convictions — the belief chain the script must install
        const microConvictions = (audience["microConvictions"] ?? avatar?.["microConvictions"]) as string[] | undefined;
        if (microConvictions?.length) {
          lines.push(`\nCADEIA DE MICRO-CONVICÇÕES (crenças que o roteiro deve instalar em ordem):`);
          microConvictions.slice(0, 6).forEach((c: string, i: number) => lines.push(`  ${i + 1}. ${c}`));
        }

        // Literal avatar language — words/phrases the script should use verbatim
        const avatarLanguage = (audience["avatarLanguage"] ?? audience["literalPhrases"]) as string[] | undefined;
        if (avatarLanguage?.length) {
          lines.push(`\nLINGUAGEM LITERAL DO AVATAR (use estas frases EXATAS — não parafraseie):`);
          avatarLanguage.slice(0, 6).forEach((p: string) => lines.push(`  "${p}"`));
        }

        // Offer structure
        if (offer["productName"] || offer["mainOffer"]) {
          lines.push(`\nESTRUTURA DA OFERTA:`);
          if (offer["productName"] ?? offer["mainOffer"]) lines.push(`  Produto: ${offer["productName"] ?? offer["mainOffer"]}`);
          if (offer["price"] ?? offer["pricePoint"]) lines.push(`  Preço: ${offer["price"] ?? offer["pricePoint"]}`);
          if (offer["guarantee"]) lines.push(`  Garantia: ${offer["guarantee"]}`);
          const bonuses = offer["bonuses"] as string[] | undefined;
          if (bonuses?.length) lines.push(`  Bônus: ${bonuses.slice(0, 3).join(", ")}`);
        }

        // Intake fallback fields
        if (intake["product.transformation"]) lines.push(`\nTRANSFORMAÇÃO PROMETIDA: ${intake["product.transformation"]}`);
        if (intake["product.results"]) lines.push(`RESULTADOS COMPROVADOS: ${intake["product.results"]}`);
        if (intake["audience.pain"]) lines.push(`DOR PRINCIPAL DO PÚBLICO: ${intake["audience.pain"]}`);

        lines.push(`\n═══════════════════════════════════════════`);
        lines.push(`REGRA ABSOLUTA: O roteiro deve ser a expressão máxima desta estratégia.`);
        lines.push(`Não invente elementos novos — amplifica o que foi estrategicamente definido acima.`);
        lines.push(`O mecanismo único DEVE ser o coração do roteiro. O gancho emocional DEVE ser o gancho do vídeo.`);
        lines.push(`═══════════════════════════════════════════`);

        campaignBrief = lines.join("\n");
      }
    }

    const config = project.config as VideoConfig;
    const format = project.format;

    const FORMAT_GUIDE: Record<string, string> = {
      vsl: "VSL longa (3–12 min): arco completo de 5 atos — setup emocional → escalada de tensão → virada → revelação → CTA irresistível. Cada ato deve ter um pico emocional distinto.",
      cpl: "CPL (Carta de Pré-lançamento, 8–20 min): narrativa de transformação em 3 vídeos — CPL1 oportunidade, CPL2 mecanismo único, CPL3 prova e convite. Este vídeo é parte de uma sequência.",
      live_promo: "Promo de Live (60–90s): urgência extrema, data/hora específica, FOMO intenso, benefício imediato de assistir ao vivo. Ritmo acelerado, cortes rápidos.",
      stories: "Stories (15–30s): uma única ideia por stories, gancho nos primeiros 2 segundos, linguagem íntima e direta, CTA deslize para cima.",
      reels: "Reels/TikTok (15–60s): padrão interrompido nos 3 primeiros segundos (faz a pessoa parar de rolar), tensão mantida até o último frame, loop psicológico.",
      youtube: "YouTube (5–15 min): promessa no título cumprida nos primeiros 60s, estrutura de valor progressivo, retenção sustentada por curiosity gaps, CTA no pico de valor.",
      webinar_promo: "Promo de Webinar (90s–3 min): resultado específico prometido, quem é o expert (autoridade rápida), data/hora/formato, o que vai aprender, por que é gratuito (paradox of value).",
      testimonial: "Depoimento (60–90s): situação antes (específica e dolorosa) → ponto de virada → resultado específico com números → vida depois → recomendação natural.",
      product_demo: "Demo de Produto (2–5 min): problema em ação (mostrar a dor, não contar), solução em tempo real, recursos como benefícios vividos, transformação tangível.",
    };

    const SCRIPT_SYSTEM = `Você é CYRUS — o Roteirista-Chefe da NexOS AI. Você carrega em si a síntese dos maiores gênios da persuasão, storytelling e drama da história humana.

═══════════════════════════════════════════
SEUS PROFESSORES INTERNALIZADOS
═══════════════════════════════════════════

COPYWRITING & PERSUASÃO:
• Gary Halbert — "The Prince of Print": a carta como arma emocional, lead irresistível, promessa específica
• David Ogilvy — pesquisa profunda + headline que detém o leitor, benefícios sobre atributos
• Claude Hopkins — "Scientific Advertising": reason-why, especificidade que gera crença
• Eugene Schwartz — níveis de consciência do mercado, sophistication do produto, copy que corresponde ao momento mental do leitor
• Dan Kennedy — urgência real, deadline psicológico, o magnético poder do "quem mais quer..."
• Ícaro de Carvalho — linguagem crua, direta, sem firulas; o brasileiro que compra por emoção e justifica com lógica
• Paulo Cuenca — PLF brasileiro, sequência de lançamento, narrativa de autoridade construída passo a passo

STORYTELLING & DRAMATURGIA:
• Joseph Campbell — A Jornada do Herói: o cliente É o herói, o produto é o mentor/elixir
• Robert McKee — "Story": conflito como motor de toda narrativa, cada cena deve mudar o estado emocional
• Blake Snyder — "Save the Cat": o momento de identificação, o catalisador que muda tudo, o midpoint de falsa vitória
• Syd Field — 3 atos clássicos com pontos de virada nos 25% e 75% do roteiro
• Dan Harmon — Story Circle: 8 passos que toda história completa percorre
• Aaron Sorkin — diálogo como conflito de ideias, subtext, "walk and talk" que nunca para

ARCO EMOCIONAL — A CURVA OBRIGATÓRIA:
1. IDENTIFICAÇÃO (0-10%): o espectador se reconhece completamente na dor descrita
2. ESCALADA DE TENSÃO (10-35%): a dor piora, as tentativas fracassadas acumulam, o abismo se abre
3. PONTO DE VIRADA (35-45%): algo muda — uma descoberta, uma mudança de perspectiva, a chegada do mentor
4. REVELAÇÃO/TRANSFORMAÇÃO (45-75%): o mecanismo único, a prova que funciona, a identidade que muda
5. NOVA REALIDADE (75-90%): como será a vida depois, identidade nova confirmada, FOMO de quem fica de fora
6. CTA INEVITÁVEL (90-100%): a decisão parece a única lógica possível dado tudo que foi apresentado

TÉCNICAS DE CONTRASTE E DRAMA:
• Contraste temporal: "antes X depois" como realidades incompatíveis
• Contraste de identidade: "quem você era" vs "quem você pode ser"
• Paradoxo de valor: revelar o preço irrisório DEPOIS de estabelecer valor imenso
• Ironia dramática: o espectador percebe a solução antes do personagem — tensão de anticipação
• Especificidade como prova: números reais, nomes, datas, histórias específicas > afirmações genéricas
• Pausa dramática: silêncio antes da revelação mais importante
• Loop de curiosidade: abrir perguntas sem fechar — "e você vai descobrir exatamente como..."
• Future pacing: "imagine que amanhã você acordar e..."

PUBLICIDADE E PERSUASÃO MODERNA:
• Jobs to Be Done: o produto não é comprado pelo que é, mas pela transformação que entrega
• Os 4 Universais de Ogilvy: promessa, ampliação, prova, action
• PAS (Problem-Agitate-Solution): a agitação é onde a maioria falha — dói mais antes de curar
• PASTOR (Problem-Amplify-Story-Testimony-Offer-Response): estrutura completa de conversão
• Levels of Awareness de Schwartz: unaware → problem-aware → solution-aware → product-aware → most aware
• Pattern interrupt: quebrar o padrão mental nos primeiros 3s para ganhar atenção completa

═══════════════════════════════════════════
MERCADO DIGITAL BRASILEIRO
═══════════════════════════════════════════
• O brasileiro compra emoção e justifica com lógica — a emoção vem primeiro, sempre
• Lançamento PLF: CPL1 (oportunidade), CPL2 (mecanismo), CPL3 (prova + convite), VSL de vendas
• Gatilhos que funcionam no Brasil: autoridade pessoal, comunidade/pertencimento, escassez real, transformação de identidade
• Linguagem: direta mas calorosa, sem distância nem jargão excessivo, coloquial mas profissional
• O espectador brasileiro tem alto BS-detector — especificidade e prova importam mais que promessa

═══════════════════════════════════════════
INSTRUÇÕES DE PRODUÇÃO
═══════════════════════════════════════════
Formato: ${FORMAT_GUIDE[format] ?? "Vídeo persuasivo de conversão"}
Estilo de voz: ${config.voiceStyle ?? "narrator"}
${config.hasUserFace ? "APRESENTADOR VISÍVEL — escreva em primeira pessoa, falas íntimas e diretas, o apresentador olha nos olhos da câmera. Inclua EMOÇÃO NAS FALAS (pausas, ênfases, momentos de silêncio)." : "SEM APRESENTADOR — locução em off, narração em terceira pessoa ou segunda pessoa direta ('Você já sentiu...'). Texto precisa criar imagem mental."}
Tom desejado: ${config.tone ?? "inspirational"} | Ritmo: ${config.rhythm ?? "medium"}

ESTRUTURA DE ENTREGA:
[HOOK] — interrupção de padrão, primeiros 5 segundos decidem tudo
[IDENTIFICAÇÃO] — dor específica, o espectador pensa "como ele sabe exatamente o que sinto?"
[AGITAÇÃO] — a dor piora, as consequências se expandem, as tentativas anteriores fracassam
[VIRADA] — algo muda, a esperança aparece, o mecanismo único é introduzido
[REVELAÇÃO] — como funciona, por que é diferente, prova tangível
[TRANSFORMAÇÃO] — vida depois, identidade nova, resultados específicos
[CONTRASTE FINAL] — o custo de não agir vs o custo de agir
[CTA] — chamada clara, urgente, com escassez real ou temporal
[DURAÇÃO ESTIMADA: X:XX]

Escreva roteiro completo como texto corrido. Cada seção claramente marcada. Linguagem que ressoa emocionalmente, não apenas informa.`;


    const userContent = [
      campaignBrief ? campaignBrief : null,
      `PRODUTO: ${productName}`,
      productDescription ? `DESCRIÇÃO: ${productDescription}` : null,
      `PÚBLICO-ALVO: ${targetAudience}`,
      `FORMATO: ${format.replace(/_/g, " ").toUpperCase()}`,
      "",
      campaignBrief
        ? "O roteiro DEVE ser a expressão cinematográfica e persuasiva do briefing acima. Não é um roteiro genérico — é a voz desta campanha específica. Crie o roteiro completo agora."
        : "Crie o roteiro completo. Use todo o seu conhecimento de storytelling, arco emocional e persuasão para criar um roteiro que converte.",
    ].filter(Boolean).join("\n");

    const result = await completeWithAgent(
      "vsl_script",
      SCRIPT_SYSTEM,
      [{ role: "user", content: userContent }],
      workspaceId,
      reqLog,
      project.campaignId ?? undefined,
    );

    const [updated] = await db
      .update(videoProjectsTable)
      .set({
        status: "script_ready",
        script: result.content,
        creditsUsed: (project.creditsUsed ?? 0) + 18,
        updatedAt: new Date(),
      })
      .where(eq(videoProjectsTable.id, projectId))
      .returning();

    return updated!;
  } catch (err) {
    await db
      .update(videoProjectsTable)
      .set({ status: "intake", errorMessage: String(err), updatedAt: new Date() })
      .where(eq(videoProjectsTable.id, projectId));
    throw err;
  }
}

// ─── Approve Script ──────────────────────────────────────────────────────────

export async function approveScript(
  workspaceId: string,
  projectId: string,
  editedScript?: string,
): Promise<VideoProject> {
  const project = await getProject(workspaceId, projectId);
  if (project.status !== "script_ready") {
    throw new AppError(409, "Só é possível aprovar roteiro com status script_ready", "INVALID_STATUS");
  }

  const [updated] = await db
    .update(videoProjectsTable)
    .set({
      status: "script_approved",
      script: editedScript ?? project.script,
      updatedAt: new Date(),
    })
    .where(eq(videoProjectsTable.id, projectId))
    .returning();

  return updated!;
}

// ─── Generate Storyboard ─────────────────────────────────────────────────────

export async function generateStoryboard(
  workspaceId: string,
  projectId: string,
  reqLog: Logger,
): Promise<VideoProject> {
  const project = await getProject(workspaceId, projectId);
  if (!["script_approved", "storyboard_ready"].includes(project.status)) {
    throw new AppError(409, "Storyboard requer roteiro aprovado", "INVALID_STATUS");
  }
  if (!project.script) throw new AppError(400, "Projeto sem roteiro — gere e aprove o roteiro primeiro", "NO_SCRIPT");

  await db
    .update(videoProjectsTable)
    .set({ status: "storyboard_generating", updatedAt: new Date() })
    .where(eq(videoProjectsTable.id, projectId));

  try {
    let productName = project.title;
    let productDescription = "";
    let targetAudience = "Empreendedores digitais brasileiros";
    let emotionalHook = "";
    let uniqueMechanism = "";
    let transformationBridge = "";
    let positioning = "";
    let avatarFears: string[] = [];
    let avatarAspirations: string[] = [];
    let mentalTriggers: string[] = [];
    let campaignTrack = "six_digits";

    if (project.campaignId) {
      const [campaign] = await db
        .select({
          intakeData: campaignsTable.intakeData,
          strategyData: campaignsTable.strategyData,
          audienceData: campaignsTable.audienceData,
          track: campaignsTable.track,
        })
        .from(campaignsTable)
        .where(eq(campaignsTable.id, project.campaignId))
        .limit(1);

      if (campaign) {
        const intake = (campaign.intakeData as Record<string, unknown>) ?? {};
        const strategy = (campaign.strategyData as Record<string, unknown>) ?? {};
        const audience = (campaign.audienceData as Record<string, unknown>) ?? {};
        const avatar = (audience["primaryAvatar"] ?? audience["avatar"]) as Record<string, unknown> | undefined;

        productName = String(intake["product.name"] ?? intake["productName"] ?? project.title);
        productDescription = String(intake["product.description"] ?? "");
        targetAudience = String(intake["audience.description"] ?? targetAudience);

        emotionalHook = String(strategy["emotionalHook"] ?? "");
        positioning = String(strategy["positioning"] ?? "");
        const mech = strategy["uniqueMechanism"];
        uniqueMechanism = typeof mech === "object" ? String((mech as any)?.name ?? "") : String(mech ?? "");
        transformationBridge = String(strategy["transformationBridge"] ?? "");
        campaignTrack = campaign.track;

        const trig = (strategy["mentalTriggers"] ?? strategy["triggers"] ?? audience["triggers"]) as string[] | undefined;
        if (trig?.length) mentalTriggers = trig;

        if (avatar) {
          avatarFears = ((avatar["fears"] as string[]) ?? []).slice(0, 3);
          avatarAspirations = ((avatar["aspirations"] as string[]) ?? []).slice(0, 3);
        }
      }
    }

    const config = project.config as VideoConfig;
    const { scenes, totalDurationSeconds, phaseSummary, directorNotes } = await runSceneDirectorAgent(
      {
        productName,
        productDescription,
        targetAudience,
        format: project.format,
        script: project.script,
        config,
        campaignId: project.campaignId,
        workspaceId,
        // ── Campaign arc context injected into ATLAS ──
        campaignArc: {
          emotionalHook,
          uniqueMechanism,
          transformationBridge,
          positioning,
          mentalTriggers,
          avatarFears,
          avatarAspirations,
          track: campaignTrack,
        },
      },
      reqLog,
    );

    const [updated] = await db
      .update(videoProjectsTable)
      .set({
        status: "storyboard_ready",
        storyboard: scenes,
        creditsUsed: (project.creditsUsed ?? 0) + 12,
        config: {
          ...config,
          totalCreditsUsed: (config.totalCreditsUsed ?? 0) + 12,
          storyboardMeta: { totalDurationSeconds, phaseSummary, directorNotes },
        } as VideoConfig,
        updatedAt: new Date(),
      })
      .where(eq(videoProjectsTable.id, projectId))
      .returning();

    return updated!;
  } catch (err) {
    await db
      .update(videoProjectsTable)
      .set({ status: "script_approved", errorMessage: String(err), updatedAt: new Date() })
      .where(eq(videoProjectsTable.id, projectId));
    throw err;
  }
}

// ─── Approve Storyboard ──────────────────────────────────────────────────────

export async function approveStoryboard(
  workspaceId: string,
  projectId: string,
  adjustedScenes?: VideoScene[],
): Promise<VideoProject> {
  const project = await getProject(workspaceId, projectId);
  if (project.status !== "storyboard_ready") {
    throw new AppError(409, "Só é possível aprovar storyboard com status storyboard_ready", "INVALID_STATUS");
  }

  const [updated] = await db
    .update(videoProjectsTable)
    .set({
      status: "storyboard_approved",
      storyboard: adjustedScenes ?? project.storyboard,
      updatedAt: new Date(),
    })
    .where(eq(videoProjectsTable.id, projectId))
    .returning();

  return updated!;
}

// ─── Generate Preview Clips (low-res) ───────────────────────────────────────

export async function generatePreviewClips(
  workspaceId: string,
  projectId: string,
  reqLog: Logger,
): Promise<VideoProject> {
  const project = await getProject(workspaceId, projectId);
  if (!["storyboard_approved", "preview_ready"].includes(project.status)) {
    throw new AppError(409, "Preview requer storyboard aprovado", "INVALID_STATUS");
  }

  const scenes = (project.storyboard as VideoScene[]) ?? [];
  if (!scenes.length) throw new AppError(400, "Storyboard vazio — gere e aprove o storyboard primeiro", "NO_STORYBOARD");

  const provider = getAvailableVideoProvider();
  const avatarProvider = getAvailableAvatarProvider();
  const config = project.config as VideoConfig;

  await db
    .update(videoProjectsTable)
    .set({ status: "preview_generating", updatedAt: new Date() })
    .where(eq(videoProjectsTable.id, projectId));

  const creditCostPerScene = config.hasUserFace ? 80 : 50;
  const totalCost = scenes.length * creditCostPerScene;
  await deductCredits(workspaceId, config.hasUserFace ? "video_avatar" : "video_low_res", reqLog, project.campaignId ?? undefined);

  const updatedScenes: VideoScene[] = await Promise.all(
    scenes.map(async (scene) => {
      try {
        let result;
        if (scene.hasAvatar && avatarProvider === "heygen") {
          result = await generateAvatarVideo({
            voiceoverText: scene.voiceoverText,
            avatarId: config.avatarId,
            voiceId: config.voiceId,
            aspectRatio: config.aspectRatio === "1:1" ? "16:9" : (config.aspectRatio as "16:9" | "9:16"),
          });
        } else if (provider) {
          result = await generateVideoClip({
            prompt: scene.videoPrompt,
            durationSeconds: scene.durationSeconds,
            aspectRatio: config.aspectRatio ?? "16:9",
            resolution: "720p",
            negativePrompt: "text, subtitles, watermark, blurry, pixelated, distorted faces, bad quality",
          });
        } else {
          return {
            ...scene,
            clipStatus: "failed" as const,
            notes: "Nenhum provedor de vídeo configurado. Configure RUNWAY_API_KEY ou FAL_API_KEY.",
          };
        }

        if (result.status === "provider_not_configured") {
          return {
            ...scene,
            clipStatus: "failed" as const,
            notes: result.setupInstructions ?? "Provedor não configurado",
          };
        }

        return {
          ...scene,
          clipStatus: result.status === "ready" ? "ready" as const : "generating" as const,
          clipUrl: result.clipUrl,
          notes: result.jobId ? `job:${result.provider}:${result.jobId}` : undefined,
        };
      } catch (err) {
        reqLog.error({ sceneId: scene.id, err }, "Scene clip generation failed");
        return { ...scene, clipStatus: "failed" as const, notes: String(err) };
      }
    }),
  );

  const allFailed = updatedScenes.every((s) => s.clipStatus === "failed");
  const newStatus = allFailed ? ("storyboard_approved" as const) : ("preview_ready" as const);

  const [updated] = await db
    .update(videoProjectsTable)
    .set({
      status: newStatus,
      storyboard: updatedScenes,
      creditsUsed: (project.creditsUsed ?? 0) + totalCost,
      errorMessage: allFailed ? "Todos os clipes falharam — verifique as configurações do provedor de vídeo" : null,
      updatedAt: new Date(),
    })
    .where(eq(videoProjectsTable.id, projectId))
    .returning();

  return updated!;
}

// ─── Approve Preview ─────────────────────────────────────────────────────────

export async function approvePreview(
  workspaceId: string,
  projectId: string,
  sceneAdjustments?: Partial<VideoScene>[],
): Promise<VideoProject> {
  const project = await getProject(workspaceId, projectId);
  if (project.status !== "preview_ready") {
    throw new AppError(409, "Só é possível aprovar preview com status preview_ready", "INVALID_STATUS");
  }

  let scenes = project.storyboard as VideoScene[];
  if (sceneAdjustments?.length) {
    scenes = scenes.map((s) => {
      const adj = sceneAdjustments.find((a) => a.id === s.id);
      return adj ? { ...s, ...adj, clipStatus: "pending" as const } : s;
    });
  }

  const [updated] = await db
    .update(videoProjectsTable)
    .set({
      status: "preview_approved",
      storyboard: scenes,
      updatedAt: new Date(),
    })
    .where(eq(videoProjectsTable.id, projectId))
    .returning();

  return updated!;
}

// ─── Generate Final Clips (HD) ───────────────────────────────────────────────

export async function generateFinalClips(
  workspaceId: string,
  projectId: string,
  reqLog: Logger,
): Promise<VideoProject> {
  const project = await getProject(workspaceId, projectId);
  if (project.status !== "preview_approved") {
    throw new AppError(409, "Geração final requer preview aprovado", "INVALID_STATUS");
  }

  const scenes = (project.storyboard as VideoScene[]) ?? [];
  const config = project.config as VideoConfig;

  await db
    .update(videoProjectsTable)
    .set({ status: "final_generating", updatedAt: new Date() })
    .where(eq(videoProjectsTable.id, projectId));

  const creditCostPerScene = config.hasUserFace ? 80 : 150;
  const totalCost = scenes.length * creditCostPerScene;
  await deductCredits(workspaceId, config.hasUserFace ? "video_avatar" : "video_high_res", reqLog, project.campaignId ?? undefined);

  const updatedScenes: VideoScene[] = await Promise.all(
    scenes.map(async (scene) => {
      try {
        let result;
        if (scene.hasAvatar && Boolean(env.HEYGEN_API_KEY)) {
          result = await generateAvatarVideo({
            voiceoverText: scene.voiceoverText,
            avatarId: config.avatarId,
            voiceId: config.voiceId,
          });
        } else {
          result = await generateVideoClip({
            prompt: scene.videoPrompt,
            durationSeconds: scene.durationSeconds,
            aspectRatio: config.aspectRatio ?? "16:9",
            resolution: "1080p",
            negativePrompt: "text, subtitles, watermark, blurry, low quality, grain",
          });
        }
        return {
          ...scene,
          clipStatus: result.status === "ready" ? "ready" as const : "generating" as const,
          clipUrlHd: result.clipUrl,
          notes: result.jobId ? `job:${result.provider}:${result.jobId}` : undefined,
        };
      } catch (err) {
        return { ...scene, clipStatus: "failed" as const, notes: String(err) };
      }
    }),
  );

  const allReady = updatedScenes.every((s) => s.clipStatus === "ready" || s.clipStatus === "generating");

  const [updated] = await db
    .update(videoProjectsTable)
    .set({
      status: allReady ? "completed" : "final_generating",
      storyboard: updatedScenes,
      creditsUsed: (project.creditsUsed ?? 0) + totalCost,
      completedAt: allReady ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(videoProjectsTable.id, projectId))
    .returning();

  return updated!;
}

// ─── Poll clip jobs ──────────────────────────────────────────────────────────

export async function pollClipJobs(workspaceId: string, projectId: string): Promise<VideoProject> {
  const project = await getProject(workspaceId, projectId);
  const scenes = (project.storyboard as VideoScene[]) ?? [];

  const updatedScenes = await Promise.all(
    scenes.map(async (scene) => {
      if (scene.clipStatus !== "generating" || !scene.notes?.startsWith("job:")) return scene;
      const [, provider, jobId] = scene.notes.split(":");
      if (!provider || !jobId) return scene;

      const result = await pollVideoJob(jobId, provider);
      if (result.status === "ready") {
        const isHd = scene.clipUrlHd !== undefined;
        return {
          ...scene,
          clipStatus: "ready" as const,
          [isHd ? "clipUrlHd" : "clipUrl"]: result.clipUrl,
          notes: undefined,
        };
      }
      if (result.status === "failed") {
        return { ...scene, clipStatus: "failed" as const, notes: result.error };
      }
      return scene;
    }),
  );

  const allReady = updatedScenes.every((s) => s.clipStatus === "ready");
  const newStatus =
    project.status === "final_generating" && allReady
      ? ("completed" as const)
      : project.status === "preview_generating" && allReady
        ? ("preview_ready" as const)
        : project.status;

  const [updated] = await db
    .update(videoProjectsTable)
    .set({
      storyboard: updatedScenes,
      status: newStatus,
      completedAt: newStatus === "completed" ? new Date() : project.completedAt,
      updatedAt: new Date(),
    })
    .where(eq(videoProjectsTable.id, projectId))
    .returning();

  return updated!;
}

// ─── Get single project ──────────────────────────────────────────────────────

export async function getVideoProject(workspaceId: string, projectId: string): Promise<VideoProject> {
  return getProject(workspaceId, projectId);
}

// ─── Provider status ─────────────────────────────────────────────────────────

export function getVideoProviderStatus() {
  return {
    videoProvider: getAvailableVideoProvider(),
    avatarProvider: getAvailableAvatarProvider(),
    voiceProvider: process.env["ELEVENLABS_API_KEY"] ? "elevenlabs" : null,
    configured: Boolean(getAvailableVideoProvider()),
    instructions: {
      video: "Configure RUNWAY_API_KEY (Runway ML) ou FAL_API_KEY (Kling via fal.ai)",
      avatar: "Configure HEYGEN_API_KEY para vídeos com apresentador/avatar",
      voice: "Configure ELEVENLABS_API_KEY para clonagem de voz",
    },
  };
}

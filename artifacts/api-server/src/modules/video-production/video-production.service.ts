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

    if (project.campaignId) {
      const [campaign] = await db
        .select({ intakeData: campaignsTable.intakeData })
        .from(campaignsTable)
        .where(eq(campaignsTable.id, project.campaignId))
        .limit(1);
      if (campaign?.intakeData) {
        const intake = campaign.intakeData as Record<string, unknown>;
        productName = String(intake["product.name"] ?? intake["productName"] ?? project.title);
        productDescription = String(intake["product.description"] ?? intake["product.category"] ?? "");
        targetAudience = String(
          intake["audience.description"] ?? intake["audience.primary"] ?? targetAudience,
        );
      }
    }

    const config = project.config as VideoConfig;
    const format = project.format;

    const SCRIPT_SYSTEM = `Você é o Roteirista de Vídeo da NexOS AI — especialista em roteiros de alta conversão para o mercado digital brasileiro.
Crie um roteiro completo para ${format.replace(/_/g, " ").toUpperCase()}.

O roteiro deve:
- Ter hook poderoso nos primeiros 5 segundos
- Apresentar problema/dor com empatia
- Revelar solução de forma elegante
- Incluir prova social/resultado
- Ter CTA claro e urgente

Estilos de voz disponíveis: narrator (locução off), avatar (apresentador aparece), voice_clone (voz clonada do usuário).
Estilo selecionado: ${config.voiceStyle ?? "narrator"}
${config.hasUserFace ? "O apresentador APARECERÁ no vídeo — escreva falas diretas na primeira pessoa." : "Vídeo sem apresentador — use narração em terceira pessoa ou locução persuasiva."}
Tom desejado: ${config.tone ?? "inspirational"} | Ritmo: ${config.rhythm ?? "medium"}

Retorne o roteiro completo como texto corrido (não JSON). Inclua:
[HOOK] — abertura impactante
[PROBLEMA] — dor do público
[SOLUÇÃO] — o produto como resposta
[PROVA] — resultados/depoimentos
[CTA] — chamada para ação
Estime o tempo total (em minutos:segundos) no final: [DURAÇÃO ESTIMADA: X:XX]`;

    const result = await completeWithAgent(
      "vsl_script",
      SCRIPT_SYSTEM,
      [
        {
          role: "user",
          content: `Produto: ${productName}\n${productDescription ? `Descrição: ${productDescription}\n` : ""}Público-alvo: ${targetAudience}\nFormato: ${format}\n\nCrie o roteiro completo.`,
        },
      ],
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

    if (project.campaignId) {
      const [campaign] = await db
        .select({ intakeData: campaignsTable.intakeData })
        .from(campaignsTable)
        .where(eq(campaignsTable.id, project.campaignId))
        .limit(1);
      if (campaign?.intakeData) {
        const intake = campaign.intakeData as Record<string, unknown>;
        productName = String(intake["product.name"] ?? intake["productName"] ?? project.title);
        productDescription = String(intake["product.description"] ?? "");
        targetAudience = String(intake["audience.description"] ?? targetAudience);
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

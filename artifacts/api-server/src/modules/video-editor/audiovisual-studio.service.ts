import { and, desc, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { ZipArchive } from "archiver";
import ffmpeg from "fluent-ffmpeg";
import fs from "node:fs";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import dns from "node:dns/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { z } from "zod/v4";
import {
  correctionLoopsTable,
  campaignsTable,
  db,
  productionAssetsTable,
  productionManifestsTable,
  productionRevisionsTable,
  qcIssuesTable,
  qcReportsTable,
  renderJobsTable,
  timelineItemsTable,
  timelineTracksTable,
  videoProjectsTable,
  videoMediaPurgesTable,
  nativeMediaJobsTable,
  auditLogsTable,
  type VideoProject,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import type { Logger } from "pino";
import {
  runArtDirectionAgent, runColorContinuityAgent, runEditorAgent,
  runPerformanceVoiceAgent, runSoundDesignAgent, runWardrobeAppearanceAgent,
  runAvQcAgent, runDirectorSynthesisContract, runRoleCritiqueContract,
  runRoleProposalContract, type AudiovisualCouncilRole, type DirectorSynthesis,
  type RoleCritique, type RoleProposal,
} from "../agents/audiovisual-ensemble.agent.js";
import {
  approveScript,
  approveStoryboard,
  generateScript,
  generateStoryboard,
} from "../video-production/video-production.service.js";
import {
  approvePreview, generateFinalClips, generatePreviewClips, pollClipJobs,
} from "../video-production/video-production.service.js";
import { createGCSObjectStream, deleteGCSObject, getGCSObjectMeta, listGCSObjects, uploadFileToGCS } from "../../lib/gcs-recordings.js";
import { compileTimelineFilter, persistedTimelineSchema, resolveRenderDimensions, type RenderAsset, type RenderItem, type RenderTrack } from "./timeline-render.compiler.js";

const PHASES = ["script", "storyboard", "assets", "timeline", "edit", "sound", "color", "qc", "corrections", "export"] as const;
type Phase = typeof PHASES[number];
type PhaseStatus = "not_started" | "in_progress" | "ready" | "blocked";
type JsonRecord = Record<string, unknown>;
// Provider submission is not idempotent at every vendor.  Serialize advance
// calls per tenant/project in this process so two rapid editor clicks cannot
// submit the same resumable transition twice.
const advancingProjects = new Set<string>();

function lifecycle(project: VideoProject) {
  const status = project.status;
  const readyScript = ["script_approved", "storyboard_generating", "storyboard_ready", "storyboard_approved", "preview_generating", "preview_ready", "preview_approved", "final_generating", "completed"].includes(status);
  const readyStoryboard = ["storyboard_ready", "storyboard_approved", "preview_generating", "preview_ready", "preview_approved", "final_generating", "completed"].includes(status);
  const phases: Record<Phase, PhaseStatus> = Object.fromEntries(PHASES.map((phase) => [phase, "not_started"])) as Record<Phase, PhaseStatus>;
  phases.script = readyScript ? "ready" : status === "script_generating" ? "in_progress" : status === "failed" ? "blocked" : "not_started";
  phases.storyboard = readyStoryboard ? "ready" : status === "storyboard_generating" ? "in_progress" : readyScript ? "in_progress" : "not_started";
  return phases;
}

function toStudioProject(project: VideoProject, specification?: JsonRecord) {
  const statuses = lifecycle(project);
  const persisted = specification?.phases as Partial<Record<Phase, { status?: PhaseStatus; updatedAt?: string; owner?: string }>> | undefined;
  const phases = PHASES.map((phase) => ({
    phase,
    status: persisted?.[phase]?.status && persisted[phase]?.status !== "not_started"
      ? persisted[phase]!.status!
      : statuses[phase],
    updatedAt: persisted?.[phase]?.updatedAt,
    owner: persisted?.[phase]?.owner,
  }));
  const activePhase = (PHASES.find((phase) => phases.find((item) => item.phase === phase)?.status === "in_progress")
    ?? PHASES.find((phase) => phases.find((item) => item.phase === phase)?.status === "not_started")
    ?? "export") as Phase;
  const projectStatus = project.status === "completed" ? "complete" : project.status === "failed" ? "review" : project.status === "intake" ? "draft" : "active";
  return { id: project.id, name: project.title, status: projectStatus, activePhase, phases, retentionPolicy: project.retentionPolicy, mediaPurgedAt: project.mediaPurgedAt?.toISOString(), createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString() };
}

async function scopedProject(workspaceId: string, projectId: string) {
  const [project] = await db.select().from(videoProjectsTable).where(and(eq(videoProjectsTable.id, projectId), eq(videoProjectsTable.workspaceId, workspaceId))).limit(1);
  if (!project) throw new NotFoundError("Projeto de vídeo");
  return project;
}
function assertMediaAvailable(project: VideoProject): void {
  if (project.mediaPurgedAt) throw new AppError(409, "A mídia foi apagada irreversivelmente; envie novos arquivos para voltar a editar.", "PROJECT_MEDIA_PURGED");
}

async function scopedManifest(workspaceId: string, projectId: string) {
  const [manifest] = await db.select().from(productionManifestsTable)
    .where(and(eq(productionManifestsTable.videoProjectId, projectId), eq(productionManifestsTable.workspaceId, workspaceId))).limit(1);
  if (!manifest) throw new NotFoundError("Manifesto de produção");
  return manifest;
}

async function updatePhases(workspaceId: string, manifestId: string, specification: JsonRecord, changes: Partial<Record<Phase, PhaseStatus>>) {
  const now = new Date().toISOString();
  const existing = (specification.phases ?? {}) as JsonRecord;
  const phases = { ...existing };
  for (const [phase, status] of Object.entries(changes)) {
    phases[phase] = { ...((existing[phase] as JsonRecord | undefined) ?? {}), status, updatedAt: now };
  }
  await db.update(productionManifestsTable).set({ specification: { ...specification, phases }, status: "active", updatedAt: new Date() })
    .where(and(eq(productionManifestsTable.id, manifestId), eq(productionManifestsTable.workspaceId, workspaceId)));
}

/** Advance one production-machine transition, keeping editor records in sync. */
export async function advanceProduction(workspaceId: string, projectId: string, log: Logger) {
  const lockKey = `${workspaceId}:${projectId}`;
  if (advancingProjects.has(lockKey)) throw new AppError(409, "Production is already advancing", "PRODUCTION_BUSY");
  advancingProjects.add(lockKey);
  try {
  const project = await scopedProject(workspaceId, projectId);
  const manifest = await scopedManifest(workspaceId, projectId);
  let updated: VideoProject;
  switch (project.status) {
    case "storyboard_approved":
      updated = await generatePreviewClips(workspaceId, projectId, log);
      await updatePhases(workspaceId, manifest.id, manifest.specification as JsonRecord, { assets: "in_progress" });
      break;
    case "preview_generating":
      updated = await pollClipJobs(workspaceId, projectId);
      break;
    case "preview_ready":
      // approvePreview independently verifies every preview is genuinely ready.
      updated = await approvePreview(workspaceId, projectId);
      break;
    case "preview_approved":
      updated = await generateFinalClips(workspaceId, projectId, log);
      await updatePhases(workspaceId, manifest.id, manifest.specification as JsonRecord, { assets: "in_progress" });
      break;
    case "final_generating":
      updated = await pollClipJobs(workspaceId, projectId);
      break;
    case "completed":
      await materializeProduction(workspaceId, project, manifest.id, manifest.specification as JsonRecord);
      updated = await scopedProject(workspaceId, projectId);
      break;
    default:
      throw new AppError(409, `Production cannot advance from status ${project.status}`, "INVALID_STATUS");
  }
  return { project: updated, detail: await getStudioDetail(workspaceId, projectId) };
  } finally {
    advancingProjects.delete(lockKey);
  }
}

async function materializeProduction(workspaceId: string, project: VideoProject, manifestId: string, specification: JsonRecord) {
  const scenes = project.storyboard as Array<{ id: string; durationSeconds: number; clipStatus?: string; clipUrlHd?: string; clipUrl?: string }>;
  const ready = scenes.filter((scene) => scene.clipStatus === "ready" && (scene.clipUrlHd ?? scene.clipUrl));
  if (ready.length !== scenes.length) throw new AppError(409, "Completed project contains clips that are not ready", "CLIPS_NOT_READY");
  await db.transaction(async (tx) => {
    const assets = await tx.select().from(productionAssetsTable)
      .where(and(eq(productionAssetsTable.workspaceId, workspaceId), eq(productionAssetsTable.videoProjectId, project.id)));
    const assetByScene = new Map(assets.map((asset) => [((asset.specification as JsonRecord).sceneId as string | undefined), asset]));
    const materialized = [];
    for (const [position, scene] of ready.entries()) {
      let asset = assetByScene.get(scene.id);
      if (!asset) {
        [asset] = await tx.insert(productionAssetsTable).values({
          workspaceId, videoProjectId: project.id, manifestId, assetType: "video", status: "ready",
          name: `Storyboard clip ${position + 1}`, uri: scene.clipUrlHd ?? scene.clipUrl!, mimeType: "video/mp4",
          durationMs: Math.round(scene.durationSeconds * 1000), specification: { sceneId: scene.id, generated: true },
        }).returning();
      }
      materialized.push(asset!);
    }
    let [track] = await tx.select().from(timelineTracksTable).where(and(eq(timelineTracksTable.workspaceId, workspaceId), eq(timelineTracksTable.videoProjectId, project.id), eq(timelineTracksTable.manifestId, manifestId), eq(timelineTracksTable.position, 0))).limit(1);
    if (!track) [track] = await tx.insert(timelineTracksTable).values({ workspaceId, videoProjectId: project.id, manifestId, trackType: "video", name: "Generated storyboard", position: 0, settings: {} }).returning();
    const existing = await tx.select().from(timelineItemsTable).where(and(eq(timelineItemsTable.workspaceId, workspaceId), eq(timelineItemsTable.videoProjectId, project.id), eq(timelineItemsTable.trackId, track!.id)));
    let cursor = 0;
    for (const [position, asset] of materialized.entries()) {
      const durationMs = asset.durationMs ?? 0;
      const item = existing.find((candidate) => candidate.assetId === asset.id);
       const values = { workspaceId, videoProjectId: project.id, trackId: track!.id, assetId: asset.id, position, startMs: cursor, durationMs, trimStartMs: 0, trimEndMs: 0, settings: {} };
      if (item) await tx.update(timelineItemsTable).set(values).where(and(eq(timelineItemsTable.id, item.id), eq(timelineItemsTable.workspaceId, workspaceId)));
      else await tx.insert(timelineItemsTable).values(values);
      cursor += durationMs;
    }
  });
  await updatePhases(workspaceId, manifestId, specification, { assets: "ready", timeline: "ready", edit: "in_progress", sound: "in_progress", color: "in_progress", qc: "not_started", corrections: "not_started", export: "not_started" });
}

export async function listStudioProjects(workspaceId: string) {
  const projects = await db.select().from(videoProjectsTable).where(eq(videoProjectsTable.workspaceId, workspaceId)).orderBy(desc(videoProjectsTable.createdAt));
  const manifests = await db.select().from(productionManifestsTable).where(eq(productionManifestsTable.workspaceId, workspaceId));
  const byProject = new Map(manifests.map((manifest) => [manifest.videoProjectId, manifest.specification as JsonRecord]));
  return projects.map((project) => toStudioProject(project, byProject.get(project.id)));
}

export interface CreateStudioProjectInput {
  name: string;
  campaignId?: string;
  format?: VideoProject["format"];
  sourceMode?: "filmed" | "digital_twin" | "synthetic" | "hybrid";
  targetDurationsSeconds?: number[];
  aspectRatio?: "16:9" | "9:16" | "1:1";
  trailerPolicy?: { enabled: boolean; durationsSeconds: Array<15 | 30> };
  retentionPolicy?: "archive" | "ephemeral";
}

export async function createStudioProject(workspaceId: string, input: CreateStudioProjectInput) {
  if (input.campaignId) {
    const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable)
      .where(and(eq(campaignsTable.id, input.campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
    if (!campaign) throw new NotFoundError("Campanha");
  }
  return db.transaction(async (tx) => {
    const [project] = await tx.insert(videoProjectsTable).values({
      workspaceId,
      campaignId: input.campaignId,
      title: input.name,
      format: input.format ?? "reels",
      status: "intake",
      retentionPolicy: input.retentionPolicy ?? "archive",
      config: {
        executionEngine: "native",
        hasUserFace: input.sourceMode === "filmed" || input.sourceMode === "digital_twin" || input.sourceMode === "hybrid",
        voiceStyle: input.sourceMode === "digital_twin" || input.sourceMode === "hybrid" ? "voice_clone" : "narrator",
        aspectRatio: input.aspectRatio ?? "9:16",
        rhythm: "medium",
        tone: "cinematic",
        totalCreditsUsed: 0,
        sourceMode: input.sourceMode ?? "hybrid",
        targetDurationsSeconds: input.targetDurationsSeconds ?? [10, 15, 30, 60],
        trailerPolicy: input.trailerPolicy ?? { enabled: false, durationsSeconds: [] },
      } as VideoProject["config"] & { trailerPolicy?: { enabled: boolean; durationsSeconds: Array<15 | 30> } },
      storyboard: [],
    }).returning();
    const initialPhases = Object.fromEntries(PHASES.map((phase) => [phase, { status: "not_started" }]));
    const [manifest] = await tx.insert(productionManifestsTable).values({
      workspaceId,
      videoProjectId: project!.id,
      name: input.name,
      specification: {
        phases: initialPhases,
        ensemble: {},
        productionPolicy: {
          sourceMode: input.sourceMode ?? "hybrid",
          targetDurationsSeconds: input.targetDurationsSeconds ?? [10, 15, 30, 60],
          trailerPolicy: input.trailerPolicy ?? { enabled: false, durationsSeconds: [] },
          followsCampaignMasterPlan: Boolean(input.campaignId),
        },
      },
    }).returning();
    await tx.insert(productionRevisionsTable).values({
      workspaceId, videoProjectId: project!.id, manifestId: manifest!.id, revisionNumber: 1, note: "Initial studio revision", specification: { manifestVersion: 1 },
    });
    return toStudioProject(project!, manifest!.specification as JsonRecord);
  });
}

export async function getStudioDetail(workspaceId: string, projectId: string) {
  const project = await scopedProject(workspaceId, projectId);
  const manifest = await scopedManifest(workspaceId, projectId);
  const [assets, tracks, items, revisions, renders, reports, issues, corrections] = await Promise.all([
    db.select().from(productionAssetsTable).where(and(eq(productionAssetsTable.videoProjectId, projectId), eq(productionAssetsTable.workspaceId, workspaceId))),
    db.select().from(timelineTracksTable).where(and(eq(timelineTracksTable.videoProjectId, projectId), eq(timelineTracksTable.workspaceId, workspaceId))).orderBy(timelineTracksTable.position),
    db.select().from(timelineItemsTable).where(and(eq(timelineItemsTable.videoProjectId, projectId), eq(timelineItemsTable.workspaceId, workspaceId))).orderBy(timelineItemsTable.position),
    db.select().from(productionRevisionsTable).where(and(eq(productionRevisionsTable.videoProjectId, projectId), eq(productionRevisionsTable.workspaceId, workspaceId))).orderBy(desc(productionRevisionsTable.revisionNumber)),
    db.select().from(renderJobsTable).where(and(eq(renderJobsTable.videoProjectId, projectId), eq(renderJobsTable.workspaceId, workspaceId))).orderBy(desc(renderJobsTable.createdAt)),
    db.select().from(qcReportsTable).where(and(eq(qcReportsTable.videoProjectId, projectId), eq(qcReportsTable.workspaceId, workspaceId))).orderBy(desc(qcReportsTable.createdAt)),
    db.select().from(qcIssuesTable).where(and(eq(qcIssuesTable.videoProjectId, projectId), eq(qcIssuesTable.workspaceId, workspaceId))),
    db.select().from(correctionLoopsTable).where(and(eq(correctionLoopsTable.videoProjectId, projectId), eq(correctionLoopsTable.workspaceId, workspaceId))),
  ]);
  return { project: toStudioProject(project, manifest.specification as JsonRecord), manifest, assets, timeline: { tracks, items }, revisions, renders: renders.map((render) => ({ ...render, isTrailer: (render.specification as JsonRecord).deliverableType === "trailer", durationSeconds: (render.specification as JsonRecord).durationSeconds })), qcReports: reports, qcIssues: issues, corrections };
}

export async function runPlanningEnsemble(workspaceId: string, projectId: string, log: Logger) {
  const project = await scopedProject(workspaceId, projectId);
  if (!project.script || !Array.isArray(project.storyboard) || project.storyboard.length === 0) throw new AppError(409, "Planning ensemble requires script and storyboard prerequisites", "MISSING_PREREQUISITES");
  const manifest = await scopedManifest(workspaceId, projectId);
  const brief = `PROJECT: ${project.title}\nCONFIG:\n${JSON.stringify(project.config)}\n\nSCRIPT:\n${project.script}\n\nSTORYBOARD:\n${JSON.stringify(project.storyboard)}`;
  const baseInput = { campaignId: project.campaignId, workspaceId, log };
  const previousSpec = manifest.specification as JsonRecord;
  const priorCouncil = previousSpec.council as JsonRecord | undefined;
  const version = Number(priorCouncil?.version ?? 0) + 1;
  const roles: Array<[AudiovisualCouncilRole, (input: typeof baseInput & { brief: string }) => Promise<unknown>]> = [
    ["art_direction", runArtDirectionAgent], ["wardrobe_appearance", runWardrobeAppearanceAgent],
    ["performance_voice", runPerformanceVoiceAgent], ["sound_design", runSoundDesignAgent],
    ["editor", runEditorAgent], ["color_continuity", runColorContinuityAgent], ["av_qc", runAvQcAgent],
  ];
  const council: JsonRecord = { version, status: "running", startedAt: new Date().toISOString(), rounds: {
    round1: { status: "running", members: {} }, round2: { status: "pending", members: {} },
  } };
  await db.update(productionManifestsTable).set({ specification: { ...previousSpec, council }, status: "active", updatedAt: new Date() })
    .where(and(eq(productionManifestsTable.id, manifest.id), eq(productionManifestsTable.workspaceId, workspaceId)));
  const memberStatus = (council.rounds as JsonRecord).round1 as JsonRecord;
  const roundOne = await Promise.all(roles.map(async ([role, run]) => {
    try {
      const craft = await run({ ...baseInput, brief });
      const proposal = await runRoleProposalContract({ ...baseInput, role, brief: `${brief}\n\nVALIDATED CRAFT RECOMMENDATION:\n${JSON.stringify(craft)}` });
      (memberStatus.members as JsonRecord)[role] = { status: "completed", payload: proposal, completedAt: new Date().toISOString() };
      return proposal;
    } catch (error) {
      (memberStatus.members as JsonRecord)[role] = { status: "failed", error: error instanceof Error ? error.message : String(error), failedAt: new Date().toISOString() };
      return undefined;
    }
  }));
  const proposals = roundOne.filter((item): item is RoleProposal => Boolean(item));
  memberStatus.status = "completed";
  // A draft is persisted independently; it is never compiled into a project.
  let draft: DirectorSynthesis | undefined;
  try { draft = await runDirectorSynthesisContract({ ...baseInput, brief: `${brief}\n\nROUND 1 PROPOSALS:\n${JSON.stringify(proposals)}`, proposals, trailerPolicy: (project.config as any).trailerPolicy }); }
  catch (error) { (council.rounds as JsonRecord).directorDraft = { status: "failed", error: error instanceof Error ? error.message : String(error) }; }
  if (draft) (council.rounds as JsonRecord).directorDraft = { status: "completed", payload: draft };
  const roundTwo = (council.rounds as JsonRecord).round2 as JsonRecord;
  roundTwo.status = "running";
  const critiquesRaw = await Promise.all(roles.map(async ([role]) => {
    try {
      const critique = await runRoleCritiqueContract({ ...baseInput, role, brief: `${brief}\n\nCOMPLETE ROUND 1 PROPOSALS:\n${JSON.stringify(proposals)}`, proposals });
      (roundTwo.members as JsonRecord)[role] = { status: "completed", payload: critique, completedAt: new Date().toISOString() };
      return critique;
    } catch (error) {
      (roundTwo.members as JsonRecord)[role] = { status: "failed", error: error instanceof Error ? error.message : String(error), failedAt: new Date().toISOString() };
      return undefined;
    }
  }));
  const critiques = critiquesRaw.filter((item): item is RoleCritique => Boolean(item));
  roundTwo.status = "completed";
  let synthesis: DirectorSynthesis;
  try {
    synthesis = await runDirectorSynthesisContract({ ...baseInput, brief: `${brief}\n\nPROPOSALS:\n${JSON.stringify(proposals)}\n\nCRITIQUES:\n${JSON.stringify(critiques)}`, proposals, critiques, trailerPolicy: (project.config as any).trailerPolicy });
  } catch (error) {
    council.status = "failed"; council.error = error instanceof Error ? error.message : String(error);
    await db.update(productionManifestsTable).set({ specification: { ...previousSpec, council }, updatedAt: new Date() }).where(eq(productionManifestsTable.id, manifest.id));
    throw error;
  }
  const config = project.config as any;
  const originals = new Map((project.storyboard as Array<any>).map((scene) => [scene.id, scene]));
  const storyboard = synthesis.executableScenes.map((scene, order) => {
    const original = originals.get(scene.id) ?? {};
    return { ...original, id: scene.id, order, title: original.title ?? `Scene ${order + 1}`, durationSeconds: scene.durationSeconds,
      voiceoverText: scene.voiceoverText, visualDescription: scene.visualDirection, sceneType: original.sceneType ?? "bridge",
      style: original.style ?? "cinematic", palette: original.palette ?? [], transition: original.transition ?? "cut", mood: original.mood ?? "focused",
      hasAvatar: config.sourceMode === "synthetic" ? false : scene.hasAvatar, videoPrompt: scene.prompt, negativePrompt: scene.negativePrompt,
      sourceType: scene.sourceType, clipStatus: "pending" as const, notes: undefined };
  });
  const masterDuration = storyboard.reduce((total, scene) => total + scene.durationSeconds, 0);
  const policy = config.trailerPolicy ?? { enabled: false, durationsSeconds: [] };
  const trailerPlans = policy.enabled && masterDuration > 30 ? synthesis.trailerPlans.filter((plan) => policy.durationsSeconds.includes(plan.durationSeconds)) : [];
  council.status = "completed"; council.completedAt = new Date().toISOString();

  const previousPhases = ((manifest.specification as JsonRecord).phases ?? {}) as JsonRecord;
  const now = new Date().toISOString();
  const specification = {
    ...previousSpec, council,
    executablePlan: { version, synthesis: { ...synthesis, trailerPlans }, compiledAt: new Date().toISOString() },
    deliverables: { ...(previousSpec.deliverables as JsonRecord ?? {}), trailers: trailerPlans.map((plan) => ({ ...plan, executablePlanVersion: version })) },
    phases: {
      ...previousPhases,
      assets: { status: "in_progress", owner: "art_direction", updatedAt: now },
      timeline: { status: "in_progress", owner: "editor", updatedAt: now },
      edit: { status: "in_progress", owner: "editor", updatedAt: now },
      sound: { status: "in_progress", owner: "sound_design", updatedAt: now },
      color: { status: "in_progress", owner: "color_continuity", updatedAt: now },
    },
  };
  await db.transaction(async (tx) => {
    await tx.update(videoProjectsTable).set({ storyboard, updatedAt: new Date() }).where(and(eq(videoProjectsTable.id, projectId), eq(videoProjectsTable.workspaceId, workspaceId)));
    const [latest] = await tx.select({ revisionNumber: productionRevisionsTable.revisionNumber }).from(productionRevisionsTable).where(and(eq(productionRevisionsTable.workspaceId, workspaceId), eq(productionRevisionsTable.videoProjectId, projectId))).orderBy(desc(productionRevisionsTable.revisionNumber)).limit(1);
    await tx.insert(productionRevisionsTable).values({ workspaceId, videoProjectId: projectId, manifestId: manifest.id, revisionNumber: (latest?.revisionNumber ?? 0) + 1, note: "Council executable plan compiled", specification: { councilVersion: version, executablePlanVersion: version } });
  });
  const [updated] = await db.update(productionManifestsTable).set({ specification, status: "active", updatedAt: new Date() })
    .where(and(eq(productionManifestsTable.id, manifest.id), eq(productionManifestsTable.workspaceId, workspaceId))).returning();
  return updated!;
}

export async function runAutonomousPreproduction(
  workspaceId: string,
  projectId: string,
  log: Logger,
) {
  let project = await scopedProject(workspaceId, projectId);

  if (project.status === "intake" || project.status === "script_ready") {
    project = await generateScript(workspaceId, projectId, log);
  }
  if (project.status === "script_ready") {
    project = await approveScript(workspaceId, projectId);
  }
  if (project.status === "script_approved" || project.status === "storyboard_ready") {
    project = await generateStoryboard(workspaceId, projectId, log);
  }
  if (project.status === "storyboard_ready") {
    project = await approveStoryboard(workspaceId, projectId);
  }
  if (!["storyboard_approved", "preview_generating", "preview_ready", "preview_approved", "final_generating", "completed"].includes(project.status)) {
    throw new AppError(409, `Pre-production cannot continue from status ${project.status}`, "INVALID_STATUS");
  }

  await runPlanningEnsemble(workspaceId, projectId, log);
  return getStudioDetail(workspaceId, projectId);
}

export async function upsertTimeline(workspaceId: string, projectId: string, input: { expectedRevisionNumber?: number; project?: { resolution?: "1920x1080" | "1080x1920" | "3840x2160" | "2160x3840"; fps?: 24 | 25 | 30 | 50 | 60 }; tracks: Array<{ id?: string; trackType: "video" | "audio" | "voiceover" | "music" | "graphics" | "subtitles"; name: string; position: number; settings?: JsonRecord }>; items: Array<{ id?: string; trackId: string; assetId?: string; position: number; startMs: number; durationMs: number; trimStartMs?: number; trimEndMs?: number; settings?: JsonRecord }> }) {
  // This service is also called by jobs/tests, bypassing Express. Keep the
  // allow-list at the trust boundary rather than relying on route validation.
  const checked = persistedTimelineSchema.safeParse(input);
  if (!checked.success) throw new AppError(400, checked.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "), "UNSUPPORTED_TIMELINE_PROPERTY");
  input = checked.data as typeof input;
  assertMediaAvailable(await scopedProject(workspaceId, projectId));
  const manifest = await scopedManifest(workspaceId, projectId);
  await db.transaction(async (tx) => {
    const [latest] = await tx.select({ revisionNumber: productionRevisionsTable.revisionNumber }).from(productionRevisionsTable)
      .where(and(eq(productionRevisionsTable.workspaceId, workspaceId), eq(productionRevisionsTable.videoProjectId, projectId))).orderBy(desc(productionRevisionsTable.revisionNumber)).limit(1);
    if (input.expectedRevisionNumber !== undefined && input.expectedRevisionNumber !== (latest?.revisionNumber ?? 0)) {
      throw new AppError(409, "Timeline revision has changed; reload before saving", "TIMELINE_REVISION_CONFLICT");
    }
    const existingTracks = await tx.select({ id: timelineTracksTable.id }).from(timelineTracksTable)
      .where(and(eq(timelineTracksTable.workspaceId, workspaceId), eq(timelineTracksTable.videoProjectId, projectId)));
    const submittedTrackIds = input.tracks.flatMap((track) => track.id ? [track.id] : []);
    // Remove items first so both removed tracks and removed items are authoritative.
    await tx.delete(timelineItemsTable).where(and(eq(timelineItemsTable.workspaceId, workspaceId), eq(timelineItemsTable.videoProjectId, projectId)));
    const removedTrackIds = existingTracks.map((track) => track.id).filter((id) => !submittedTrackIds.includes(id));
    if (removedTrackIds.length) await tx.delete(timelineTracksTable).where(and(eq(timelineTracksTable.workspaceId, workspaceId), eq(timelineTracksTable.videoProjectId, projectId), inArray(timelineTracksTable.id, removedTrackIds)));
    // Avoid transient unique(manifest_id, position) conflicts when tracks are reordered.
    const retainedTrackIds = existingTracks.map((track) => track.id).filter((id) => submittedTrackIds.includes(id));
    for (const [index, id] of retainedTrackIds.entries()) {
      await tx.update(timelineTracksTable).set({ position: -1 - index }).where(and(eq(timelineTracksTable.id, id), eq(timelineTracksTable.workspaceId, workspaceId)));
    }
    for (const track of input.tracks) {
      const values = { workspaceId, videoProjectId: projectId, manifestId: manifest.id, trackType: track.trackType, name: track.name, position: track.position, settings: track.settings ?? {} };
      if (track.id) {
        const [updated] = await tx.update(timelineTracksTable).set(values).where(and(eq(timelineTracksTable.id, track.id), eq(timelineTracksTable.workspaceId, workspaceId), eq(timelineTracksTable.videoProjectId, projectId))).returning({ id: timelineTracksTable.id });
        if (!updated) throw new NotFoundError("Faixa da timeline");
      }
      else await tx.insert(timelineTracksTable).values(values);
    }
    for (const item of input.items) {
      const [track] = await tx.select({ id: timelineTracksTable.id }).from(timelineTracksTable)
        .where(and(eq(timelineTracksTable.id, item.trackId), eq(timelineTracksTable.workspaceId, workspaceId), eq(timelineTracksTable.videoProjectId, projectId))).limit(1);
      if (!track) throw new NotFoundError("Faixa da timeline");
      if (item.assetId) {
        const [asset] = await tx.select({ id: productionAssetsTable.id }).from(productionAssetsTable)
          .where(and(eq(productionAssetsTable.id, item.assetId), eq(productionAssetsTable.workspaceId, workspaceId), eq(productionAssetsTable.videoProjectId, projectId))).limit(1);
        if (!asset) throw new NotFoundError("Asset de produção");
      }
      const values = { workspaceId, videoProjectId: projectId, trackId: item.trackId, assetId: item.assetId, position: item.position, startMs: item.startMs, durationMs: item.durationMs, trimStartMs: item.trimStartMs ?? 0, trimEndMs: item.trimEndMs ?? 0, settings: item.settings ?? {} };
      // Reinsert the authoritative item set, retaining supplied IDs so editor
      // clients can continue to address unchanged items.
      await tx.insert(timelineItemsTable).values(item.id ? { ...values, id: item.id } : values);
    }
    await tx.insert(productionRevisionsTable).values({
      workspaceId, videoProjectId: projectId, manifestId: manifest.id, revisionNumber: (latest?.revisionNumber ?? 0) + 1,
      note: "Timeline updated", specification: { timelineWrite: true },
    });
    if (checked.data.project) {
      await tx.update(productionManifestsTable).set({
        specification: { ...(manifest.specification as JsonRecord), timelineRender: checked.data.project },
        updatedAt: new Date(),
      }).where(and(eq(productionManifestsTable.id, manifest.id), eq(productionManifestsTable.workspaceId, workspaceId)));
    }
  });
  await invalidateRenderedOutput(workspaceId, projectId, manifest);
  return getStudioDetail(workspaceId, projectId);
}

export async function getStudioAsset(workspaceId: string, projectId: string, assetId: string) {
  await scopedProject(workspaceId, projectId);
  const [asset] = await db.select().from(productionAssetsTable).where(and(
    eq(productionAssetsTable.id, assetId), eq(productionAssetsTable.workspaceId, workspaceId), eq(productionAssetsTable.videoProjectId, projectId),
  )).limit(1);
  if (!asset) throw new NotFoundError("Asset de produção");
  return asset;
}

export async function registerAsset(workspaceId: string, projectId: string, input: { assetType: "video" | "audio" | "image" | "subtitle" | "graphic" | "font" | "document"; name: string; uri: string; mimeType?: string; byteSize?: number; durationMs?: number; specification?: JsonRecord }) {
  assertMediaAvailable(await scopedProject(workspaceId, projectId));
  const manifest = await scopedManifest(workspaceId, projectId);
  const [asset] = await db.insert(productionAssetsTable).values({ workspaceId, videoProjectId: projectId, manifestId: manifest.id, status: "ready", ...input, specification: input.specification ?? {} }).returning();
  return asset!;
}

function privateHost(host: string): boolean {
  const value = host.toLowerCase();
  if (value === "localhost" || value.endsWith(".localhost") || value === "0.0.0.0" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) return true;
  const parts = value.split(".").map(Number);
  return parts.length === 4 && (parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168);
}

async function safeHttpsUrl(value: string): Promise<URL> {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError(400, "Clip URL is invalid", "INVALID_CLIP_URL"); }
  if (url.protocol !== "https:" || url.username || url.password || privateHost(url.hostname)) throw new AppError(400, "Clip URL must be a public HTTPS URL", "UNSAFE_CLIP_URL");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((address) => privateHost(address.address))) throw new AppError(400, "Clip URL resolves to a private network", "UNSAFE_CLIP_URL");
  return url;
}

async function downloadClip(urlValue: string, target: string) {
  const url = await safeHttpsUrl(urlValue);
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (response.status >= 300 && response.status < 400) throw new AppError(400, "Clip URL redirects are not permitted", "UNSAFE_CLIP_URL");
  if (!response.ok || !response.body) throw new AppError(400, `Unable to download clip (${response.status})`, "CLIP_DOWNLOAD_FAILED");
  const bytes = Number(response.headers.get("content-length") ?? 0);
  if (bytes > 2 * 1024 * 1024 * 1024) throw new AppError(400, "Clip exceeds 2GB render limit", "CLIP_TOO_LARGE");
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(target));
}

async function downloadAsset(uri: string, target: string) {
  if (uri.startsWith("audiovisual-studio/")) {
    await pipeline(createGCSObjectStream(uri), fs.createWriteStream(target));
    return;
  }
  await downloadClip(uri, target);
}

function probe(pathname: string): Promise<{ hasAudio: boolean; durationMs: number; width?: number; height?: number; fps?: number; audioStreams: number }> {
  return new Promise((resolve, reject) => ffmpeg.ffprobe(pathname, (error, metadata) => error ? reject(error) : resolve({
    hasAudio: metadata.streams.some((stream) => stream.codec_type === "audio"),
    durationMs: Math.round((metadata.format.duration ?? 0) * 1000),
    width: metadata.streams.find((stream) => stream.codec_type === "video")?.width,
    height: metadata.streams.find((stream) => stream.codec_type === "video")?.height,
    fps: (() => { const rate = metadata.streams.find((stream) => stream.codec_type === "video")?.r_frame_rate; const [a, b] = (rate ?? "0/1").split("/").map(Number); return b ? a / b : 0; })(),
    audioStreams: metadata.streams.filter((stream) => stream.codec_type === "audio").length,
  })));
}
function runFfmpeg(command: ffmpeg.FfmpegCommand, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let argv = "";
    command.on("start", (line: string) => { argv = line; })
      .on("error", (error: Error, _stdout: string, stderr: string) => {
        const detail = [argv && `ffmpeg: ${argv}`, stderr?.trim()].filter(Boolean).join("\n");
        reject(new Error(`${error.message}${detail ? `\n${detail}` : ""}`));
      })
      .on("end", () => resolve())
      .save(output);
  });
}
async function sha256File(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filename);
    stream.on("error", reject).on("data", (chunk) => hash.update(chunk)).on("end", () => resolve(hash.digest("hex")));
  });
}

async function sha256Object(objectKey: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createGCSObjectStream(objectKey)) hash.update(chunk);
  return hash.digest("hex");
}
function renderDimensions(aspectRatio: string | undefined) {
  if (aspectRatio === "9:16") return { width: 1080, height: 1920 };
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 };
}

export async function createStudioRender(workspaceId: string, projectId: string, log: Logger) {
  const project = await scopedProject(workspaceId, projectId);
  assertMediaAvailable(project);
  const manifest = await scopedManifest(workspaceId, projectId);
  const storyboard = project.storyboard as Array<{ clipStatus?: string; clipUrlHd?: string; clipUrl?: string }>;
  if (storyboard.length && storyboard.some((scene) => scene.clipStatus !== "ready" || !(scene.clipUrlHd ?? scene.clipUrl))) {
    throw new AppError(409, "All storyboard clips must be ready before rendering", "CLIPS_NOT_READY");
  }
  const [active] = await db.select().from(renderJobsTable).where(and(
    eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId),
    eq(renderJobsTable.status, "queued"),
  )).limit(1);
  const [running] = active ? [] : await db.select().from(renderJobsTable).where(and(
    eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId),
    eq(renderJobsTable.status, "running"),
  )).limit(1);
  if (active ?? running) return active ?? running!;
  const [job] = await db.insert(renderJobsTable).values({
    workspaceId, videoProjectId: projectId, manifestId: manifest.id, status: "queued",
    specification: { requestedAt: new Date().toISOString() },
  }).returning();
  // Deliberately detached: the HTTP request only queues durable work. Every
  // failure is persisted on the job for a later authenticated status request.
  void executeStudioRender(workspaceId, projectId, job!.id, log);
  return job!;
}

export async function createStudioTrailerRender(workspaceId: string, projectId: string, durationSeconds: 15 | 30, log: Logger) {
  const project = await scopedProject(workspaceId, projectId);
  const manifest = await scopedManifest(workspaceId, projectId);
  const spec = manifest.specification as JsonRecord;
  const executable = spec.executablePlan as JsonRecord | undefined;
  const masterDuration = (project.storyboard as Array<{ durationSeconds?: number }>).reduce((total, scene) => total + (scene.durationSeconds ?? 0), 0);
  if (masterDuration <= 30) throw new AppError(409, "Trailers require a master plan longer than 30 seconds", "TRAILER_MASTER_TOO_SHORT");
  const plans = ((spec.deliverables as JsonRecord | undefined)?.trailers ?? []) as Array<JsonRecord>;
  const plan = plans.find((candidate) => candidate.durationSeconds === durationSeconds);
  if (!plan) throw new AppError(409, "No approved trailer plan exists for this duration", "TRAILER_PLAN_UNAVAILABLE");
  const sceneById = new Map((project.storyboard as Array<{ id: string; durationSeconds: number; clipStatus?: string; clipUrl?: string; clipUrlHd?: string }>).map((scene) => [scene.id, scene]));
  const submittedSegments = (plan.orderedSceneSegments ?? []) as Array<{ sceneId: string; startSeconds: number; endSeconds: number }>;
  if (!submittedSegments.length) throw new AppError(409, "Trailer plan has no source segments", "TRAILER_SEGMENT_UNAVAILABLE");
  let remaining: number = durationSeconds;
  const compiledSegments: Array<{ sceneId: string; startSeconds: number; endSeconds: number }> = [];
  for (const segment of submittedSegments) {
    const scene = sceneById.get(segment.sceneId);
    if (!scene || scene.clipStatus !== "ready" || !(scene.clipUrlHd ?? scene.clipUrl) || !Number.isFinite(segment.startSeconds) || !Number.isFinite(segment.endSeconds) || segment.startSeconds < 0 || segment.endSeconds <= segment.startSeconds || segment.endSeconds > scene.durationSeconds) {
      throw new AppError(409, "Trailer segment is not backed by a ready bounded source", "TRAILER_SEGMENT_UNAVAILABLE");
    }
    if (remaining <= 0) break;
    const take = Math.min(segment.endSeconds - segment.startSeconds, remaining);
    compiledSegments.push({ sceneId: segment.sceneId, startSeconds: segment.startSeconds, endSeconds: Number((segment.startSeconds + take).toFixed(3)) });
    remaining = Number((remaining - take).toFixed(3));
  }
  if (remaining > 0.001) throw new AppError(409, `Trailer plan has insufficient material for ${durationSeconds}s`, "TRAILER_SEGMENT_INSUFFICIENT");
  const compiledPlan = { ...plan, orderedSceneSegments: compiledSegments, durationSeconds };
  const jobs = await db.select().from(renderJobsTable).where(and(eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId)));
  const active = jobs.find((job) => ["queued", "running"].includes(job.status) && (job.specification as JsonRecord).deliverableType === "trailer" && (job.specification as JsonRecord).durationSeconds === durationSeconds);
  if (active) return active;
  const [job] = await db.insert(renderJobsTable).values({
    workspaceId, videoProjectId: projectId, manifestId: manifest.id, status: "queued",
    specification: { deliverableType: "trailer", durationSeconds, expectedDurationMs: durationSeconds * 1000, planVersion: executable?.version, segmentPlan: compiledPlan, requestedAt: new Date().toISOString() },
  }).returning();
  void executeStudioRender(workspaceId, projectId, job!.id, log);
  return job!;
}

/** Reattach durable render jobs after a process restart. */
export async function recoverStudioRenders(log: Logger) {
  const jobs = await db.select().from(renderJobsTable).where(
    eq(renderJobsTable.status, "queued"),
  );
  const running = await db.select().from(renderJobsTable).where(eq(renderJobsTable.status, "running"));
  for (const job of [...jobs, ...running]) {
    // A killed ffmpeg has no surviving worker after boot; execute reclaims it.
    void executeStudioRender(job.workspaceId, job.videoProjectId, job.id, log);
  }
}

async function invalidateRenderedOutput(workspaceId: string, projectId: string, manifest: { id: string; specification: unknown }) {
  await db.update(renderJobsTable).set({ status: "cancelled", completedAt: new Date(), errorMessage: "Invalidated by timeline/correction revision" })
    .where(and(eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId), inArray(renderJobsTable.status, ["queued", "running", "succeeded"])));
  await db.update(qcReportsTable).set({ status: "needs_review", completedAt: new Date() })
    .where(and(eq(qcReportsTable.workspaceId, workspaceId), eq(qcReportsTable.videoProjectId, projectId)));
  await updatePhases(workspaceId, manifest.id, manifest.specification as JsonRecord, { edit: "in_progress", qc: "not_started", corrections: "not_started", export: "not_started" });
}

async function executeStudioRender(workspaceId: string, projectId: string, jobId: string, log: Logger) {
  let tempDir: string | undefined;
  try {
    const [project, manifest, job, tracks, items, assets] = await Promise.all([
      scopedProject(workspaceId, projectId), scopedManifest(workspaceId, projectId),
      db.select().from(renderJobsTable).where(and(eq(renderJobsTable.id, jobId), eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId))).then((rows) => rows[0]),
      db.select().from(timelineTracksTable).where(and(eq(timelineTracksTable.workspaceId, workspaceId), eq(timelineTracksTable.videoProjectId, projectId))),
      db.select().from(timelineItemsTable).where(and(eq(timelineItemsTable.workspaceId, workspaceId), eq(timelineItemsTable.videoProjectId, projectId))),
      db.select().from(productionAssetsTable).where(and(eq(productionAssetsTable.workspaceId, workspaceId), eq(productionAssetsTable.videoProjectId, projectId), eq(productionAssetsTable.status, "ready"))),
    ]);
    if (!job) throw new NotFoundError("Render job");
    await db.update(renderJobsTable).set({ status: "running", startedAt: new Date() }).where(and(eq(renderJobsTable.id, jobId), eq(renderJobsTable.workspaceId, workspaceId)));
    // Persistent timelines are rendered as one deterministic filter graph.
    // The storyboard fallback below is retained only for legacy projects which
    // predate timeline materialisation.
    if (tracks.length || items.length) {
      await executeCompiledTimeline({ workspaceId, projectId, jobId, project, manifest, job, tracks, items, assets });
      return;
    }
    // Only the first video track is executable today. Audio, graphics and
    // additional video compositing are deliberately not implied by a render.
    const primaryTrack = tracks.filter((track) => track.trackType === "video").sort((a, b) => a.position - b.position)[0];
    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const timelineItems = primaryTrack
      ? items.filter((item) => item.trackId === primaryTrack.id).sort((a, b) => a.startMs - b.startMs || a.position - b.position)
      : [];
    for (let index = 1; index < timelineItems.length; index++) {
      const previous = timelineItems[index - 1]!;
      const current = timelineItems[index]!;
      if (current.startMs < previous.startMs + previous.durationMs) {
        throw new AppError(409, "Overlapping items on the primary video track are not supported", "UNSUPPORTED_OVERLAPPING_VIDEO_EDIT");
      }
    }
    for (const item of timelineItems) {
      const asset = item.assetId ? assetById.get(item.assetId) : undefined;
      if (!asset || asset.assetType !== "video" || !asset.uri) {
        throw new AppError(409, "Every primary video timeline item must reference a ready video asset", "UNSUPPORTED_PRIMARY_VIDEO_ITEM");
      }
    }
    const timelineSources = timelineItems.map((item) => ({ item, asset: item.assetId ? assetById.get(item.assetId) : undefined }))
      .filter((entry) => Boolean(entry.asset?.uri)) as Array<{ item: typeof timelineItems[number]; asset: typeof assets[number] }>;
    const storyboard = project.storyboard as Array<{ id: string; durationSeconds?: number; clipStatus?: string; clipUrlHd?: string; clipUrl?: string }>;
    const storyboardUrls = storyboard.map((scene) => scene.clipStatus === "ready" ? { id: scene.id, durationSeconds: scene.durationSeconds ?? 0, uri: scene.clipUrlHd ?? scene.clipUrl } : undefined).filter((entry): entry is { id: string; durationSeconds: number; uri: string } => Boolean(entry?.uri));
    if ((!timelineSources.length && !storyboardUrls.length) || storyboard.some((scene) => scene.clipStatus && scene.clipStatus !== "ready")) throw new AppError(409, "All storyboard clips must be ready before rendering", "CLIPS_NOT_READY");
    tempDir = await mkdtemp(path.join(os.tmpdir(), "nexos-studio-render-"));
    const { width, height } = renderDimensions((project.config as { aspectRatio?: string }).aspectRatio);
    const normalized: string[] = [];
    const trailerSpec = job.specification as JsonRecord;
    const trailerSegments = ((trailerSpec.segmentPlan as JsonRecord | undefined)?.orderedSceneSegments ?? []) as Array<{ sceneId: string; startSeconds: number; endSeconds: number }>;
    const isTrailer = trailerSpec.deliverableType === "trailer";
    const sources = isTrailer
      ? trailerSegments.map((segment, index) => {
        const scene = storyboardUrls.find((candidate) => candidate.id === segment.sceneId);
        if (!scene || segment.endSeconds <= segment.startSeconds || segment.startSeconds < 0 || segment.endSeconds > scene.durationSeconds) throw new AppError(409, `Trailer segment ${index + 1} is not backed by a ready bounded source`, "TRAILER_SEGMENT_UNAVAILABLE");
        return { uri: scene.uri, startMs: index, durationMs: Math.round((segment.endSeconds - segment.startSeconds) * 1000), trimStartMs: Math.round(segment.startSeconds * 1000), trimEndMs: Math.round((scene.durationSeconds - segment.endSeconds) * 1000) };
      })
      : timelineSources.length
      ? timelineSources.map(({ item, asset }) => ({ uri: asset.uri, startMs: item.startMs, durationMs: item.durationMs, trimStartMs: item.trimStartMs, trimEndMs: item.trimEndMs }))
      : storyboardUrls.map((scene, index) => ({ uri: scene.uri, startMs: index, durationMs: 0, trimStartMs: 0, trimEndMs: 0 }));
    let cursorMs = 0;
    for (const [index, sourceInfo] of sources.entries()) {
      if (!isTrailer && timelineSources.length && sourceInfo.startMs > cursorMs) {
        const gap = path.join(tempDir, `gap-${index}.mp4`);
        await runFfmpeg(ffmpeg().input(`color=c=black:s=${width}x${height}:r=30`).inputOptions(["-f lavfi", "-t", String((sourceInfo.startMs - cursorMs) / 1000)]).outputOptions(["-c:v libx264", "-pix_fmt yuv420p", "-an"]), gap);
        normalized.push(gap);
      }
      const source = path.join(tempDir, `source-${index}.mp4`);
      const output = path.join(tempDir, `clip-${index}.mp4`);
      await downloadAsset(sourceInfo.uri, source);
      if (timelineSources.length || isTrailer) {
        const availableMs = (await probe(source)).durationMs - sourceInfo.trimStartMs - sourceInfo.trimEndMs;
        if (availableMs < sourceInfo.durationMs) {
          throw new AppError(409, "Timeline trim range exceeds the primary video asset", "UNSUPPORTED_VIDEO_TRIM");
        }
      }
      const command = ffmpeg(source);
      if (timelineSources.length || isTrailer) {
        command.seekInput(sourceInfo.trimStartMs / 1000).duration(sourceInfo.durationMs / 1000);
      }
      await runFfmpeg(command.videoFilters(`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`).outputOptions(["-map 0:v:0", "-map 0:a?", "-c:v libx264", "-pix_fmt yuv420p", "-c:a aac", "-movflags +faststart"]), output);
      normalized.push(output);
      cursorMs = (timelineSources.length || isTrailer) ? sourceInfo.startMs + sourceInfo.durationMs : cursorMs;
    }
    const list = path.join(tempDir, "inputs.txt");
    await fs.promises.writeFile(list, normalized.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
    const joined = path.join(tempDir, "joined.mp4");
    await runFfmpeg(ffmpeg().input(list).inputOptions(["-f concat", "-safe 0"]).outputOptions(["-c copy", "-movflags +faststart"]), joined);
    const finalPath = path.join(tempDir, "final.mp4");
    const { hasAudio } = await probe(joined);
    await runFfmpeg(ffmpeg(joined).outputOptions(hasAudio ? ["-c:v copy", "-c:a aac", "-af loudnorm=I=-16:TP=-1.5:LRA=11", "-movflags +faststart"] : ["-c copy", "-movflags +faststart"]), finalPath);
    if (isTrailer) {
      const expectedDurationMs = Number(trailerSpec.expectedDurationMs);
      const renderedDurationMs = (await probe(finalPath)).durationMs;
      if (!Number.isFinite(expectedDurationMs) || Math.abs(renderedDurationMs - expectedDurationMs) > 150) {
        throw new AppError(409, `Trailer output duration ${renderedDurationMs}ms does not match requested ${expectedDurationMs}ms`, "TRAILER_DURATION_MISMATCH");
      }
    }
    const outputUri = await uploadFileToGCS(finalPath, `audiovisual-studio/${workspaceId}/${projectId}/renders/${jobId}.mp4`, "video/mp4", { sha256: await sha256File(finalPath) });
    await db.update(renderJobsTable).set({ status: "succeeded", outputUri, outputMimeType: "video/mp4", completedAt: new Date() }).where(and(eq(renderJobsTable.id, jobId), eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId)));
    // Rendering proves only the assembled picture.  It does not start QC or
    // claim an unperformed sound/color pass.
    if (!isTrailer) await updatePhases(workspaceId, manifest.id, manifest.specification as JsonRecord, { edit: "ready", sound: "not_started", color: "not_started", qc: "not_started", export: "ready" });
  } catch (error) {
    log.error({ error, projectId, jobId }, "Studio render failed");
    await db.update(renderJobsTable).set({ status: "failed", errorMessage: error instanceof Error ? error.message : String(error), completedAt: new Date() }).where(and(eq(renderJobsTable.id, jobId), eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId)));
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}

async function executeCompiledTimeline(context: {
  workspaceId: string; projectId: string; jobId: string; project: VideoProject;
  manifest: { id: string; specification: unknown }; job: { specification: unknown };
  tracks: Array<any>; items: Array<any>; assets: Array<any>;
}) {
  const { workspaceId, projectId, jobId, project, manifest, job, tracks, items, assets } = context;
  const spec = job.specification as JsonRecord;
  const projectConfig = project.config as { aspectRatio?: string; fps?: number; resolution?: string };
  const config = { ...projectConfig, ...((manifest.specification as JsonRecord).timelineRender as { fps?: number; resolution?: string } ?? {}) };
  const requestedDurationMs = spec.deliverableType === "trailer" ? Number(spec.expectedDurationMs) : Math.max(1, ...items.map((item) => item.startMs + item.durationMs));
  if (!Number.isSafeInteger(requestedDurationMs) || requestedDurationMs <= 0) throw new AppError(409, "Timeline has no renderable duration", "TIMELINE_DURATION_REQUIRED");
  let dimensions: { width: number; height: number; resolution: string; is4k: boolean };
  try { dimensions = resolveRenderDimensions(config.resolution, projectConfig.aspectRatio); }
  catch (error) { throw new AppError(400, error instanceof Error ? error.message : String(error), "UNSUPPORTED_RENDER_RESOLUTION"); }
  if (dimensions.is4k) {
    // This CPU renderer deliberately never silently claims 4K. A dedicated
    // capability-gated worker can opt in later.
    throw new AppError(409, "4K rendering requires an approved hardware-capable worker", "RENDER_4K_UNAVAILABLE");
  }
  const { width, height } = dimensions;
  const fps = [24, 25, 30, 50, 60].includes(config.fps ?? 30) ? config.fps ?? 30 : 30;
  const referenced = new Set(items.flatMap((item) => item.assetId ? [item.assetId] : []));
  const media = assets.filter((asset) => referenced.has(asset.id));
  for (const item of items) {
    if (item.assetId && !media.some((asset) => asset.id === item.assetId)) throw new AppError(409, "Timeline item references a missing, unready, or cross-workspace asset", "TIMELINE_ASSET_UNAVAILABLE");
  }
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "nexos-timeline-filter-"));
  try {
    const renderAssets: RenderAsset[] = [];
    for (const [index, asset] of media.entries()) {
      const ext = asset.assetType === "image" || asset.assetType === "graphic" ? ".png" : ".media";
      const localPath = path.join(tempDir, `asset-${index}${ext}`);
      await downloadAsset(asset.uri, localPath);
      renderAssets.push({ id: asset.id, assetType: asset.assetType, durationMs: asset.durationMs, localPath });
    }
    const graph = compileTimelineFilter({
      tracks: tracks as RenderTrack[], items: items as RenderItem[], assets: renderAssets,
      width, height, fps, durationMs: requestedDurationMs, baseInput: 0,
    });
    const output = path.join(tempDir, "final.mp4");
    const command = ffmpeg().input(`color=c=black:s=${width}x${height}:r=${fps}:d=${requestedDurationMs / 1000}`).inputOptions(["-f", "lavfi"]);
    for (const asset of renderAssets) {
      command.input(asset.localPath);
      if (asset.assetType === "image" || asset.assetType === "graphic") command.inputOptions(["-loop", "1", "-framerate", String(fps)]);
    }
    // Map filter outputs explicitly below. Passing output labels to
    // fluent-ffmpeg's complexFilter() also adds implicit -map arguments,
    // which mapped [vout] twice on video-only timelines.
    command.complexFilter(graph.filter)
      // CI and small private workers frequently expose a very high host CPU
      // count behind a tight thread/process quota. Letting x264 auto-size its
      // pool then fails while opening the output encoder (often surfaced only
      // as "Error opening output file ... Invalid argument"). One encoder
      // thread is deterministic and does not alter the validated timeline.
      .outputOptions(["-map", "[vout]", ...(graph.audioOutput ? ["-map", "[aout]"] : []), "-t", (requestedDurationMs / 1000).toFixed(3), "-r", String(fps), "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", ...(graph.audioOutput ? ["-c:a", "aac", "-ar", "48000"] : []), "-movflags", "+faststart"]);
    await runFfmpeg(command, output);
    const [current] = await db.select({ status: renderJobsTable.status }).from(renderJobsTable)
      .where(and(eq(renderJobsTable.id, jobId), eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId))).limit(1);
    // A revision may arrive while ffmpeg is working. Never publish stale media.
    if (current?.status === "cancelled") return;
    const evidence = await probe(output);
    const durationMatches = Math.abs(evidence.durationMs - requestedDurationMs) <= 150;
    const videoMatches = evidence.width === width && evidence.height === height && Math.abs((evidence.fps ?? 0) - fps) < 0.1;
    const audioExpected = graph.audioOutput !== undefined;
    if (!durationMatches || !videoMatches || (audioExpected && !evidence.hasAudio)) {
      throw new AppError(409, `Render evidence differs from specification: ${JSON.stringify({ expected: { durationMs: requestedDurationMs, width, height, fps, audioExpected }, actual: evidence })}`, "RENDER_EVIDENCE_MISMATCH");
    }
    const outputUri = await uploadFileToGCS(output, `audiovisual-studio/${workspaceId}/${projectId}/renders/${jobId}.mp4`, "video/mp4", { sha256: await sha256File(output) });
    await db.update(renderJobsTable).set({
      status: "succeeded", outputUri, outputMimeType: "video/mp4", completedAt: new Date(),
      specification: { ...spec, expectedDurationMs: requestedDurationMs, render: { width, height, fps, resolution: dimensions.resolution }, evidence: { ...evidence, technicalPass: true } },
    }).where(and(eq(renderJobsTable.id, jobId), eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId)));
    // Technical QC is reproducible ffprobe evidence only. It must not be
    // confused with the separate semantic/manual visual review endpoint.
    await db.insert(qcReportsTable).values({
      workspaceId, videoProjectId: projectId, renderJobId: jobId, status: "passed",
      summary: "Technical QC passed: duration, dimensions, frame rate and required audio stream match the render specification.",
      specification: { kind: "technical_ffprobe", evidence: { ...evidence, expectedDurationMs: requestedDurationMs, width, height, fps, audioExpected } },
      completedAt: new Date(),
    });
    if (spec.deliverableType !== "trailer") await updatePhases(workspaceId, manifest.id, manifest.specification as JsonRecord, { edit: "ready", sound: "ready", color: "ready", qc: "ready", export: "ready" });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function getStudioRender(workspaceId: string, projectId: string, jobId: string) {
  await scopedProject(workspaceId, projectId);
  const [job] = await db.select().from(renderJobsTable).where(and(eq(renderJobsTable.id, jobId), eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId))).limit(1);
  if (!job) throw new NotFoundError("Render job");
  return job;
}

/** Records that the server handed a completed render to the authenticated client.
 * It deliberately does not assert that a browser or operating system saved it. */
export async function createRenderDownloadHandoff(workspaceId: string, projectId: string, renderJobId: string) {
  const render = await getStudioRender(workspaceId, projectId, renderJobId);
  if (render.status !== "succeeded" || !render.outputUri || !ownedStudioKey(workspaceId, projectId, render.outputUri)) {
    throw new AppError(409, "Render concluído não está disponível para download", "RENDER_MEDIA_UNAVAILABLE");
  }
  const meta = await getGCSObjectMeta(render.outputUri);
  await db.insert(auditLogsTable).values({
    workspaceId, action: "video_render_download_handoff_started", actor: "authenticated_user",
    data: { videoProjectId: projectId, renderJobId, checksum: meta.sha256, byteSize: meta.size },
  });
  return { render, meta };
}

function ownedStudioKey(workspaceId: string, projectId: string, key: string): boolean {
  return key.startsWith(`audiovisual-studio/${workspaceId}/${projectId}/`);
}
function ownedNativeKey(workspaceId: string, projectId: string, key: string): boolean {
  return key.startsWith(`native-media/${workspaceId}/${projectId}/`);
}

/** Package data deliberately uses local identifiers: neither database IDs nor
 * workspace authority, signed links, consent material, or provider credentials
 * may leave the tenant boundary. */
function packageSafe(value: unknown): unknown {
  const blocked = /(?:token|secret|credential|signed|workspace|tenant|consent|avatarphoto|voicesample|voiceid|avatarid|provider|url|uri)/i;
  if (Array.isArray(value)) return value.map(packageSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as JsonRecord)
    .filter(([key]) => !blocked.test(key))
    .map(([key, child]) => [key, packageSafe(child)]));
  return value;
}
function packageName(value: string): string {
  return value.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "media";
}
function sha256Json(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export interface EditablePackageExport {
  path: string;
  filename: string;
  checksum: string;
  size: number;
  cleanup: () => Promise<void>;
}

/** Stage rather than trailer a zip: checksums are known before headers are sent,
 * and the staged file is a short-lived project-owned handoff artifact. */
export async function createEditablePackageExport(workspaceId: string, projectId: string, includeOutputs = false): Promise<EditablePackageExport> {
  const project = await scopedProject(workspaceId, projectId);
  assertMediaAvailable(project);
  const manifest = await scopedManifest(workspaceId, projectId);
  const [assets, tracks, items, renders] = await Promise.all([
    db.select().from(productionAssetsTable).where(and(eq(productionAssetsTable.workspaceId, workspaceId), eq(productionAssetsTable.videoProjectId, projectId))),
    db.select().from(timelineTracksTable).where(and(eq(timelineTracksTable.workspaceId, workspaceId), eq(timelineTracksTable.videoProjectId, projectId))).orderBy(timelineTracksTable.position),
    db.select().from(timelineItemsTable).where(and(eq(timelineItemsTable.workspaceId, workspaceId), eq(timelineItemsTable.videoProjectId, projectId))).orderBy(timelineItemsTable.position),
    includeOutputs ? db.select().from(renderJobsTable).where(and(eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId), eq(renderJobsTable.status, "succeeded"))) : Promise.resolve([]),
  ]);
  const assetIds = new Map(assets.map((asset, index) => [asset.id, `asset-${String(index + 1).padStart(4, "0")}`]));
  const trackIds = new Map(tracks.map((track, index) => [track.id, `track-${String(index + 1).padStart(3, "0")}`]));
  const referencedAssetIds = new Set(items.flatMap((item) => item.assetId ? [item.assetId] : []));
  for (const asset of assets) {
    if (referencedAssetIds.has(asset.id) && ["video", "audio", "image", "graphic", "font"].includes(asset.assetType) && !ownedStudioKey(workspaceId, projectId, asset.uri)) {
      throw new AppError(409, `A fonte necessária "${asset.name}" não está disponível para um pacote editável.`, "PACKAGE_SOURCE_MEDIA_UNAVAILABLE");
    }
  }
  const media: Array<{ archivePath: string; key: string; mimeType: string | null; packageId: string }> = [];
  for (const asset of assets) {
    if (!ownedStudioKey(workspaceId, projectId, asset.uri)) continue;
    const id = assetIds.get(asset.id)!;
    media.push({ archivePath: `media/${id}-${packageName(asset.name)}${path.extname(asset.uri) || ""}`, key: asset.uri, mimeType: asset.mimeType, packageId: id });
  }
  for (const [index, render] of renders.entries()) {
    if (render.outputUri && ownedStudioKey(workspaceId, projectId, render.outputUri)) media.push({ archivePath: `outputs/render-${String(index + 1).padStart(3, "0")}${path.extname(render.outputUri) || ".mp4"}`, key: render.outputUri, mimeType: render.outputMimeType, packageId: `output-${index + 1}` });
  }
  const checksums: Record<string, { sha256: string; size: number; mimeType: string | null }> = {};
  for (const source of media) {
    const meta = await getGCSObjectMeta(source.key);
    const sha256 = meta.sha256 ?? await sha256Object(source.key);
    checksums[source.archivePath] = { sha256, size: meta.size, mimeType: source.mimeType };
  }
  const mediaById = new Map(media.map((entry) => [entry.packageId, entry.archivePath]));
  const packageProject = {
    format: "nexosvideo", formatVersion: 1, schemaVersion: 1,
    project: { title: packageName(project.title), format: project.format, status: project.status, retentionPolicy: project.retentionPolicy, config: packageSafe(project.config), script: project.script, storyboard: packageSafe(project.storyboard) },
    manifest: { name: packageName(manifest.name), status: manifest.status, specification: packageSafe(manifest.specification) },
    assets: assets.map((asset) => ({ id: assetIds.get(asset.id), assetType: asset.assetType, status: asset.status, name: packageName(asset.name), mediaPath: mediaById.get(assetIds.get(asset.id)!), mimeType: asset.mimeType, byteSize: asset.byteSize, durationMs: asset.durationMs, specification: packageSafe(asset.specification) })),
    tracks: tracks.map((track) => ({ id: trackIds.get(track.id), trackType: track.trackType, name: packageName(track.name), position: track.position, settings: packageSafe(track.settings) })),
    items: items.map((item, index) => ({ id: `item-${String(index + 1).padStart(4, "0")}`, trackId: trackIds.get(item.trackId), assetId: item.assetId ? assetIds.get(item.assetId) : undefined, position: item.position, startMs: item.startMs, durationMs: item.durationMs, trimStartMs: item.trimStartMs, trimEndMs: item.trimEndMs, settings: packageSafe(item.settings) })),
  };
  checksums["project.json"] = { sha256: sha256Json(packageProject), size: Buffer.byteLength(JSON.stringify(packageProject)), mimeType: "application/json" };
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "nexosvideo-export-"));
  const output = path.join(tempDir, `${packageName(project.title)}.nexosvideo`);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const destination = createWriteStream(output);
  archive.pipe(destination);
  archive.append(JSON.stringify(packageProject), { name: "project.json" });
  archive.append(JSON.stringify({ format: "nexosvideo-checksums", version: 1, files: checksums }), { name: "checksums.json" });
  for (const source of media) archive.append(createGCSObjectStream(source.key), { name: source.archivePath });
  const closed = once(destination, "close");
  await archive.finalize();
  await closed;
  const info = await stat(output);
  const checksum = await sha256File(output);
  await db.insert(auditLogsTable).values({ workspaceId, action: "video_editable_package_handoff_started", actor: "authenticated_user", data: { videoProjectId: projectId, checksum, byteSize: info.size, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() } });
  return { path: output, filename: `${packageName(project.title)}.nexosvideo`, checksum, size: info.size, cleanup: () => rm(tempDir, { recursive: true, force: true }) };
}

export async function confirmEditablePackage(workspaceId: string, projectId: string, checksum: string, confirmation: string) {
  await scopedProject(workspaceId, projectId);
  if (confirmation !== "SALVEI O PACOTE EDITÁVEL") throw new AppError(400, 'Digite exatamente "SALVEI O PACOTE EDITÁVEL" para confirmar.', "PACKAGE_CONFIRMATION_REQUIRED");
  // Filter data in application code because audit JSON differs between drivers.
  const handoffs = await db.select().from(auditLogsTable).where(and(eq(auditLogsTable.workspaceId, workspaceId), eq(auditLogsTable.action, "video_editable_package_handoff_started"))).orderBy(desc(auditLogsTable.createdAt));
  if (!handoffs.some((row) => (row.data as JsonRecord).videoProjectId === projectId && (row.data as JsonRecord).checksum === checksum)) throw new AppError(409, "O checksum não corresponde a um pacote editável entregue para este projeto.", "PACKAGE_CHECKSUM_MISMATCH");
  await db.insert(auditLogsTable).values({ workspaceId, action: "video_editable_package_saved_confirmed", actor: "authenticated_user", data: { videoProjectId: projectId, checksum, confirmation } });
  return { checksum, confirmed: true };
}

const packageChecksumSchema = z.object({
  format: z.literal("nexosvideo-checksums"), version: z.literal(1),
  files: z.record(z.string().regex(/^(?:project\.json|media\/[A-Za-z0-9._/-]+|outputs\/[A-Za-z0-9._/-]+)$/), z.object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/i), size: z.number().int().nonnegative(), mimeType: z.string().nullable(),
  }).strict()),
}).strict();
const importedPackageSchema = z.object({
  format: z.literal("nexosvideo"), formatVersion: z.literal(1), schemaVersion: z.literal(1),
  project: z.object({
    title: z.string().min(1).max(200), format: z.enum(["vsl", "cpl", "live_promo", "stories", "reels", "youtube", "webinar_promo", "testimonial", "product_demo"]),
    status: z.enum(["intake", "script_generating", "script_ready", "script_approved", "storyboard_generating", "storyboard_ready", "storyboard_approved", "preview_generating", "preview_ready", "preview_approved", "awaiting_clone", "final_generating", "completed", "failed"]),
    retentionPolicy: z.enum(["archive", "ephemeral"]), config: z.record(z.string(), z.unknown()), script: z.string().nullable(), storyboard: z.array(z.unknown()),
  }).strict(),
  manifest: z.object({ name: z.string().min(1).max(200), status: z.enum(["draft", "active", "locked", "archived"]), specification: z.record(z.string(), z.unknown()) }).strict(),
  assets: z.array(z.object({ id: z.string().regex(/^asset-\d+$/), assetType: z.enum(["video", "audio", "image", "subtitle", "graphic", "font", "document"]), status: z.enum(["uploading", "ready", "processing", "failed", "archived"]), name: z.string().min(1).max(300), mediaPath: z.string().regex(/^media\/[A-Za-z0-9._/-]+$/).optional(), mimeType: z.string().nullable().optional(), byteSize: z.number().int().nonnegative().nullable().optional(), durationMs: z.number().int().nonnegative().nullable().optional(), specification: z.record(z.string(), z.unknown()) }).strict()).max(10000),
  tracks: z.array(z.object({ id: z.string().regex(/^track-\d+$/), trackType: z.enum(["video", "audio", "voiceover", "music", "graphics", "subtitles"]), name: z.string().min(1).max(300), position: z.number().int(), settings: z.record(z.string(), z.unknown()) }).strict()).max(10000),
  items: z.array(z.object({ id: z.string().regex(/^item-\d+$/), trackId: z.string().regex(/^track-\d+$/), assetId: z.string().regex(/^asset-\d+$/).optional(), position: z.number().int(), startMs: z.number().int().nonnegative(), durationMs: z.number().int().nonnegative(), trimStartMs: z.number().int().nonnegative(), trimEndMs: z.number().int().nonnegative(), settings: z.record(z.string(), z.unknown()) }).strict()).max(100000),
}).strict();

function runZipInspector(archive: string, extracted: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [path.resolve(process.cwd(), "src/scripts/nexosvideo_zip.py"), archive, extracted], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = ""; let errors = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { errors += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        const result = JSON.parse(output) as { ok?: boolean; error?: string };
        if (code === 0 && result.ok) resolve();
        else reject(new AppError(400, result.error ?? errors ?? "Pacote inválido.", "INVALID_EDITABLE_PACKAGE"));
      } catch { reject(new AppError(400, "Validador de pacote não retornou resultado válido.", "INVALID_EDITABLE_PACKAGE")); }
    });
  });
}

export async function importEditablePackage(workspaceId: string, archive: string) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "nexosvideo-import-"));
  const extracted = path.join(tempDir, "contents");
  const uploaded: string[] = [];
  try {
    await runZipInspector(archive, extracted);
    const projectRaw = JSON.parse(await fs.promises.readFile(path.join(extracted, "project.json"), "utf8"));
    const checksumRaw = JSON.parse(await fs.promises.readFile(path.join(extracted, "checksums.json"), "utf8"));
    const parsedProject = importedPackageSchema.safeParse(projectRaw);
    const parsedChecksums = packageChecksumSchema.safeParse(checksumRaw);
    if (!parsedProject.success || !parsedChecksums.success) throw new AppError(400, "project.json ou checksums.json não segue o schema suportado.", "INVALID_EDITABLE_PACKAGE");
    const packageData = parsedProject.data; const checksums = parsedChecksums.data.files;
    if (!checksums["project.json"] || checksums["project.json"]!.sha256.toLowerCase() !== sha256Json(projectRaw).toLowerCase()) throw new AppError(400, "Checksum de project.json inválido.", "PACKAGE_CHECKSUM_INVALID");
    for (const mediaPath of Object.keys(checksums).filter((entry) => entry !== "project.json")) {
      const declared = checksums[mediaPath];
      if (!declared) throw new AppError(400, `Checksum ausente para ${mediaPath}.`, "PACKAGE_CHECKSUM_INVALID");
      const mediaFile = path.join(extracted, ...mediaPath.split("/"));
      const info = await stat(mediaFile).catch(() => undefined);
      if (!info || !info.isFile() || info.size !== declared.size || (await sha256File(mediaFile)).toLowerCase() !== declared.sha256.toLowerCase()) throw new AppError(400, `Checksum inválido para ${mediaPath}.`, "PACKAGE_CHECKSUM_INVALID");
    }
    // Do not trust package provenance/config authority. The sanitizer also
    // drops consent and provider fields even if a hand-crafted package adds it.
    const importedConfig = packageSafe(packageData.project.config) as JsonRecord;
    const importedProjectId = crypto.randomUUID();
    const assetObjectPaths = new Map<string, string>();
    for (const asset of packageData.assets) {
      if (!asset.mediaPath) continue;
      const source = path.join(extracted, ...asset.mediaPath.split("/"));
      const extension = path.extname(asset.mediaPath).replace(/[^A-Za-z0-9.]/g, "");
      const key = `audiovisual-studio/${workspaceId}/${importedProjectId}/assets/${crypto.randomUUID()}${extension}`;
      const checksum = checksums[asset.mediaPath]!;
      await uploadFileToGCS(source, key, checksum.mimeType ?? asset.mimeType ?? "application/octet-stream", { sha256: checksum.sha256 });
      uploaded.push(key); assetObjectPaths.set(asset.id, key);
    }
    const detail = await db.transaction(async (tx) => {
      const [project] = await tx.insert(videoProjectsTable).values({
        id: importedProjectId, workspaceId, title: packageName(packageData.project.title), format: packageData.project.format, status: packageData.project.status,
        retentionPolicy: packageData.project.retentionPolicy, config: importedConfig as VideoProject["config"], script: packageData.project.script, storyboard: packageData.project.storyboard as VideoProject["storyboard"],
      }).returning();
      const [manifest] = await tx.insert(productionManifestsTable).values({ workspaceId, videoProjectId: project!.id, name: packageName(packageData.manifest.name), status: packageData.manifest.status, specification: packageSafe(packageData.manifest.specification) as JsonRecord }).returning();
      const assetIds = new Map<string, string>();
      for (const asset of packageData.assets) {
        const [created] = await tx.insert(productionAssetsTable).values({ workspaceId, videoProjectId: project!.id, manifestId: manifest!.id, assetType: asset.assetType, status: asset.status, name: packageName(asset.name), uri: assetObjectPaths.get(asset.id) ?? "package://inline", mimeType: asset.mimeType, byteSize: asset.byteSize, durationMs: asset.durationMs, specification: packageSafe(asset.specification) as JsonRecord }).returning();
        assetIds.set(asset.id, created!.id);
      }
      const trackIds = new Map<string, string>();
      for (const track of packageData.tracks) {
        const [created] = await tx.insert(timelineTracksTable).values({ workspaceId, videoProjectId: project!.id, manifestId: manifest!.id, trackType: track.trackType, name: packageName(track.name), position: track.position, settings: packageSafe(track.settings) as JsonRecord }).returning();
        trackIds.set(track.id, created!.id);
      }
      for (const item of packageData.items) {
        const trackId = trackIds.get(item.trackId); if (!trackId) throw new AppError(400, "Item referencia faixa inexistente.", "INVALID_EDITABLE_PACKAGE");
        if (item.assetId && !assetIds.has(item.assetId)) throw new AppError(400, "Item referencia asset inexistente.", "INVALID_EDITABLE_PACKAGE");
        await tx.insert(timelineItemsTable).values({ workspaceId, videoProjectId: project!.id, trackId, assetId: item.assetId ? assetIds.get(item.assetId) : null, position: item.position, startMs: item.startMs, durationMs: item.durationMs, trimStartMs: item.trimStartMs, trimEndMs: item.trimEndMs, settings: packageSafe(item.settings) as JsonRecord });
      }
      await tx.insert(productionRevisionsTable).values({ workspaceId, videoProjectId: project!.id, manifestId: manifest!.id, revisionNumber: 1, note: "Imported editable package", specification: { packageFormatVersion: 1 } });
      return project!;
    });
    await db.insert(auditLogsTable).values({ workspaceId, action: "video_editable_package_imported", actor: "authenticated_user", data: { videoProjectId: detail.id, assetCount: packageData.assets.length } });
    return getStudioDetail(workspaceId, detail.id);
  } catch (error) {
    await Promise.all(uploaded.map((key) => deleteGCSObject(key).catch(() => undefined)));
    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
function nativeObjectKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const key = (entry as { key?: unknown }).key;
    return typeof key === "string" ? [key] : [];
  });
}

export interface PurgeEphemeralMediaInput {
  renderJobId: string;
  expectedChecksum: string;
  confirmation: string;
}

/** Delete precisely this project's known media, leaving timeline/audit tombstones. */
export async function purgeEphemeralMedia(workspaceId: string, projectId: string, input: PurgeEphemeralMediaInput, retry = false) {
  const project = await scopedProject(workspaceId, projectId);
  if (project.retentionPolicy !== "ephemeral") throw new AppError(409, "Este projeto usa retenção em arquivo, não mídia efêmera.", "EPHEMERAL_RETENTION_REQUIRED");
  if (project.mediaPurgedAt) throw new AppError(409, "A mídia deste projeto já foi apagada irreversivelmente.", "MEDIA_ALREADY_PURGED");
  if (input.confirmation !== "APAGAR MÍDIA") throw new AppError(400, 'Digite exatamente "APAGAR MÍDIA" para confirmar.', "PURGE_CONFIRMATION_REQUIRED");
  const confirmations = await db.select().from(auditLogsTable).where(and(
    eq(auditLogsTable.workspaceId, workspaceId), eq(auditLogsTable.action, "video_editable_package_saved_confirmed"),
  )).orderBy(desc(auditLogsTable.createdAt));
  const checksum = input.expectedChecksum.toLowerCase();
  if (!confirmations.some((row) => (row.data as JsonRecord).videoProjectId === projectId && (row.data as JsonRecord).checksum === checksum)) {
    throw new AppError(409, "Exporte e confirme que salvou o pacote editável com este checksum antes de apagar a mídia.", "EDITABLE_PACKAGE_CONFIRMATION_REQUIRED");
  }
  const render = await getStudioRender(workspaceId, projectId, input.renderJobId);
  if (render.status !== "succeeded") throw new AppError(409, "O render informado não está concluído.", "RENDER_MEDIA_UNAVAILABLE");

  const [activeRender] = await db.select({ id: renderJobsTable.id }).from(renderJobsTable).where(and(
    eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId), inArray(renderJobsTable.status, ["queued", "running"]),
  )).limit(1);
  const [activeNative] = await db.select({ id: nativeMediaJobsTable.id }).from(nativeMediaJobsTable).where(and(
    eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.videoProjectId, projectId), inArray(nativeMediaJobsTable.status, ["queued", "leased", "running"]),
  )).limit(1);
  if (activeRender || activeNative) throw new AppError(409, "Aguarde o término de todos os jobs de geração, renderização e mídia nativa.", "MEDIA_JOBS_ACTIVE");

  const prior = await db.select().from(videoMediaPurgesTable).where(and(
    eq(videoMediaPurgesTable.workspaceId, workspaceId), eq(videoMediaPurgesTable.videoProjectId, projectId),
  )).orderBy(desc(videoMediaPurgesTable.createdAt)).limit(1);
  if (prior[0] && prior[0].status !== "purge_failed" && !retry) throw new AppError(409, "Uma solicitação de purge já está em andamento.", "PURGE_ALREADY_REQUESTED");
  if (retry && prior[0]?.status !== "purge_failed") throw new AppError(409, "Não há purge com falha para repetir.", "PURGE_RETRY_UNAVAILABLE");

  const [purge] = await db.insert(videoMediaPurgesTable).values({
    workspaceId, videoProjectId: projectId, renderJobId: input.renderJobId, status: "in_progress",
    acknowledgedChecksum: checksum, confirmationText: input.confirmation, startedAt: new Date(),
  }).returning();
  const assets = await db.select().from(productionAssetsTable).where(and(eq(productionAssetsTable.workspaceId, workspaceId), eq(productionAssetsTable.videoProjectId, projectId)));
  const renders = await db.select().from(renderJobsTable).where(and(eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId)));
  const native = await db.select().from(nativeMediaJobsTable).where(and(eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.videoProjectId, projectId)));
  // Prefix listing is intentionally exact (workspace AND project), never a tenant-wide deletion.
  const listed = await Promise.all([
    listGCSObjects(`audiovisual-studio/${workspaceId}/${projectId}/`),
    listGCSObjects(`native-media/${workspaceId}/${projectId}/`),
  ]);
  const keys = new Set<string>([...listed.flat(), ...assets.map((asset) => asset.uri).filter((key) => ownedStudioKey(workspaceId, projectId, key)),
    ...renders.map((render) => render.outputUri).filter((key): key is string => Boolean(key && ownedStudioKey(workspaceId, projectId, key))),
    ...native.flatMap((job) => [...nativeObjectKeys(job.inputObjects), ...nativeObjectKeys(job.outputObjects)]).filter((key) => ownedNativeKey(workspaceId, projectId, key))]);
  let deleted = 0; let bytes = 0; let deletedBytes = 0; const errors: string[] = [];
  for (const key of keys) {
    try {
      const meta = await getGCSObjectMeta(key).catch((error: any) => error?.code === 404 || error?.code === "ENOENT" ? undefined : Promise.reject(error));
      if (meta) bytes += meta.size;
      await deleteGCSObject(key);
      deleted++; if (meta) deletedBytes += meta.size;
    } catch (error) { errors.push(`${key}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  if (errors.length) {
    await db.update(videoMediaPurgesTable).set({ status: "purge_failed", objectCount: keys.size, deletedObjectCount: deleted, byteCount: bytes, deletedByteCount: deletedBytes, errors })
      .where(and(eq(videoMediaPurgesTable.id, purge!.id), eq(videoMediaPurgesTable.workspaceId, workspaceId)));
    throw new AppError(502, "A exclusão de parte da mídia falhou; a mídia restante não foi declarada apagada. Tente novamente.", "PURGE_PARTIAL_FAILURE");
  }
  await db.transaction(async (tx) => {
    await tx.update(productionAssetsTable).set({ status: "archived", uri: "purged://media", byteSize: null, updatedAt: new Date() })
      .where(and(eq(productionAssetsTable.workspaceId, workspaceId), eq(productionAssetsTable.videoProjectId, projectId)));
    await tx.update(renderJobsTable).set({ outputUri: null, outputMimeType: null, updatedAt: new Date() })
      .where(and(eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId)));
    for (const job of native) await tx.update(nativeMediaJobsTable).set({ inputObjects: [], outputObjects: [], updatedAt: new Date() })
      .where(and(eq(nativeMediaJobsTable.id, job.id), eq(nativeMediaJobsTable.workspaceId, workspaceId), eq(nativeMediaJobsTable.videoProjectId, projectId)));
    await tx.update(videoProjectsTable).set({ mediaPurgedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(videoProjectsTable.id, projectId), eq(videoProjectsTable.workspaceId, workspaceId)));
    await tx.update(videoMediaPurgesTable).set({ status: "purged", purgedAt: new Date(), objectCount: keys.size, deletedObjectCount: deleted, byteCount: bytes, deletedByteCount: deletedBytes, errors: [] })
      .where(and(eq(videoMediaPurgesTable.id, purge!.id), eq(videoMediaPurgesTable.workspaceId, workspaceId)));
    await tx.insert(auditLogsTable).values({ workspaceId, action: "video_ephemeral_media_purged", actor: "authenticated_user", data: { videoProjectId: projectId, renderJobId: input.renderJobId, objectCount: keys.size, deletedObjectCount: deleted, byteCount: bytes, checksum } });
  });
  return { status: "purged" as const, objectCount: keys.size, deletedObjectCount: deleted, byteCount: bytes };
}

export async function submitQc(workspaceId: string, projectId: string, renderJobId: string, log: Logger) {
  const project = await scopedProject(workspaceId, projectId);
  const [render] = await db.select().from(renderJobsTable).where(and(eq(renderJobsTable.id, renderJobId), eq(renderJobsTable.workspaceId, workspaceId), eq(renderJobsTable.videoProjectId, projectId), eq(renderJobsTable.status, "succeeded"))).limit(1);
  if (!render?.outputUri) throw new AppError(409, "QC requires a completed render with an output URI", "RENDER_REQUIRED");
  // The render object is intentionally not treated as reviewable solely from a
  // URI.  Until a bounded frame/audio evidence extractor is available for the
  // configured object store, fail closed rather than allowing an AI verdict to
  // mark an unseen video as passed.
  const [report] = await db.insert(qcReportsTable).values({
    workspaceId, videoProjectId: projectId, renderJobId, status: "needs_review",
    summary: "Automated QC requires extracted visual and audio evidence; manual review is required.",
    specification: { evidence: { available: false, reason: "render evidence extraction unavailable" } },
  }).returning();
  return report!;
}

export async function createCorrection(workspaceId: string, projectId: string, input: { revisionId: string; qcIssueId?: string; instruction: string; specification?: JsonRecord }) {
  await scopedProject(workspaceId, projectId);
  const [revision] = await db.select().from(productionRevisionsTable).where(and(eq(productionRevisionsTable.id, input.revisionId), eq(productionRevisionsTable.workspaceId, workspaceId), eq(productionRevisionsTable.videoProjectId, projectId))).limit(1);
  if (!revision) throw new NotFoundError("Revisão de produção");
  if (input.qcIssueId) { const [issue] = await db.select({ id: qcIssuesTable.id }).from(qcIssuesTable).where(and(eq(qcIssuesTable.id, input.qcIssueId), eq(qcIssuesTable.workspaceId, workspaceId), eq(qcIssuesTable.videoProjectId, projectId))).limit(1); if (!issue) throw new NotFoundError("Issue de QC"); }
  const [loop] = await db.insert(correctionLoopsTable).values({ workspaceId, videoProjectId: projectId, ...input, specification: input.specification ?? {} }).returning();
  return loop!;
}

export async function resolveCorrection(workspaceId: string, projectId: string, correctionId: string, resolution: string) {
  const [loop] = await db.update(correctionLoopsTable).set({ status: "resolved", resolution, resolvedAt: new Date(), updatedAt: new Date() }).where(and(eq(correctionLoopsTable.id, correctionId), eq(correctionLoopsTable.workspaceId, workspaceId), eq(correctionLoopsTable.videoProjectId, projectId), eq(correctionLoopsTable.status, "open"))).returning();
  if (!loop) throw new NotFoundError("Correção aberta");
  const manifest = await scopedManifest(workspaceId, projectId);
  const [latest] = await db.select({ revisionNumber: productionRevisionsTable.revisionNumber }).from(productionRevisionsTable)
    .where(and(eq(productionRevisionsTable.workspaceId, workspaceId), eq(productionRevisionsTable.videoProjectId, projectId))).orderBy(desc(productionRevisionsTable.revisionNumber)).limit(1);
  await db.insert(productionRevisionsTable).values({
    workspaceId, videoProjectId: projectId, manifestId: manifest.id, parentRevisionId: loop.revisionId,
    revisionNumber: (latest?.revisionNumber ?? 0) + 1, note: `Correction resolved: ${resolution}`,
    specification: { correctionId, instruction: loop.instruction, timelineChanged: false },
  });
  await invalidateRenderedOutput(workspaceId, projectId, manifest);
  return loop;
}
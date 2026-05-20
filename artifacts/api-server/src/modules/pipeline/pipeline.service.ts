import { eq, and, asc, sql } from "drizzle-orm";
import {
  db,
  launchPipelinesTable,
  campaignsTable,
  auditLogsTable,
} from "@workspace/db";
import { NotFoundError } from "../../lib/errors.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreatePipelineInput {
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface PipelineCampaign {
  id: string;
  title: string;
  status: string;
  pipelinePosition: number;
  durationDays: number | null;
  budgetTotal: number | null;
  revenueTarget: string | null;
  brainData: Record<string, unknown>;
  targetingData: Record<string, unknown>;
  executionStartedAt: Date | null;
  completedAt: Date | null;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createPipeline(
  workspaceId: string,
  input: CreatePipelineInput,
) {
  const [pipeline] = await db
    .insert(launchPipelinesTable)
    .values({
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      config: (input.config ?? {}) as any,
      status: "draft",
    })
    .returning();
  return pipeline;
}

export async function listPipelines(workspaceId: string) {
  const pipelines = await db
    .select()
    .from(launchPipelinesTable)
    .where(eq(launchPipelinesTable.workspaceId, workspaceId))
    .orderBy(asc(launchPipelinesTable.createdAt));

  const enriched = await Promise.all(
    pipelines.map(async (p) => {
      const campaigns = await db
        .select({
          id: campaignsTable.id,
          status: campaignsTable.status,
          pipelinePosition: campaignsTable.pipelinePosition,
        })
        .from(campaignsTable)
        .where(
          and(
            eq(campaignsTable.workspaceId, workspaceId),
            eq(campaignsTable.pipelineId, p.id),
          ),
        )
        .orderBy(asc(campaignsTable.pipelinePosition));

      const completed = campaigns.filter((c) => c.status === "completed").length;
      const active = campaigns.filter((c) =>
        ["executing", "live"].includes(c.status),
      ).length;
      const capture = campaigns.filter((c) => c.status === "approved" && (c.pipelinePosition ?? 0) > p.currentPosition).length;

      return { ...p, campaignCount: campaigns.length, completed, active, capture };
    }),
  );

  return enriched;
}

export async function getFullPipeline(pipelineId: string, workspaceId: string) {
  const [pipeline] = await db
    .select()
    .from(launchPipelinesTable)
    .where(
      and(
        eq(launchPipelinesTable.id, pipelineId),
        eq(launchPipelinesTable.workspaceId, workspaceId),
      ),
    );

  if (!pipeline) throw new NotFoundError("Pipeline not found");

  const campaigns = await db
    .select({
      id: campaignsTable.id,
      title: campaignsTable.title,
      status: campaignsTable.status,
      pipelinePosition: campaignsTable.pipelinePosition,
      durationDays: campaignsTable.durationDays,
      budgetTotal: campaignsTable.budgetTotal,
      revenueTarget: campaignsTable.revenueTarget,
      brainData: campaignsTable.brainData,
      targetingData: campaignsTable.targetingData,
      executionStartedAt: campaignsTable.executionStartedAt,
      completedAt: campaignsTable.completedAt,
    })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.workspaceId, workspaceId),
        eq(campaignsTable.pipelineId, pipelineId),
      ),
    )
    .orderBy(asc(campaignsTable.pipelinePosition));

  const completed = campaigns.filter((c) => c.status === "completed").length;
  const active = campaigns.filter((c) =>
    ["executing", "live"].includes(c.status),
  );
  const nextCapture = campaigns.find(
    (c) => (c.pipelinePosition ?? 0) === pipeline.currentPosition + 1,
  );

  return { pipeline, campaigns, completed, active, nextCapture };
}

export async function updatePipeline(
  pipelineId: string,
  workspaceId: string,
  patch: { name?: string; description?: string; status?: string },
) {
  const [pipeline] = await db
    .select({ id: launchPipelinesTable.id })
    .from(launchPipelinesTable)
    .where(
      and(
        eq(launchPipelinesTable.id, pipelineId),
        eq(launchPipelinesTable.workspaceId, workspaceId),
      ),
    );
  if (!pipeline) throw new NotFoundError("Pipeline not found");

  const [updated] = await db
    .update(launchPipelinesTable)
    .set(patch)
    .where(eq(launchPipelinesTable.id, pipelineId))
    .returning();
  return updated;
}

// ─── Pipeline Trigger — called when Campaign N reaches `executing` ──────────────

export async function triggerPipelineCapture(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<void> {
  const [campaign] = await db
    .select({
      pipelineId: campaignsTable.pipelineId,
      pipelinePosition: campaignsTable.pipelinePosition,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));

  if (!campaign?.pipelineId || campaign.pipelinePosition === null) return;

  const nextPosition = (campaign.pipelinePosition ?? 0) + 1;

  const [nextCampaign] = await db
    .select({
      id: campaignsTable.id,
      title: campaignsTable.title,
      status: campaignsTable.status,
      pipelinePosition: campaignsTable.pipelinePosition,
    })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.pipelineId, campaign.pipelineId),
        eq(campaignsTable.pipelinePosition, nextPosition),
      ),
    );

  if (!nextCampaign) {
    log.info({ campaignId, pipelineId: campaign.pipelineId }, "Pipeline: last campaign executing — no next to activate");
    return;
  }

  if (!["strategy_ready", "approved"].includes(nextCampaign.status)) {
    log.info({ nextCampaignId: nextCampaign.id, status: nextCampaign.status }, "Pipeline: next campaign already past capture trigger point");
    return;
  }

  await db
    .update(campaignsTable)
    .set({ status: "approved" as any })
    .where(eq(campaignsTable.id, nextCampaign.id));

  await db
    .update(launchPipelinesTable)
    .set({ capturePosition: nextPosition })
    .where(eq(launchPipelinesTable.id, campaign.pipelineId));

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId: nextCampaign.id,
    action: "pipeline.capture_triggered",
    actor: "system",
    data: {
      pipelineId: campaign.pipelineId,
      triggeredByCampaignId: campaignId,
      position: nextPosition,
      region: (nextCampaign as any).title,
    },
  });

  emitCampaignEvent({
    campaignId: nextCampaign.id,
    type: "phase_changed",
    message: `Pipeline avançou — campanha ${nextPosition + 1} (${nextCampaign.title}) entrou em fase de captura`,
    data: { pipelinePosition: nextPosition, pipelineId: campaign.pipelineId },
    timestamp: new Date().toISOString(),
  });

  log.info(
    { triggeredBy: campaignId, nextCampaignId: nextCampaign.id, position: nextPosition },
    "Pipeline: capture phase triggered for next campaign",
  );
}

// ─── Pipeline Advance — called when Campaign N reaches `live` or `completed` ──

export async function advancePipeline(
  pipelineId: string,
  workspaceId: string,
  log: Logger,
): Promise<void> {
  const [pipeline] = await db
    .select()
    .from(launchPipelinesTable)
    .where(
      and(
        eq(launchPipelinesTable.id, pipelineId),
        eq(launchPipelinesTable.workspaceId, workspaceId),
      ),
    );
  if (!pipeline) throw new NotFoundError("Pipeline not found");

  const nextPos = pipeline.currentPosition + 1;

  const [nextCampaign] = await db
    .select({ id: campaignsTable.id, title: campaignsTable.title, status: campaignsTable.status })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.pipelineId, pipelineId),
        eq(campaignsTable.pipelinePosition, nextPos),
      ),
    );

  if (!nextCampaign) {
    await db
      .update(launchPipelinesTable)
      .set({ status: "completed" })
      .where(eq(launchPipelinesTable.id, pipelineId));
    log.info({ pipelineId }, "Pipeline completed — no more campaigns");
    return;
  }

  await db
    .update(launchPipelinesTable)
    .set({ currentPosition: nextPos })
    .where(eq(launchPipelinesTable.id, pipelineId));

  log.info({ pipelineId, nextPos, nextCampaignId: nextCampaign.id }, "Pipeline advanced to next position");
}

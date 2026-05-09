import { eq, desc, and } from "drizzle-orm";
import {
  db,
  campaignsTable,
  workspacesTable,
  plansTable,
  approvalCheckpointsTable,
  campaignAgentsTable,
  auditLogsTable,
  type Campaign,
  type InsertCampaign,
} from "@workspace/db";
import { NotFoundError, ForbiddenError, ValidationError } from "../../lib/errors.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import type { Logger } from "pino";

export const DIGIT_TRACK_LABELS = {
  six_digits: "6 Digits (R$100k–R$999k in 7 days)",
  eight_digits: "8 Digits (R$10M–R$99M in 7 days)",
  ten_digits: "10 Digits (R$100M+ in 7 days)",
} as const;

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  intake: ["analyzing", "cancelled"],
  analyzing: ["strategy_ready", "intake", "cancelled"],
  strategy_ready: ["generating", "cancelled"],
  generating: ["awaiting_approval", "cancelled"],
  awaiting_approval: ["approved", "generating", "cancelled"],
  approved: ["executing", "cancelled"],
  executing: ["live", "paused", "cancelled"],
  live: ["paused", "completed", "cancelled"],
  paused: ["live", "cancelled"],
  completed: [],
  cancelled: [],
};

export async function createCampaign(
  workspaceId: string,
  data: Partial<InsertCampaign> & { title: string },
  log: Logger,
): Promise<Campaign> {
  const [ws] = await db
    .select({ planId: workspacesTable.planId, activeCampaigns: workspacesTable.activeCampaigns })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!ws) throw new NotFoundError("Workspace");

  const [plan] = await db
    .select({ maxCampaigns: plansTable.maxCampaigns })
    .from(plansTable)
    .where(eq(plansTable.id, ws.planId))
    .limit(1);

  if (plan && ws.activeCampaigns >= plan.maxCampaigns) {
    throw new ForbiddenError(
      `Campaign limit reached (${plan.maxCampaigns}). Upgrade your plan or complete existing campaigns.`,
    );
  }

  const [campaign] = await db
    .insert(campaignsTable)
    .values({
      workspaceId,
      title: data.title,
      type: data.type ?? "launch",
      track: data.track ?? "six_digits",
      status: "intake",
      intakeData: data.intakeData ?? {},
      locale: data.locale ?? "pt-BR",
    })
    .returning();

  await db
    .update(workspacesTable)
    .set({ activeCampaigns: ws.activeCampaigns + 1 })
    .where(eq(workspacesTable.id, workspaceId));

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId: campaign.id,
    action: "campaign.created",
    actor: "user",
    data: { title: campaign.title, type: campaign.type, track: campaign.track },
  });

  log.info({ campaignId: campaign.id, workspaceId }, "Campaign created");
  return campaign;
}

export async function getCampaign(
  campaignId: string,
  workspaceId: string,
): Promise<Campaign> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");
  return campaign;
}

export async function listCampaigns(workspaceId: string): Promise<Campaign[]> {
  return db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.workspaceId, workspaceId))
    .orderBy(desc(campaignsTable.createdAt));
}

export async function updateCampaignStatus(
  campaignId: string,
  workspaceId: string,
  newStatus: string,
  log: Logger,
  data?: Record<string, unknown>,
): Promise<Campaign> {
  const campaign = await getCampaign(campaignId, workspaceId);
  const allowed = VALID_STATUS_TRANSITIONS[campaign.status] ?? [];

  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Cannot transition from '${campaign.status}' to '${newStatus}'`,
    );
  }

  const updateData: Partial<typeof campaignsTable.$inferInsert> = {
    status: newStatus as any,
  };

  if (newStatus === "executing") {
    updateData.executionStartedAt = new Date();
  }
  if (newStatus === "completed") {
    updateData.completedAt = new Date();
  }
  if (data?.strategy) {
    updateData.strategyData = data.strategy as any;
  }
  if (data?.timeline) {
    updateData.timelineData = data.timeline as any;
  }

  const [updated] = await db
    .update(campaignsTable)
    .set(updateData)
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: `campaign.status.${newStatus}`,
    actor: "system",
    data: { previous: campaign.status, next: newStatus },
  });

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: `Campaign status: ${newStatus}`,
    data: { status: newStatus, ...data },
    timestamp: new Date().toISOString(),
  });

  log.info({ campaignId, from: campaign.status, to: newStatus }, "Campaign status updated");
  return updated;
}

export async function updateIntakeData(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<Campaign> {
  await getCampaign(campaignId, workspaceId);

  const [updated] = await db
    .update(campaignsTable)
    .set({ intakeData })
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  log.info({ campaignId }, "Campaign intake data updated");
  return updated;
}

export async function getCampaignWithAgents(
  campaignId: string,
  workspaceId: string,
) {
  const campaign = await getCampaign(campaignId, workspaceId);
  const agents = await db
    .select()
    .from(campaignAgentsTable)
    .where(eq(campaignAgentsTable.campaignId, campaignId))
    .orderBy(campaignAgentsTable.createdAt);

  const checkpoints = await db
    .select()
    .from(approvalCheckpointsTable)
    .where(eq(approvalCheckpointsTable.campaignId, campaignId))
    .orderBy(desc(approvalCheckpointsTable.createdAt));

  return { campaign, agents, checkpoints };
}

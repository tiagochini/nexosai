import { eq, desc, and, sql, gte, count } from "drizzle-orm";
import {
  db,
  campaignsTable,
  workspacesTable,
  plansTable,
  approvalCheckpointsTable,
  campaignAgentsTable,
  auditLogsTable,
  launchSequencesTable,
  launchSequenceItemsTable,
  sequenceContactsTable,
  revenueEventsTable,
  sequenceEngagementTable,
  contentPiecesTable,
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

// ── Pipeline Kernel: State Machine ────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all campaign status transitions.
// All workers, services, routes, and agents must validate against this table.
// Level 3 enforcement: transitionCampaign() will throw (not warn) on violation.
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  intake: ["analyzing", "cancelled"],
  // "awaiting_approval" and "generating" added: command.agent can end in either
  // state after running all agents (checkpointsPending > 0 → awaiting_approval,
  // else → generating). Both are valid exits from the analyzing phase.
  analyzing: ["strategy_ready", "intake", "awaiting_approval", "generating", "cancelled"],
  // "approved" added: pipeline auto-progression sets next campaign to "approved"
  // when previous campaign enters executing (triggerPipelineCapture).
  strategy_ready: ["generating", "analyzing", "approved", "cancelled"],
  generating: ["awaiting_approval", "strategy_ready", "cancelled"],
  awaiting_approval: ["approved", "generating", "analyzing", "cancelled"],
  approved: ["executing", "cancelled"],
  executing: ["live", "paused", "cancelled"],
  // "generating" added: allows client to re-generate content while live (e.g. refresh copy mid-launch)
  live: ["paused", "completed", "cancelled", "generating"],
  // RC-006 FIX: "executing" added — orchestration worker transitions paused
  // campaigns through paused → executing → live (processExecute).
  paused: ["executing", "live", "cancelled"],
  completed: [],
  cancelled: [],
};

// ── Pipeline Kernel: Phase Entry Constants ─────────────────────────────────────
// Derived phase-entry lists — replaces the 9 scattered inline allowedStatuses
// arrays across workers, services, and agents. Import from here, never redeclare.
export const STRATEGY_PHASE_ENTRY_STATUSES = ["intake", "analyzing", "strategy_ready"] as const;
// "live" added: allows re-generation of content while campaign is already live
export const CONTENT_PHASE_ENTRY_STATUSES = ["strategy_ready", "awaiting_approval", "approved", "live"] as const;
export const LAUNCH_PHASE_ENTRY_STATUSES = ["approved", "paused"] as const;
export const CREATIVE_INTENT_PHASE_ENTRY_STATUSES = [
  "strategy_ready",
  "generating",
  "awaiting_approval",
  "approved",
] as const;

// ── Pipeline Kernel: transitionCampaign() ─────────────────────────────────────
// Internal engine transition function. Use this everywhere instead of direct
// db.update(campaignsTable).set({ status }) calls.
//
// Difference from updateCampaignStatus():
//   updateCampaignStatus() — HTTP API layer, strict (throws), has side-effects
//     (sequence auto-activation, workspace counter, pipeline triggers)
//   transitionCampaign()   — Internal engine layer, observability mode (warns but
//     does NOT throw on invalid — Level 3 will flip to throw), accepts arbitrary
//     extra fields, no side-effects beyond the DB write + audit log.
//
// Level 3 hardening: change log.warn → throw new ValidationError
export async function transitionCampaign(
  campaignId: string,
  workspaceId: string,
  toStatus: string,
  reason: string,
  log: Logger,
  extra?: Record<string, unknown>,
): Promise<void> {
  const [campaign] = await db
    .select({ status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) {
    log.warn({ campaignId, toStatus, reason }, "PIPELINE_KERNEL: campaign not found — transition skipped");
    return;
  }

  const allowed = VALID_STATUS_TRANSITIONS[campaign.status] ?? [];
  if (!allowed.includes(toStatus)) {
    // Level 2: warn mode. Level 3 will change this to: throw new ValidationError(...)
    log.warn(
      { campaignId, from: campaign.status, to: toStatus, reason },
      `PIPELINE_KERNEL: undeclared transition ${campaign.status} → ${toStatus} — executing (enforcement deferred to Level 3)`,
    );
  } else {
    log.info(
      { campaignId, from: campaign.status, to: toStatus, reason },
      `PIPELINE_KERNEL: ${campaign.status} → ${toStatus}`,
    );
  }

  await db
    .update(campaignsTable)
    .set({ status: toStatus as any, updatedAt: new Date(), ...(extra ?? {}) } as any)
    .where(eq(campaignsTable.id, campaignId));

  // Non-blocking audit — never delay the pipeline for a log write
  db.insert(auditLogsTable)
    .values({
      workspaceId,
      campaignId,
      action: "campaign.status.transition",
      actor: "system",
      data: { from: campaign.status, to: toStatus, reason, ts: new Date().toISOString() },
    })
    .catch((err) => log.warn({ err, campaignId }, "PIPELINE_KERNEL: failed to write audit log"));
}

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

  // ── Auto-activate linked draft/scheduled sequences when campaign executes ──
  if (newStatus === "executing") {
    setImmediate(() =>
      autoActivateLinkedSequences(campaignId, log).catch((err) =>
        log.warn({ err, campaignId }, "Failed to auto-activate linked sequences"),
      ),
    );
    // ── Pipeline: trigger next campaign capture phase ──────────────────────────
    setImmediate(() =>
      import("../pipeline/pipeline.service.js")
        .then(({ triggerPipelineCapture }) =>
          triggerPipelineCapture(campaignId, workspaceId, log),
        )
        .catch((err) =>
          log.warn({ err, campaignId }, "Failed to trigger pipeline capture"),
        ),
    );
  }

  // Decrement workspace active campaign counter when terminal status reached
  const terminalStatuses = ["completed", "cancelled"];
  const wasAlreadyTerminal = terminalStatuses.includes(campaign.status);
  if (terminalStatuses.includes(newStatus) && !wasAlreadyTerminal) {
    await db
      .update(workspacesTable)
      .set({ activeCampaigns: sql`GREATEST(0, active_campaigns - 1)` })
      .where(eq(workspacesTable.id, workspaceId));
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

export async function mergeIntakeDirectives(
  campaignId: string,
  workspaceId: string,
  directives: Record<string, string>,
  log: Logger,
): Promise<Campaign> {
  const campaign = await getCampaign(campaignId, workspaceId);
  const merged = { ...(campaign.intakeData as Record<string, unknown> ?? {}), user_directives: directives };
  const [updated] = await db
    .update(campaignsTable)
    .set({ intakeData: merged, updatedAt: new Date() })
    .where(eq(campaignsTable.id, campaignId))
    .returning();
  log.info({ campaignId, directiveKeys: Object.keys(directives) }, "Campaign intake directives merged");
  return updated;
}

export async function reorientCampaign(
  campaignId: string,
  workspaceId: string,
  directive: string,
  log: Logger,
): Promise<Campaign> {
  const campaign = await getCampaign(campaignId, workspaceId);

  const reorientableStatuses = ["strategy_ready", "generating", "awaiting_approval"];
  if (!reorientableStatuses.includes(campaign.status)) {
    throw new ValidationError(
      `Não é possível reorientar uma campanha com status '${campaign.status}'. ` +
      `Reorientação disponível apenas quando a campanha está em: ${reorientableStatuses.join(", ")}.`,
    );
  }

  const existing = (campaign.intakeData as Record<string, unknown>) ?? {};
  const prevReorientations = (existing["reorientations"] as Array<{ directive: string; timestamp: string; fromStatus: string }> | undefined) ?? [];
  const merged = {
    ...existing,
    reorientations: [
      ...prevReorientations,
      { directive, timestamp: new Date().toISOString(), fromStatus: campaign.status },
    ],
    latest_reorientation: directive,
  };

  await db.delete(contentPiecesTable).where(eq(contentPiecesTable.campaignId, campaignId));

  const [updated] = await db
    .update(campaignsTable)
    .set({
      intakeData: merged,
      strategyData: null as any,
      timelineData: null as any,
      status: "analyzing" as any,
      updatedAt: new Date(),
    })
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.reorient",
    actor: "user",
    data: { from: campaign.status, directivePreview: directive.slice(0, 300) },
  });

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: "Campanha reorientada — reconstruindo estratégia do zero com nova direção",
    data: { status: "analyzing" },
    timestamp: new Date().toISOString(),
  });

  log.info({ campaignId, from: campaign.status }, "Campaign reoriented — rebuilding strategy");
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

// ─── Auto-activate linked sequences when campaign starts executing ─────────────

async function autoActivateLinkedSequences(campaignId: string, log: Logger): Promise<void> {
  const linkedSequences = await db
    .select({
      id: launchSequencesTable.id,
      workspaceId: launchSequencesTable.workspaceId,
      status: launchSequencesTable.status,
      itemCount: sql<number>`(
        SELECT COUNT(*) FROM launch_sequence_items
        WHERE launch_sequence_items.sequence_id = ${launchSequencesTable.id}
      )`,
    })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.campaignId, campaignId),
        sql`${launchSequencesTable.status} IN ('draft', 'scheduled')`,
      ),
    );

  if (linkedSequences.length === 0) return;

  const now = new Date();

  for (const seq of linkedSequences) {
    if (Number(seq.itemCount) === 0) {
      log.info({ sequenceId: seq.id }, "Skipping auto-activate: sequence has no items");
      continue;
    }

    // Schedule all pending items starting from now
    const items = await db
      .select({ id: launchSequenceItemsTable.id, dayIndex: launchSequenceItemsTable.dayIndex })
      .from(launchSequenceItemsTable)
      .where(eq(launchSequenceItemsTable.sequenceId, seq.id));

    for (const item of items) {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + item.dayIndex);
      await db
        .update(launchSequenceItemsTable)
        .set({ status: "scheduled", scheduledAt })
        .where(eq(launchSequenceItemsTable.id, item.id));
    }

    await db
      .update(launchSequencesTable)
      .set({
        status: "active",
        config: sql`jsonb_set(COALESCE(config, '{}'), '{autoActivatedAt}', ${JSON.stringify(now.toISOString())}::jsonb)`,
      })
      .where(eq(launchSequencesTable.id, seq.id));

    log.info({ campaignId, sequenceId: seq.id }, "Linked sequence auto-activated");
  }
}

// ── Live Stats (scarcity / urgency data) ──────────────────────────────────────

export interface CampaignLiveStats {
  campaignId: string;
  totalLeads: number;
  leadsLast24h: number;
  leadsLastHour: number;
  totalSales: number;
  revenueBrlLast24h: number;
  totalRevenueBrl: number;
  engagementEventsLast24h: number;
  activeSequences: number;
  updatedAt: string;
}

export async function getCampaignLiveStats(
  campaignId: string,
  workspaceId: string,
): Promise<CampaignLiveStats> {
  const campaign = await getCampaign(campaignId, workspaceId);
  if (!campaign) throw new NotFoundError("Campaign");

  const now = new Date();
  const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const h1ago = new Date(now.getTime() - 60 * 60 * 1000);

  // Linked sequence IDs
  const sequences = await db
    .select({ id: launchSequencesTable.id, status: launchSequencesTable.status })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.campaignId, campaignId),
        eq(launchSequencesTable.workspaceId, workspaceId),
      ),
    );

  const sequenceIds = sequences.map((s) => s.id);
  const activeSequences = sequences.filter((s) => s.status === "active").length;

  // Lead counts from sequence contacts
  let totalLeads = 0;
  let leadsLast24h = 0;
  let leadsLastHour = 0;
  let engagementEventsLast24h = 0;

  if (sequenceIds.length > 0) {
    const contacts = await db
      .select({ createdAt: sequenceContactsTable.createdAt })
      .from(sequenceContactsTable)
      .where(sql`${sequenceContactsTable.sequenceId} = ANY(${sql.raw(`ARRAY[${sequenceIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`)
      ;

    totalLeads = contacts.length;
    leadsLast24h = contacts.filter((c) => c.createdAt >= h24ago).length;
    leadsLastHour = contacts.filter((c) => c.createdAt >= h1ago).length;

    const engRows = await db
      .select({ cnt: count() })
      .from(sequenceEngagementTable)
      .where(
        and(
          sql`${sequenceEngagementTable.sequenceId} = ANY(${sql.raw(`ARRAY[${sequenceIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
          gte(sequenceEngagementTable.createdAt, h24ago),
        ),
      );
    engagementEventsLast24h = Number(engRows[0]?.cnt ?? 0);
  }

  // Revenue from revenue events
  const revenueRows = await db
    .select({
      grossAmountCents: revenueEventsTable.grossAmountCents,
      eventType: revenueEventsTable.eventType,
      createdAt: revenueEventsTable.createdAt,
    })
    .from(revenueEventsTable)
    .where(
      and(
        eq(revenueEventsTable.campaignId, campaignId),
        eq(revenueEventsTable.status, "confirmed"),
      ),
    );

  const sales = revenueRows.filter((r) => r.eventType === "sale");
  const totalSales = sales.length;
  const totalRevenueBrl = sales.reduce((sum, r) => sum + r.grossAmountCents / 100, 0);
  const revenueBrlLast24h = sales
    .filter((r) => r.createdAt >= h24ago)
    .reduce((sum, r) => sum + r.grossAmountCents / 100, 0);

  return {
    campaignId,
    totalLeads,
    leadsLast24h,
    leadsLastHour,
    totalSales,
    revenueBrlLast24h,
    totalRevenueBrl,
    engagementEventsLast24h,
    activeSequences,
    updatedAt: now.toISOString(),
  };
}

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
import {
  simulateBudget,
  type CampaignModelType,
  type ProductCategory,
  type BudgetSimulation,
} from "../intake/intake.simulation.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../../lib/errors.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import type { Logger } from "pino";
import {
  VALID_STATUS_TRANSITIONS,
  DIGIT_TRACK_LABELS,
  STRATEGY_PHASE_ENTRY_STATUSES,
  CONTENT_PHASE_ENTRY_STATUSES,
  LAUNCH_PHASE_ENTRY_STATUSES,
  CREATIVE_INTENT_PHASE_ENTRY_STATUSES,
  isValidTransition,
  isRegressionTransition,
} from "./campaign-state-machine.js";

// ── Re-exports for backward compatibility ─────────────────────────────────────
// All consumers that import from campaigns.service keep working unchanged.
// Source of truth is campaign-state-machine.ts — edit only there.
export {
  VALID_STATUS_TRANSITIONS,
  DIGIT_TRACK_LABELS,
  STRATEGY_PHASE_ENTRY_STATUSES,
  CONTENT_PHASE_ENTRY_STATUSES,
  LAUNCH_PHASE_ENTRY_STATUSES,
  CREATIVE_INTENT_PHASE_ENTRY_STATUSES,
} from "./campaign-state-machine.js";

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

  // Idempotent self-transition: pipeline steps may re-confirm a status the campaign
  // already reached (e.g. inline sub-approvals already moved it to strategy_ready,
  // then the final orchestration step re-asserts strategy_ready). This is not a real
  // state change, so it must not be validated against VALID_STATUS_TRANSITIONS edges —
  // treat as a no-op (skip DB write, keep audit trail) rather than throwing.
  if (campaign.status === toStatus) {
    log.info(
      { campaignId, status: toStatus, reason },
      `PIPELINE_KERNEL: ${toStatus} → ${toStatus} (no-op, already in target state)`,
    );
    return;
  }

  // ── Regression detector ─────────────────────────────────────────────────────
  // Fires when the requested target is earlier in the canonical pipeline order
  // than the current status. Some backward transitions are intentional (re-gen:
  // approved → generating), so this does NOT block — it logs WARN and persists a
  // diagnostic audit event so regressions are always visible in the audit trail.
  // Callers that want to actively block a regression must do so BEFORE calling
  // transitionCampaign (see the command.agent.ts strategy-pipeline finalStatus guard).
  if (isRegressionTransition(campaign.status, toStatus)) {
    log.warn(
      { campaignId, from: campaign.status, to: toStatus, reason },
      `PIPELINE_KERNEL: regression transition detected — "${campaign.status}" → "${toStatus}" moves backward in pipeline order`,
    );
    db.insert(auditLogsTable)
      .values({
        workspaceId,
        campaignId,
        action: "campaign.status.regression_detected",
        actor:  "system",
        data:   { from: campaign.status, to: toStatus, reason, ts: new Date().toISOString() },
      })
      .catch((err) => log.warn({ err, campaignId }, "PIPELINE_KERNEL: failed to write regression_detected audit log"));
    // Fall through — isValidTransition below will still gate the transition.
  }

  // Level 3 enforcement: ACTIVE — invalid transitions throw, never silently execute.
  if (!isValidTransition(campaign.status, toStatus)) {
    throw new ValidationError(
      `PIPELINE_KERNEL: undeclared transition ${campaign.status} → ${toStatus} (reason: ${reason}). ` +
      `Edit campaign-state-machine.ts to add this edge if intentional.`,
    );
  }

  log.info(
    { campaignId, from: campaign.status, to: toStatus, reason },
    `PIPELINE_KERNEL: ${campaign.status} → ${toStatus}`,
  );

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

// Founder/admin accounts have unlimited campaigns — no plan cap applied.
const FOUNDER_EMAILS = new Set([
  "founder@nexos.ai",
  "founder@agencianexos.vip",
  "admin@nexos.ai",
  "admin@agencianexos.vip",
]);

export async function createCampaign(
  workspaceId: string,
  data: Partial<InsertCampaign> & { title: string },
  log: Logger,
  ownerEmail?: string,
): Promise<Campaign> {
  const [ws] = await db
    .select({ planId: workspacesTable.planId, activeCampaigns: workspacesTable.activeCampaigns })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!ws) throw new NotFoundError("Workspace");

  const isFounder = ownerEmail ? FOUNDER_EMAILS.has(ownerEmail) : false;

  if (!isFounder) {
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

  if (!isValidTransition(campaign.status, newStatus)) {
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

// ── Launch Financials ─────────────────────────────────────────────────────────

export interface LaunchFinancials {
  hasBudget: boolean;
  totalBudget: number;
  paidTrafficBudget: number;
  prospectingBudget: number;
  retargetingBudget: number;
  retargetingPct: number;
  productPrice: number;
  campaignType: string;
  productCategory: string;
  simulation: BudgetSimulation | null;
  organicLeads: { low: number; mid: number; high: number };
  totalLeads: { low: number; mid: number; high: number };
  revenueTarget: number | null;
}

function extractNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    if (isFinite(n)) return n;
  }
  return null;
}

function extractStr(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

const VALID_CAMPAIGN_TYPES: CampaignModelType[] = [
  "launch", "perpetual_launch", "flash_sale", "live_sale",
  "continuous_sales", "authority", "audience_growth", "subscription_growth", "affiliate",
];
const VALID_CATEGORIES: ProductCategory[] = [
  "infoproduct", "mentorship", "software", "service", "ecommerce", "community", "event",
];

export async function getLaunchFinancials(campaignId: string, workspaceId: string): Promise<LaunchFinancials> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campanha não encontrada");

  const intake = (campaign.intakeData ?? {}) as Record<string, unknown>;

  // Extract revenue target (DB column or intake)
  const revenueTarget =
    extractNum(intake["campaign.revenueTarget"] ?? intake["revenueTarget"] ?? intake["revenue_target"]);

  // Extract total budget (DB column → intake → derive from revenue target)
  const totalBudget =
    campaign.budgetTotal ??
    extractNum(
      intake["campaign.budget.total"] ?? intake["budgetTotal"] ?? intake["budget"],
    ) ??
    (revenueTarget ? Math.round(revenueTarget * 0.15) : 0); // 15% of revenue target as default

  // Traffic/paid portion: intake key or 70% of total
  const paidTrafficBudget =
    extractNum(intake["campaign.budget.traffic"] ?? intake["budgetTraffic"] ?? intake["trafficBudget"]) ??
    Math.round(totalBudget * 0.7);

  // Product price
  const productPrice =
    extractNum(
      intake["product.price"] ?? intake["productPrice"] ?? intake["price"] ??
      intake["ticket"] ?? intake["ticketMedio"],
    ) ?? 997;

  // Campaign type — map DB type to simulation type
  const rawType = (campaign.type ?? "launch") as string;
  const campaignType: CampaignModelType = VALID_CAMPAIGN_TYPES.includes(rawType as CampaignModelType)
    ? (rawType as CampaignModelType)
    : "launch";

  // Product category — from intake or default
  const rawCategory =
    extractStr(intake["product.category"] ?? intake["productCategory"] ?? intake["category"]);
  const productCategory: ProductCategory = VALID_CATEGORIES.includes(rawCategory as ProductCategory)
    ? (rawCategory as ProductCategory)
    : "infoproduct";

  if (paidTrafficBudget <= 0) {
    return {
      hasBudget: false,
      totalBudget: 0,
      paidTrafficBudget: 0,
      prospectingBudget: 0,
      retargetingBudget: 0,
      retargetingPct: 25,
      productPrice,
      campaignType,
      productCategory,
      simulation: null,
      organicLeads: { low: 0, mid: 0, high: 0 },
      totalLeads: { low: 0, mid: 0, high: 0 },
      revenueTarget,
    };
  }

  // Standard retargeting split: 25% of paid budget
  const retargetingPct = 25;
  const retargetingBudget = Math.round(paidTrafficBudget * 0.25);
  const prospectingBudget = paidTrafficBudget - retargetingBudget;

  // Run prospecting simulation (75% of paid budget generates new leads)
  const simulation = simulateBudget(prospectingBudget, productPrice, campaignType, productCategory);

  // Organic leads: 30% bonus for PLF launches, 20% for others
  const isPlf = ["launch", "perpetual_launch"].includes(campaignType);
  const organicMultiplier = isPlf ? 0.30 : 0.20;
  const organicLeads = {
    low: Math.round(simulation.totalLeads.low * organicMultiplier),
    mid: Math.round(simulation.totalLeads.mid * organicMultiplier),
    high: Math.round(simulation.totalLeads.high * organicMultiplier),
  };

  const totalLeads = {
    low: simulation.totalLeads.low + organicLeads.low,
    mid: simulation.totalLeads.mid + organicLeads.mid,
    high: simulation.totalLeads.high + organicLeads.high,
  };

  return {
    hasBudget: true,
    totalBudget,
    paidTrafficBudget,
    prospectingBudget,
    retargetingBudget,
    retargetingPct,
    productPrice,
    campaignType,
    productCategory,
    simulation,
    organicLeads,
    totalLeads,
    revenueTarget,
  };
}

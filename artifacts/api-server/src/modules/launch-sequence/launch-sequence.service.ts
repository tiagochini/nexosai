import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db,
  launchSequencesTable,
  launchSequenceItemsTable,
  campaignsTable,
  sequenceContactsTable,
} from "@workspace/db";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { runLaunchSequenceBuilderAgent } from "../agents/launch-sequence-builder.agent.js";
import type { StrategyOutput } from "../agents/strategy.agent.js";
import type { ProfileBuilderOutput } from "../agents/profile-builder.agent.js";
import { runItemCopyAgent } from "../agents/item-copy.agent.js";
import { deductCredits } from "../credits/credits.service.js";
import { getSequenceAnalytics, recordEngagementEvent } from "./sequence-analytics.service.js";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateSequenceInput {
  campaignId?: string;
  name: string;
  model: "plf" | "formula_de_lancamento" | "semente" | "afiliado" | "perpetual" | "custom";
  totalDays?: number;
  launchStartDate?: string;
  cartOpenDate?: string;
  cartCloseDate?: string;
  revenueTarget?: string;
  productName?: string;
  productPrice?: string;
}

export interface ActivateSequenceInput {
  emailListId?: string;
  emailProvider?: "rd_station" | "activecampaign" | "resend";
  emailFromName?: string;
  emailFromEmail?: string;
  phoneNumbers?: string[];
  startAt?: string;
}

export interface ContactInput {
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// ─── Model-aware duration defaults ────────────────────────────────────────────

const MODEL_DEFAULT_DAYS: Record<string, number> = {
  plf: 25,
  formula_de_lancamento: 25,
  semente: 14,
  afiliado: 14,
  perpetual: 90,
  custom: 21,
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createLaunchSequence(
  workspaceId: string,
  input: CreateSequenceInput,
) {
  if (input.campaignId) {
    const [campaign] = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, input.campaignId),
          eq(campaignsTable.workspaceId, workspaceId),
        ),
      );
    if (!campaign) throw new NotFoundError("Campaign not found");
  }

  const [sequence] = await db
    .insert(launchSequencesTable)
    .values({
      workspaceId,
      campaignId: input.campaignId ?? null,
      name: input.name,
      model: input.model,
      totalDays: input.totalDays ?? MODEL_DEFAULT_DAYS[input.model] ?? 21,
      launchStartDate: input.launchStartDate ?? null,
      cartOpenDate: input.cartOpenDate ?? null,
      cartCloseDate: input.cartCloseDate ?? null,
      revenueTarget: input.revenueTarget ?? null,
      productName: input.productName ?? null,
      productPrice: input.productPrice ?? null,
    })
    .returning();

  return sequence!;
}

export async function getLaunchSequences(workspaceId: string) {
  return db
    .select()
    .from(launchSequencesTable)
    .where(eq(launchSequencesTable.workspaceId, workspaceId))
    .orderBy(desc(launchSequencesTable.createdAt));
}

export async function getLaunchSequence(workspaceId: string, sequenceId: string) {
  const [sequence] = await db
    .select()
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.id, sequenceId),
        eq(launchSequencesTable.workspaceId, workspaceId),
      ),
    );
  if (!sequence) throw new NotFoundError("Launch sequence not found");

  const items = await db
    .select()
    .from(launchSequenceItemsTable)
    .where(eq(launchSequenceItemsTable.sequenceId, sequenceId))
    .orderBy(launchSequenceItemsTable.dayIndex);

  return { ...sequence, items };
}

export async function updateLaunchSequence(
  workspaceId: string,
  sequenceId: string,
  patch: Partial<CreateSequenceInput & { status: string; leadCaptureEnabled: boolean; campaignId: string | null }>,
) {
  const [existing] = await db
    .select({ id: launchSequencesTable.id })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.id, sequenceId),
        eq(launchSequencesTable.workspaceId, workspaceId),
      ),
    );
  if (!existing) throw new NotFoundError("Launch sequence not found");

  const [updated] = await db
    .update(launchSequencesTable)
    .set({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.model !== undefined && { model: patch.model }),
      ...(patch.totalDays !== undefined && { totalDays: patch.totalDays }),
      ...(patch.launchStartDate !== undefined && { launchStartDate: patch.launchStartDate }),
      ...(patch.cartOpenDate !== undefined && { cartOpenDate: patch.cartOpenDate }),
      ...(patch.cartCloseDate !== undefined && { cartCloseDate: patch.cartCloseDate }),
      ...(patch.revenueTarget !== undefined && { revenueTarget: patch.revenueTarget }),
      ...(patch.productName !== undefined && { productName: patch.productName }),
      ...(patch.productPrice !== undefined && { productPrice: patch.productPrice }),
      ...(patch.leadCaptureEnabled !== undefined && { leadCaptureEnabled: patch.leadCaptureEnabled }),
      ...("campaignId" in patch && { campaignId: patch.campaignId ?? null }),
      ...(patch.status !== undefined && {
        status: patch.status as
          | "draft"
          | "scheduled"
          | "active"
          | "paused"
          | "completed"
          | "cancelled",
      }),
    })
    .where(eq(launchSequencesTable.id, sequenceId))
    .returning();

  return updated!;
}

export async function deleteLaunchSequence(workspaceId: string, sequenceId: string) {
  const [existing] = await db
    .select({ id: launchSequencesTable.id })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.id, sequenceId),
        eq(launchSequencesTable.workspaceId, workspaceId),
      ),
    );
  if (!existing) throw new NotFoundError("Launch sequence not found");

  await db.delete(launchSequencesTable).where(eq(launchSequencesTable.id, sequenceId));
}

// ─── Generating Flag ───────────────────────────────────────────────────────────

export async function setSequenceGeneratingFlag(
  workspaceId: string,
  sequenceId: string,
  generating: boolean,
) {
  const [row] = await db
    .select({ config: launchSequencesTable.config })
    .from(launchSequencesTable)
    .where(and(eq(launchSequencesTable.id, sequenceId), eq(launchSequencesTable.workspaceId, workspaceId)))
    .limit(1);
  if (!row) return;
  const cfg = (row.config ?? {}) as Record<string, unknown>;
  if (generating) {
    cfg["generatingPlan"] = true;
    cfg["generatingStartedAt"] = new Date().toISOString();
  } else {
    delete cfg["generatingPlan"];
    delete cfg["generatingStartedAt"];
  }
  await db
    .update(launchSequencesTable)
    .set({ config: cfg })
    .where(eq(launchSequencesTable.id, sequenceId));
}

// ─── AI Plan Generation ────────────────────────────────────────────────────────

export async function generateSequencePlan(
  workspaceId: string,
  sequenceId: string,
  log: Logger,
) {
  const sequence = await getLaunchSequence(workspaceId, sequenceId);

  if (!["draft", "scheduled"].includes(sequence.status)) {
    throw new ValidationError("Only draft or scheduled sequences can be regenerated");
  }

  let intakeData: Record<string, unknown> = {};
  let strategy: StrategyOutput | undefined;
  let profile: ProfileBuilderOutput | undefined;

  if (sequence.campaignId) {
    const [campaign] = await db
      .select({
        intakeData: campaignsTable.intakeData,
        strategyData: campaignsTable.strategyData,
        audienceData: campaignsTable.audienceData,
      })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, sequence.campaignId), eq(campaignsTable.workspaceId, workspaceId)));
    if (campaign) {
      intakeData = campaign.intakeData as Record<string, unknown>;
      if (campaign.strategyData) strategy = campaign.strategyData as unknown as StrategyOutput;
      if (campaign.audienceData && (campaign.audienceData as any)["primaryAvatar"]) {
        profile = campaign.audienceData as unknown as ProfileBuilderOutput;
      }
    }
  }

  const plan = await runLaunchSequenceBuilderAgent(
    workspaceId,
    {
      campaignId: sequence.campaignId,
      model: sequence.model,
      totalDays: sequence.totalDays,
      productName: sequence.productName ?? String(intakeData["product.name"] ?? ""),
      productPrice: sequence.productPrice ?? String(intakeData["product.price"] ?? ""),
      revenueTarget:
        sequence.revenueTarget ?? String(intakeData["campaign.revenueTarget"] ?? ""),
      launchStartDate: sequence.launchStartDate ?? undefined,
      cartOpenDate: sequence.cartOpenDate ?? undefined,
      cartCloseDate: sequence.cartCloseDate ?? undefined,
      intakeData,
      strategy,
      profile,
    },
    log,
  );

  await db
    .delete(launchSequenceItemsTable)
    .where(eq(launchSequenceItemsTable.sequenceId, sequenceId));

  if (plan.items.length > 0) {
    log.info({ count: plan.items.length, sequenceId }, "Inserting sequence items");
    try {
      const inserted = await db.insert(launchSequenceItemsTable).values(
        plan.items.map((item) => ({
          sequenceId,
          workspaceId,
          phase: item.phase as
            | "pre_capture"
            | "capture"
            | "plc1"
            | "plc2"
            | "plc3"
            | "cart_open"
            | "cart_middle"
            | "cart_close"
            | "post_purchase"
            | "post_launch"
            | "evergreen",
          name: item.name ?? "Untitled",
          description: item.description ?? null,
          dayIndex: typeof item.dayIndex === "number" ? item.dayIndex : 0,
          mentalTrigger: item.mentalTrigger ?? null,
          deliveryChannels: Array.isArray(item.deliveryChannels) ? item.deliveryChannels : ["email"],
          contentType: item.contentType ?? null,
          objective: item.objective ?? null,
          copyHints: item.copyHints ?? null,
        })),
      ).returning({ id: launchSequenceItemsTable.id });
      log.info({ inserted: inserted.length, sequenceId }, "Sequence items inserted successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isFk = msg.includes("foreign key constraint") || msg.includes("violates");
      if (isFk) {
        log.warn(
          { sequenceId, itemCount: plan.items.length },
          "Sequence items insert aborted — sequence was deleted before background AI completed (non-fatal)",
        );
        return null;
      }
      log.error({ err, sequenceId, itemCount: plan.items.length }, "Failed to insert sequence items");
      throw err;
    }
  }

  // Clear generatingPlan flag from config before saving final result
  const [existingRow] = await db
    .select({ config: launchSequencesTable.config })
    .from(launchSequencesTable)
    .where(eq(launchSequencesTable.id, sequenceId))
    .limit(1);
  const finalCfg = (existingRow?.config ?? {}) as Record<string, unknown>;
  delete finalCfg["generatingPlan"];
  delete finalCfg["generatingStartedAt"];

  await db
    .update(launchSequencesTable)
    .set({
      aiGeneratedPlan: plan as unknown as Record<string, unknown>,
      status: "scheduled",
      config: finalCfg,
    })
    .where(eq(launchSequencesTable.id, sequenceId));

  return getLaunchSequence(workspaceId, sequenceId);
}

// ─── Activation ────────────────────────────────────────────────────────────────

export async function activateSequence(
  workspaceId: string,
  sequenceId: string,
  input: ActivateSequenceInput,
) {
  const sequence = await getLaunchSequence(workspaceId, sequenceId);

  if (!["draft", "scheduled"].includes(sequence.status)) {
    throw new ValidationError("Sequência já está ativa, pausada ou concluída");
  }

  if (sequence.items.length === 0) {
    throw new ValidationError("Gere o plano da sequência antes de ativar");
  }

  const startAt = input.startAt ? new Date(input.startAt) : new Date();

  const config: Record<string, unknown> = {
    ...((sequence.config as Record<string, unknown>) ?? {}),
    activatedAt: startAt.toISOString(),
    ...(input.emailListId !== undefined && { emailListId: input.emailListId }),
    ...(input.emailProvider !== undefined && { emailProvider: input.emailProvider }),
    ...(input.emailFromName !== undefined && { emailFromName: input.emailFromName }),
    ...(input.emailFromEmail !== undefined && { emailFromEmail: input.emailFromEmail }),
    ...(input.phoneNumbers !== undefined && { phoneNumbers: input.phoneNumbers }),
  };

  for (const item of sequence.items) {
    const scheduledAt = new Date(startAt);
    scheduledAt.setDate(scheduledAt.getDate() + item.dayIndex);

    await db
      .update(launchSequenceItemsTable)
      .set({ status: "scheduled", scheduledAt })
      .where(eq(launchSequenceItemsTable.id, item.id));
  }

  await db
    .update(launchSequencesTable)
    .set({ status: "active", config })
    .where(eq(launchSequencesTable.id, sequenceId));

  // Schedule social media posts for every content piece linked to this campaign
  if (sequence.campaignId) {
    setImmediate(async () => {
      try {
        const { createScheduledSocialPosts } = await import("../social/social.autopost.service.js");
        await createScheduledSocialPosts(workspaceId, sequence.campaignId!, sequenceId, startAt);
      } catch (schedErr) {
        logger.warn({ schedErr, sequenceId }, "activateSequence: createScheduledSocialPosts failed (non-fatal)");
      }
    });
  }

  return getLaunchSequence(workspaceId, sequenceId);
}

export async function pauseSequence(workspaceId: string, sequenceId: string) {
  const [existing] = await db
    .select({ status: launchSequencesTable.status })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.id, sequenceId),
        eq(launchSequencesTable.workspaceId, workspaceId),
      ),
    );
  if (!existing) throw new NotFoundError("Launch sequence not found");
  if (existing.status !== "active")
    throw new ValidationError("Só sequências ativas podem ser pausadas");

  await db
    .update(launchSequencesTable)
    .set({ status: "paused" })
    .where(eq(launchSequencesTable.id, sequenceId));

  await db
    .update(launchSequenceItemsTable)
    .set({ status: "pending" })
    .where(
      and(
        eq(launchSequenceItemsTable.sequenceId, sequenceId),
        inArray(launchSequenceItemsTable.status, ["scheduled"]),
      ),
    );

  return getLaunchSequence(workspaceId, sequenceId);
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function updateSequenceItem(
  workspaceId: string,
  sequenceId: string,
  itemId: string,
  patch: {
    status?: string;
    scheduledAt?: string;
    contentPieceId?: string;
    copyHints?: string;
    deliveryChannels?: string[];
  },
) {
  const [existing] = await db
    .select({ id: launchSequenceItemsTable.id })
    .from(launchSequenceItemsTable)
    .where(
      and(
        eq(launchSequenceItemsTable.id, itemId),
        eq(launchSequenceItemsTable.sequenceId, sequenceId),
        eq(launchSequenceItemsTable.workspaceId, workspaceId),
      ),
    );
  if (!existing) throw new NotFoundError("Sequence item not found");

  const [updated] = await db
    .update(launchSequenceItemsTable)
    .set({
      ...(patch.status !== undefined && {
        status: patch.status as
          | "pending"
          | "content_generating"
          | "content_ready"
          | "scheduled"
          | "dispatched"
          | "skipped",
      }),
      ...(patch.scheduledAt !== undefined && { scheduledAt: new Date(patch.scheduledAt) }),
      ...(patch.contentPieceId !== undefined && { contentPieceId: patch.contentPieceId }),
      ...(patch.copyHints !== undefined && { copyHints: patch.copyHints }),
      ...(patch.deliveryChannels !== undefined && { deliveryChannels: patch.deliveryChannels }),
    })
    .where(eq(launchSequenceItemsTable.id, itemId))
    .returning();

  return updated!;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function addSequenceContacts(
  workspaceId: string,
  sequenceId: string,
  contacts: ContactInput[],
) {
  const [existing] = await db
    .select({ id: launchSequencesTable.id })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.id, sequenceId),
        eq(launchSequencesTable.workspaceId, workspaceId),
      ),
    );
  if (!existing) throw new NotFoundError("Launch sequence not found");
  if (contacts.length === 0) throw new ValidationError("Informe ao menos 1 contato");

  const inserted = await db
    .insert(sequenceContactsTable)
    .values(
      contacts.map((c) => ({
        sequenceId,
        workspaceId,
        name: c.name ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        tags: c.tags ?? [],
        metadata: c.metadata ?? {},
      })),
    )
    .returning();

  return inserted;
}

export async function getSequenceContacts(workspaceId: string, sequenceId: string) {
  const [existing] = await db
    .select({ id: launchSequencesTable.id })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.id, sequenceId),
        eq(launchSequencesTable.workspaceId, workspaceId),
      ),
    );
  if (!existing) throw new NotFoundError("Launch sequence not found");

  return db
    .select()
    .from(sequenceContactsTable)
    .where(eq(sequenceContactsTable.sequenceId, sequenceId))
    .orderBy(desc(sequenceContactsTable.engagementScore));
}

// ─── Analytics & Engagement ───────────────────────────────────────────────────

export { getSequenceAnalytics };

export async function recordSequenceEngagement(
  workspaceId: string,
  sequenceId: string,
  params: {
    itemId?: string;
    contactId?: string;
    event: "delivered" | "open" | "click" | "convert" | "reply" | "unsubscribe" | "bounced";
    channel?: string;
    externalRef?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const [existing] = await db
    .select({ id: launchSequencesTable.id })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.id, sequenceId),
        eq(launchSequencesTable.workspaceId, workspaceId),
      ),
    );
  if (!existing) throw new NotFoundError("Launch sequence not found");

  await recordEngagementEvent({ sequenceId, workspaceId, ...params });
}

// ─── Per-item copy generation ─────────────────────────────────────────────────

export async function generateItemCopy(
  workspaceId: string,
  sequenceId: string,
  itemId: string,
  contactSegment: "hot" | "warm" | "cold" | undefined,
  log: Logger,
) {
  const sequence = await getLaunchSequence(workspaceId, sequenceId);

  const item = sequence.items.find((i) => i.id === itemId);
  if (!item) throw new NotFoundError("Sequence item not found");

  // [C3-STANDALONE] idempotency: one charge per sequence item — prevents double-charge on double-click
  await deductCredits(workspaceId, "nurturing_message", log, undefined, undefined, undefined, undefined, `ws:${workspaceId}:seq:item_copy:${itemId}`);

  // ── Fetch strategy + profile from parent campaign when available ──────────
  let campaignStrategy: StrategyOutput | undefined;
  let campaignProfile: ProfileBuilderOutput | undefined;
  if (sequence.campaignId) {
    const [campaign] = await db
      .select({ strategyData: campaignsTable.strategyData, audienceData: campaignsTable.audienceData })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, sequence.campaignId), eq(campaignsTable.workspaceId, workspaceId)))
      .limit(1);
    if (campaign) {
      const sd = campaign.strategyData as Record<string, unknown> | null;
      if (sd && sd["triggerMap"]) campaignStrategy = sd as unknown as StrategyOutput;
      const ad = campaign.audienceData as Record<string, unknown> | null;
      if (ad && ad["primaryAvatar"]) campaignProfile = ad as unknown as ProfileBuilderOutput;
    }
  }

  const copy = await runItemCopyAgent(
    workspaceId,
    {
      itemId: item.id,
      phase: item.phase,
      name: item.name,
      description: item.description ?? null,
      contentType: item.contentType ?? null,
      mentalTrigger: item.mentalTrigger ?? null,
      copyHints: item.copyHints ?? null,
      dayIndex: item.dayIndex,
      deliveryChannels: (item.deliveryChannels as string[]) ?? [],
      productName: sequence.productName ?? "Produto",
      productPrice: sequence.productPrice ?? "0",
      revenueTarget: sequence.revenueTarget ?? "0",
      launchModel: sequence.model,
      contactSegment,
    },
    log,
    sequence.campaignId ?? null,
    campaignStrategy,
    campaignProfile,
  );

  // Store the generated copy in the item's metadata
  const existingMeta = (item.metadata as Record<string, unknown>) ?? {};
  const segKey = contactSegment ?? "all";
  const copyQualityScore = (copy as any)._qualityScore as number | undefined;
  const existingQualityScores = (existingMeta["qualityScores"] as Record<string, number> | undefined) ?? {};
  await db
    .update(launchSequenceItemsTable)
    .set({
      metadata: {
        ...existingMeta,
        generatedCopy: {
          ...(existingMeta["generatedCopy"] as Record<string, unknown> ?? {}),
          [segKey]: copy,
        },
        ...(copyQualityScore !== undefined ? { qualityScores: { ...existingQualityScores, [segKey]: copyQualityScore } } : {}),
      },
      status: item.status === "pending" ? "content_ready" : item.status,
    })
    .where(eq(launchSequenceItemsTable.id, itemId));

  return copy;
}

// ─── Launch calendar (day-by-day view) ────────────────────────────────────────

export interface CalendarDay {
  dayIndex: number;
  date: string | null;
  phase: string;
  phaseLabel: string;
  items: {
    id: string;
    name: string;
    contentType: string | null;
    channels: string[];
    mentalTrigger: string | null;
    status: string;
    scheduledAt: string | null;
    hasCopy: boolean;
  }[];
}

const PHASE_LABELS: Record<string, string> = {
  pre_capture: "Pré-Captura",
  capture: "Captura",
  plc1: "PLC 1 — A Oportunidade",
  plc2: "PLC 2 — A Transformação",
  plc3: "PLC 3 — A Experiência",
  cart_open: "Abertura do Carrinho",
  cart_middle: "Meio do Carrinho",
  cart_close: "Fechamento do Carrinho",
  post_purchase: "Pós-Compra",
  post_launch: "Pós-Lançamento",
  evergreen: "Evergreen",
};

export async function getLaunchCalendar(workspaceId: string, sequenceId: string) {
  const sequence = await getLaunchSequence(workspaceId, sequenceId);
  const cfg = (sequence.config as Record<string, unknown>) ?? {};
  const activatedAt = cfg["activatedAt"] ? new Date(cfg["activatedAt"] as string) : null;

  // Group items by dayIndex
  const byDay = new Map<number, typeof sequence.items>();
  for (const item of sequence.items) {
    const day = item.dayIndex;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(item);
  }

  const days: CalendarDay[] = [];
  const sortedDays = [...byDay.keys()].sort((a, b) => a - b);

  for (const dayIndex of sortedDays) {
    const items = byDay.get(dayIndex)!;
    const primaryPhase = items[0]?.phase ?? "evergreen";

    let date: string | null = null;
    if (activatedAt) {
      const d = new Date(activatedAt);
      d.setDate(d.getDate() + dayIndex);
      // Use BRT timezone for calendar dates — toISOString() is UTC and drifts 1 day between 21h-00h BRT
      date = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    }

    days.push({
      dayIndex,
      date,
      phase: primaryPhase,
      phaseLabel: PHASE_LABELS[primaryPhase] ?? primaryPhase,
      items: items.map((i) => {
        const meta = (i.metadata as Record<string, unknown>) ?? {};
        return {
          id: i.id,
          name: i.name,
          contentType: i.contentType ?? null,
          channels: (i.deliveryChannels as string[]) ?? [],
          mentalTrigger: i.mentalTrigger ?? null,
          status: i.status,
          scheduledAt: i.scheduledAt ? new Date(i.scheduledAt).toISOString() : null,
          hasCopy: !!meta["generatedCopy"],
        };
      }),
    });
  }

  const generatedPlan = sequence.aiGeneratedPlan as Record<string, unknown>;
  const phases = (generatedPlan?.phases ?? []) as Array<{
    phase: string;
    label: string;
    startDay: number;
    endDay: number;
    objective: string;
    primaryTrigger: string;
  }>;
  const milestones = (generatedPlan?.keyMilestones ?? []) as Array<{
    day: number;
    event: string;
    importance: string;
  }>;

  return {
    sequenceId,
    sequenceName: sequence.name,
    model: sequence.model,
    totalDays: sequence.totalDays,
    status: sequence.status,
    activatedAt: activatedAt?.toISOString() ?? null,
    cartOpenDate: sequence.cartOpenDate ?? null,
    cartCloseDate: sequence.cartCloseDate ?? null,
    phases,
    milestones,
    calendar: days,
    summary: {
      totalItems: sequence.items.length,
      dispatched: sequence.items.filter((i) => i.status === "dispatched").length,
      scheduled: sequence.items.filter((i) => i.status === "scheduled").length,
      pending: sequence.items.filter((i) => i.status === "pending").length,
      withCopy: sequence.items.filter((i) => {
        const meta = (i.metadata as Record<string, unknown>) ?? {};
        return !!meta["generatedCopy"];
      }).length,
    },
  };
}

// ─── Today's launch status (current phase + what fires today) ─────────────────

export async function getLaunchToday(workspaceId: string, sequenceId: string) {
  const sequence = await getLaunchSequence(workspaceId, sequenceId);
  const cfg = (sequence.config as Record<string, unknown>) ?? {};
  const activatedAt = cfg["activatedAt"] ? new Date(cfg["activatedAt"] as string) : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentDayIndex: number | null = null;
  if (activatedAt) {
    const activated = new Date(activatedAt);
    activated.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - activated.getTime();
    currentDayIndex = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // Determine which items fire today, yesterday (for context), and tomorrow
  const todayItems = currentDayIndex !== null
    ? sequence.items.filter((i) => i.dayIndex === currentDayIndex)
    : [];
  const tomorrowItems = currentDayIndex !== null
    ? sequence.items.filter((i) => i.dayIndex === currentDayIndex + 1)
    : [];
  const upcomingItems = currentDayIndex !== null
    ? sequence.items.filter((i) => i.dayIndex > (currentDayIndex ?? 0) && i.dayIndex <= (currentDayIndex ?? 0) + 7)
    : [];

  const currentPhase = todayItems[0]?.phase ?? null;

  // Phase progress (0-100%)
  const allDays = [...new Set(sequence.items.map((i) => i.dayIndex))].sort((a, b) => a - b);
  const totalUniqueDays = allDays.length;
  const daysElapsed = currentDayIndex !== null
    ? allDays.filter((d) => d <= currentDayIndex).length
    : 0;
  const progress = totalUniqueDays > 0 ? Math.round((daysElapsed / totalUniqueDays) * 100) : 0;

  // Dispatched so far
  const dispatched = sequence.items.filter((i) => i.status === "dispatched").length;
  const total = sequence.items.length;

  // Get analytics for quick stats
  const analytics = await getSequenceAnalytics(workspaceId, sequenceId);

  return {
    sequenceId,
    sequenceName: sequence.name,
    model: sequence.model,
    status: sequence.status,
    activatedAt: activatedAt?.toISOString() ?? null,
    currentDayIndex,
    currentPhase,
    currentPhaseLabel: currentPhase ? (PHASE_LABELS[currentPhase] ?? currentPhase) : null,
    progress,
    today: {
      dayIndex: currentDayIndex,
      date: today.toISOString().slice(0, 10),
      items: todayItems.map((i) => ({
        id: i.id,
        name: i.name,
        phase: i.phase,
        channels: (i.deliveryChannels as string[]) ?? [],
        status: i.status,
        mentalTrigger: i.mentalTrigger,
        scheduledAt: i.scheduledAt ? new Date(i.scheduledAt).toISOString() : null,
      })),
    },
    tomorrow: {
      dayIndex: currentDayIndex !== null ? currentDayIndex + 1 : null,
      items: tomorrowItems.map((i) => ({
        id: i.id,
        name: i.name,
        phase: i.phase,
        channels: (i.deliveryChannels as string[]) ?? [],
        mentalTrigger: i.mentalTrigger,
      })),
    },
    nextSevenDays: upcomingItems.slice(0, 10).map((i) => ({
      dayIndex: i.dayIndex,
      name: i.name,
      phase: i.phase,
      channels: (i.deliveryChannels as string[]) ?? [],
    })),
    performance: {
      dispatched,
      total,
      pctComplete: total > 0 ? Math.round((dispatched / total) * 100) : 0,
      totalContacts: analytics.totalContacts,
      hot: analytics.segments.hot,
      warm: analytics.segments.warm,
      cold: analytics.segments.cold,
      converted: analytics.segments.converted,
      healthScore: analytics.healthScore,
      engagementTrend: analytics.engagementTrend,
    },
    warnings: buildLaunchWarnings(sequence, currentDayIndex, analytics),
  };
}

function buildLaunchWarnings(
  sequence: { items: Array<{ status: string; dayIndex: number; metadata: unknown }> },
  currentDayIndex: number | null,
  analytics: { healthScore: number; totalContacts: number; segments: { hot: number } },
): string[] {
  const warnings: string[] = [];

  if (analytics.totalContacts === 0) {
    warnings.push("Nenhum contato na sequência. Adicione leads antes de prosseguir.");
  }

  if (analytics.healthScore < 30 && analytics.totalContacts > 0) {
    warnings.push(`Health score baixo (${analytics.healthScore}/100). Considere revisar o conteúdo ou reforçar com WhatsApp.`);
  }

  if (currentDayIndex !== null && currentDayIndex >= 0) {
    const dueItems = sequence.items.filter(
      (i) => i.dayIndex <= currentDayIndex && i.status === "scheduled",
    );
    if (dueItems.length > 0) {
      warnings.push(`${dueItems.length} item(s) agendado(s) que ainda não foram disparados. Verifique as integrações.`);
    }
  }

  const withoutCopy = sequence.items.filter((i) => {
    const meta = (i.metadata as Record<string, unknown>) ?? {};
    return !meta["generatedCopy"] && i.status !== "dispatched";
  }).length;
  if (withoutCopy > 5) {
    warnings.push(`${withoutCopy} itens sem copy gerada. Use "Gerar Copy" para cada item antes de ativar.`);
  }

  if (analytics.segments.hot === 0 && analytics.totalContacts > 10) {
    warnings.push("Nenhum lead quente ainda. Verifique se os eventos de engajamento estão chegando corretamente.");
  }

  return warnings;
}

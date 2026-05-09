import { eq, and, desc } from "drizzle-orm";
import {
  db,
  launchSequencesTable,
  launchSequenceItemsTable,
  campaignsTable,
} from "@workspace/db";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { runLaunchSequenceBuilderAgent } from "../agents/launch-sequence-builder.agent.js";
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

// ─── Service ──────────────────────────────────────────────────────────────────

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
      totalDays: input.totalDays ?? 21,
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
  patch: Partial<CreateSequenceInput & { status: string }>,
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
      ...(patch.status !== undefined && { status: patch.status as "draft" | "scheduled" | "active" | "paused" | "completed" | "cancelled" }),
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

  await db
    .delete(launchSequencesTable)
    .where(eq(launchSequencesTable.id, sequenceId));
}

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
  if (sequence.campaignId) {
    const [campaign] = await db
      .select({ intakeData: campaignsTable.intakeData })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, sequence.campaignId));
    if (campaign) intakeData = campaign.intakeData as Record<string, unknown>;
  }

  const plan = await runLaunchSequenceBuilderAgent(
    workspaceId,
    {
      model: sequence.model,
      totalDays: sequence.totalDays,
      productName: sequence.productName ?? String(intakeData["product.name"] ?? ""),
      productPrice: sequence.productPrice ?? String(intakeData["product.price"] ?? ""),
      revenueTarget: sequence.revenueTarget ?? String(intakeData["campaign.revenueTarget"] ?? ""),
      launchStartDate: sequence.launchStartDate ?? undefined,
      cartOpenDate: sequence.cartOpenDate ?? undefined,
      cartCloseDate: sequence.cartCloseDate ?? undefined,
      intakeData,
    },
    log,
  );

  await db
    .delete(launchSequenceItemsTable)
    .where(eq(launchSequenceItemsTable.sequenceId, sequenceId));

  if (plan.items.length > 0) {
    await db.insert(launchSequenceItemsTable).values(
      plan.items.map((item) => ({
        sequenceId,
        workspaceId,
        phase: item.phase as "pre_capture" | "capture" | "plc1" | "plc2" | "plc3" | "cart_open" | "cart_middle" | "cart_close" | "post_purchase" | "post_launch" | "evergreen",
        name: item.name,
        description: item.description,
        dayIndex: item.dayIndex,
        mentalTrigger: item.mentalTrigger,
        deliveryChannels: item.deliveryChannels,
        contentType: item.contentType,
        objective: item.objective,
        copyHints: item.copyHints,
      })),
    );
  }

  await db
    .update(launchSequencesTable)
    .set({ aiGeneratedPlan: plan as unknown as Record<string, unknown>, status: "scheduled" })
    .where(eq(launchSequencesTable.id, sequenceId));

  return getLaunchSequence(workspaceId, sequenceId);
}

export async function updateSequenceItem(
  workspaceId: string,
  sequenceId: string,
  itemId: string,
  patch: { status?: string; scheduledAt?: string; contentPieceId?: string; copyHints?: string },
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
      ...(patch.status !== undefined && { status: patch.status as "pending" | "content_generating" | "content_ready" | "scheduled" | "dispatched" | "skipped" }),
      ...(patch.scheduledAt !== undefined && { scheduledAt: new Date(patch.scheduledAt) }),
      ...(patch.contentPieceId !== undefined && { contentPieceId: patch.contentPieceId }),
      ...(patch.copyHints !== undefined && { copyHints: patch.copyHints }),
    })
    .where(eq(launchSequenceItemsTable.id, itemId))
    .returning();

  return updated!;
}

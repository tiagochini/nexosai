import { and, eq, lte, or, isNull, inArray, notExists, sql } from "drizzle-orm";
import {
  db, firstTouchAttemptsTable, launchSequenceItemsTable, launchSequencesTable,
  sequenceContactsTable, sequenceEngagementTable, masterplanVersionsTable,
} from "@workspace/db";
import { randomUUID } from "node:crypto";
import { getApprovedMasterplan } from "../masterplan/masterplan.service.js";
import { phaseEligibilitySql } from "./first-touch-policy.js";

export type FirstTouchAdapter = (input: {
  workspaceId: string; contactId: string; segment: string; journeyStage: string; phase: string;
  channel: string; recipient: string; selectedCopy: Record<string, unknown>; body: Record<string, unknown>; idempotencyKey: string;
}) => Promise<{ confirmed: boolean; ambiguous?: boolean; receipt?: Record<string, unknown>; error?: string }>;

export type FirstTouchResult = "confirmed" | "retryable" | "ambiguous" | "suppressed" | "none";

export function firstTouchAttemptKey(input: {
  sequenceId: string; contactId: string; itemId: string; channel: string; version: string;
}): string {
  return `${input.sequenceId}:${input.contactId}:${input.itemId}:${input.channel}:${input.version}`;
}

export function canClaimFirstTouch(input: {
  state: string; leaseExpiresAt: Date | null; nextAttemptAt: Date | null; now: Date;
}): boolean {
  if (input.state === "confirmed" || input.state === "ambiguous" || input.state === "terminal") return false;
  if (input.nextAttemptAt && input.nextAttemptAt > input.now) return false;
  return input.state === "retryable" || (input.state === "executing" && !!input.leaseExpiresAt && input.leaseExpiresAt <= input.now);
}

export function classifyAdapterFailure(error: unknown): "ambiguous" {
  void error;
  return "ambiguous";
}

const LEASE_MS = 60_000;
const MAX_RETRIES = 5;
let schedulerAdapter: FirstTouchAdapter | null = null;

export function setFirstTouchAdapter(adapter: FirstTouchAdapter | null): void {
  schedulerAdapter = adapter;
}
export function getFirstTouchAdapter(): FirstTouchAdapter | null {
  return schedulerAdapter;
}

/** Claims and executes exactly one first-touch recipient. Adapters are
 * injected deliberately so scheduler tests never reach provider boundaries. */
export async function executeFirstTouch(
  workspaceId: string,
  adapter: FirstTouchAdapter,
  now = new Date(),
  owner = randomUUID(),
): Promise<FirstTouchResult> {
  const [candidate] = await db.select({
    item: launchSequenceItemsTable, sequence: launchSequencesTable, contact: sequenceContactsTable,
  }).from(launchSequenceItemsTable)
    .innerJoin(launchSequencesTable, and(
      eq(launchSequenceItemsTable.sequenceId, launchSequencesTable.id),
      eq(launchSequenceItemsTable.workspaceId, launchSequencesTable.workspaceId),
    ))
    .innerJoin(sequenceContactsTable, and(
      eq(sequenceContactsTable.sequenceId, launchSequenceItemsTable.sequenceId),
      eq(sequenceContactsTable.workspaceId, workspaceId),
    ))
    .where(and(
      eq(launchSequenceItemsTable.workspaceId, workspaceId),
      eq(launchSequencesTable.workspaceId, workspaceId),
      eq(launchSequencesTable.status, "active"),
      eq(launchSequenceItemsTable.status, "scheduled"),
      lte(launchSequenceItemsTable.scheduledAt, now),
      sql`${launchSequenceItemsTable.metadata} @> '{"firstTouchExecutable": true}'::jsonb`,
      inArray(sequenceContactsTable.segment, ["cold", "warm", "hot"]),
      phaseEligibilitySql(sequenceContactsTable.segment, sequenceContactsTable.journeyStage, launchSequenceItemsTable.phase),
      or(
        and(sql`${launchSequenceItemsTable.deliveryChannels} @> '["email"]'::jsonb`, sql`nullif(${sequenceContactsTable.email}, '') is not null`),
        and(sql`${launchSequenceItemsTable.deliveryChannels} @> '["whatsapp"]'::jsonb`, sql`nullif(${sequenceContactsTable.phone}, '') is not null`),
      ),
      notExists(db.select({ id: firstTouchAttemptsTable.id }).from(firstTouchAttemptsTable).where(and(
        eq(firstTouchAttemptsTable.workspaceId, workspaceId),
        eq(firstTouchAttemptsTable.sequenceId, launchSequenceItemsTable.sequenceId),
        eq(firstTouchAttemptsTable.contactId, sequenceContactsTable.id),
        eq(firstTouchAttemptsTable.itemId, launchSequenceItemsTable.id),
        or(
          inArray(firstTouchAttemptsTable.state, ["confirmed", "ambiguous", "terminal"]),
          and(eq(firstTouchAttemptsTable.state, "retryable"), sql`${firstTouchAttemptsTable.nextAttemptAt} > ${now}`),
          and(eq(firstTouchAttemptsTable.state, "executing"), or(
            sql`${firstTouchAttemptsTable.leaseExpiresAt} > ${now}`,
            isNull(firstTouchAttemptsTable.leaseExpiresAt),
          )),
        ),
      ))),
    )).orderBy(launchSequenceItemsTable.scheduledAt, sequenceContactsTable.createdAt, sequenceContactsTable.id).limit(1);
  if (!candidate) return "none";
  const { item, sequence, contact } = candidate;
  if (contact.segment === "unsubscribed" || contact.segment === "converted") return "suppressed";

  const channel = ((item.deliveryChannels as string[]) ?? []).find((c) => c === "email" || c === "whatsapp");
  const recipient = channel === "email" ? contact.email : channel === "whatsapp" ? contact.phone : null;
  const cfg = (sequence.config ?? {}) as Record<string, unknown>;
  const version = String((item.metadata as Record<string, unknown> | null)?.masterplanVersionId ?? cfg.masterplanVersionId ?? "unknown");
  const attemptKey = firstTouchAttemptKey({ sequenceId: sequence.id, contactId: contact.id, itemId: item.id, channel: channel ?? "unsupported", version });
  const suppress = async (reason: string): Promise<FirstTouchResult> => {
    if (!channel || !recipient) return "suppressed";
    const [existing] = await db.select({ id: firstTouchAttemptsTable.id, state: firstTouchAttemptsTable.state })
      .from(firstTouchAttemptsTable).where(and(
        eq(firstTouchAttemptsTable.workspaceId, workspaceId),
        eq(firstTouchAttemptsTable.sequenceId, sequence.id),
        eq(firstTouchAttemptsTable.contactId, contact.id),
        eq(firstTouchAttemptsTable.itemId, item.id),
        eq(firstTouchAttemptsTable.channel, channel),
      )).limit(1);
    if (existing) {
      await db.update(firstTouchAttemptsTable).set({
        state: "terminal", error: reason.slice(0, 200), leaseOwner: null, leaseExpiresAt: null,
      }).where(and(
        eq(firstTouchAttemptsTable.id, existing.id),
        eq(firstTouchAttemptsTable.workspaceId, workspaceId),
        inArray(firstTouchAttemptsTable.state, ["retryable", "executing"]),
        or(isNull(firstTouchAttemptsTable.leaseExpiresAt), lte(firstTouchAttemptsTable.leaseExpiresAt, now)),
      ));
      return "suppressed";
    }
    await db.insert(firstTouchAttemptsTable).values({
      workspaceId, sequenceId: sequence.id, contactId: contact.id, itemId: item.id,
      channel, version, attemptKey, state: "terminal", error: reason.slice(0, 200),
    }).onConflictDoNothing();
    return "suppressed";
  };
  if (!channel || !recipient) return suppress("missing_or_unsupported_recipient");
  const approved = await getApprovedMasterplan(workspaceId, sequence.campaignId ?? "");
  const itemMeta = (item.metadata ?? {}) as Record<string, unknown>;
  if (!approved || cfg.masterplanVersionId !== approved.id || cfg.contextFingerprint !== approved.contextFingerprint ||
      itemMeta.masterplanVersionId !== approved.id || itemMeta.contextFingerprint !== approved.contextFingerprint ||
      itemMeta.contentHash !== approved.contentHash) return suppress("stale_masterplan_binding");

  const [attempt] = await db.insert(firstTouchAttemptsTable).values({
    workspaceId, sequenceId: sequence.id, contactId: contact.id, itemId: item.id,
    channel, version, attemptKey, state: "retryable", nextAttemptAt: now,
  }).onConflictDoNothing({ target: [firstTouchAttemptsTable.workspaceId, firstTouchAttemptsTable.attemptKey] }).returning();
  if (!attempt) {
    const [existing] = await db.select().from(firstTouchAttemptsTable)
      .where(and(eq(firstTouchAttemptsTable.workspaceId, workspaceId), eq(firstTouchAttemptsTable.attemptKey, attemptKey)));
    if (!existing || ["confirmed", "ambiguous", "terminal"].includes(existing.state)) return existing?.state === "confirmed" ? "confirmed" : "none";
    if (!canClaimFirstTouch({ state: existing.state, leaseExpiresAt: existing.leaseExpiresAt, nextAttemptAt: existing.nextAttemptAt, now })) return "none";
    const [claimed] = await db.update(firstTouchAttemptsTable).set({ state: "executing", leaseOwner: owner, leaseExpiresAt: new Date(now.getTime() + LEASE_MS) })
      .where(and(eq(firstTouchAttemptsTable.id, existing.id), inArray(firstTouchAttemptsTable.state, ["retryable", "executing"]), or(isNull(firstTouchAttemptsTable.leaseExpiresAt), lte(firstTouchAttemptsTable.leaseExpiresAt, now)))).returning();
    if (!claimed) return "none";
  } else {
    await db.update(firstTouchAttemptsTable).set({ state: "executing", leaseOwner: owner, leaseExpiresAt: new Date(now.getTime() + LEASE_MS) }).where(and(eq(firstTouchAttemptsTable.id, attempt.id), eq(firstTouchAttemptsTable.workspaceId, workspaceId), eq(firstTouchAttemptsTable.state, "retryable")));
  }
  const [claimedRow] = await db.select().from(firstTouchAttemptsTable).where(and(eq(firstTouchAttemptsTable.workspaceId, workspaceId), eq(firstTouchAttemptsTable.attemptKey, attemptKey)));
  if (!claimedRow || claimedRow.leaseOwner !== owner) return "none";
  const metadata = (item.metadata as Record<string, unknown> ?? {});
  const generated = metadata.generatedCopy as Record<string, unknown> | undefined;
  const selectedCopy = generated?.[contact.segment] as Record<string, unknown> | undefined;
  const valid = metadata.copyPolicyVersion === "segment-phase-v1" && !!selectedCopy &&
    (channel === "email" ? !!selectedCopy.subject && !!(selectedCopy.body || selectedCopy.html || selectedCopy.text) : !!(selectedCopy.message || selectedCopy.body || selectedCopy.text));
  if (!valid) {
    await db.update(firstTouchAttemptsTable).set({ state: "terminal", error: "missing or unsafe segment-phase copy", leaseOwner: null, leaseExpiresAt: null })
      .where(and(eq(firstTouchAttemptsTable.id, claimedRow.id), eq(firstTouchAttemptsTable.workspaceId, workspaceId), eq(firstTouchAttemptsTable.state, "executing"), eq(firstTouchAttemptsTable.leaseOwner, owner)));
    return "suppressed";
  }

  let outcome;
  try {
    outcome = await adapter({ workspaceId, contactId: contact.id, segment: contact.segment, journeyStage: contact.journeyStage, selectedCopy,
      phase: item.phase, channel, recipient, body: { ...(item.metadata as Record<string, unknown> ?? {}), sequenceConfig: sequence.config, sequenceItemId: item.id, campaignId: sequence.campaignId }, idempotencyKey: attemptKey });
  } catch (error) {
    outcome = { confirmed: false, ambiguous: classifyAdapterFailure(error), error: error instanceof Error ? error.message : "adapter failure" };
  }
  if (outcome.ambiguous) {
    const [fenced] = await db.update(firstTouchAttemptsTable).set({ state: "ambiguous", error: "provider outcome ambiguous", receipt: outcome.receipt ?? {} }).where(and(eq(firstTouchAttemptsTable.id, claimedRow.id), eq(firstTouchAttemptsTable.workspaceId, workspaceId), eq(firstTouchAttemptsTable.state, "executing"), eq(firstTouchAttemptsTable.leaseOwner, owner))).returning({ id: firstTouchAttemptsTable.id });
    if (!fenced) return "none";
    return "ambiguous";
  }
  if (!outcome.confirmed) {
    const retryCount = claimedRow.retryCount + 1;
    const [fenced] = await db.update(firstTouchAttemptsTable).set({
      state: retryCount >= MAX_RETRIES ? "terminal" : "retryable", retryCount,
      nextAttemptAt: new Date(now.getTime() + Math.min(3_600_000, 2 ** retryCount * 1_000)),
      error: (outcome.error ?? "provider rejected").slice(0, 500), leaseOwner: null, leaseExpiresAt: null,
    }).where(and(eq(firstTouchAttemptsTable.id, claimedRow.id), eq(firstTouchAttemptsTable.workspaceId, workspaceId), eq(firstTouchAttemptsTable.state, "executing"), eq(firstTouchAttemptsTable.leaseOwner, owner))).returning({ id: firstTouchAttemptsTable.id });
    if (!fenced) return "none";
    return retryCount >= MAX_RETRIES ? "suppressed" : "retryable";
  }
  await db.transaction(async (tx) => {
    const [fenced] = await tx.update(firstTouchAttemptsTable).set({ state: "confirmed", receipt: outcome.receipt ?? {}, leaseOwner: null, leaseExpiresAt: null })
      .where(and(eq(firstTouchAttemptsTable.id, claimedRow.id), eq(firstTouchAttemptsTable.workspaceId, workspaceId), eq(firstTouchAttemptsTable.state, "executing"), eq(firstTouchAttemptsTable.leaseOwner, owner))).returning({ id: firstTouchAttemptsTable.id });
    if (!fenced) return;
    await tx.insert(sequenceEngagementTable).values({
      sequenceId: sequence.id, itemId: item.id, contactId: contact.id, workspaceId,
      event: "delivered", channel, externalRef: outcome.receipt?.id ? String(outcome.receipt.id) : null,
      metadata: { firstTouch: true, receipt: outcome.receipt ?? {} },
    }).onConflictDoNothing();
    await tx.update(sequenceContactsTable).set({ itemsReceived: contact.itemsReceived + 1 }).where(and(eq(sequenceContactsTable.id, contact.id), eq(sequenceContactsTable.workspaceId, workspaceId)));
  });
  return "confirmed";
}
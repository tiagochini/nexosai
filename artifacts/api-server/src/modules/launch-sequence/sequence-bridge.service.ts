/**
 * NexOS — Sequence Bridge Service
 *
 * Closes the "last mile" gap between approved content pieces and scheduled
 * dispatch items in the launch sequence system.
 *
 * Called automatically from processExecute() when a campaign transitions to
 * executing. Non-fatal: if bridge fails the campaign still goes live and the
 * scheduler has nothing to dispatch (safe degradation).
 *
 * Flow:
 *  1. Look for an existing launch sequence linked to the campaign
 *  2. If one already exists and is active → idempotent skip
 *  3. Otherwise: create sequence (if needed) → parse approved content pieces
 *     → insert launchSequenceItems → activate (schedule from now + dayIndex)
 *
 * Content piece → sequence item mapping:
 *   email_sequence     → { deliveryChannels: ['email'] }    — one item per email
 *   whatsapp_broadcast → { deliveryChannels: ['whatsapp'] } — one item per message
 *   prelaunch_warming  → { deliveryChannels: ['whatsapp'] } — one item per message
 *   telegram_message   → { deliveryChannels: ['telegram'] } — one item per message
 *   (all other types)  → skipped — they are content assets, not dispatch items
 */

import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db,
  campaignsTable,
  contentPiecesTable,
  launchSequencesTable,
  launchSequenceItemsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import type { Logger } from "pino";
import { env } from "../../lib/env.js";
import { segmentsForPhase } from "./first-touch-policy.js";
import { getApprovedMasterplan } from "../masterplan/masterplan.service.js";

// ── Types ────────────────────────────────────────────────────────────────────

type LaunchPhase =
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
  | "evergreen";

interface ParsedItem {
  phase: LaunchPhase;
  name: string;
  description: string;
  dayIndex: number;
  deliveryChannels: string[];
  contentType: string;
  mentalTrigger: string | null;
  objective: string;
  copyHints: string | null;
  generatedCopy: Record<string, string>;
}

export interface BridgeResult {
  sequenceId: string;
  itemsCreated: number;
  skipped: boolean;
  reason: string;
}

// ── Phase helpers ────────────────────────────────────────────────────────────

const SECTION_TO_PHASE: Record<string, LaunchPhase> = {
  preLaunch:    "plc1",
  plc1:         "plc1",
  plc2:         "plc2",
  plc3:         "plc3",
  capture:      "capture",
  preCapture:   "pre_capture",
  cartOpen:     "cart_open",
  cartMiddle:   "cart_middle",
  cartClose:    "cart_close",
  postPurchase: "post_purchase",
  postLaunch:   "post_launch",
  evergreen:    "evergreen",
};

function sectionToPhase(section: string): LaunchPhase {
  return SECTION_TO_PHASE[section] ?? "plc1";
}

// Within preLaunch, distribute items across plc1/plc2/plc3 by position
function preLaunchPhase(index: number, total: number): LaunchPhase {
  if (total <= 1) return "plc1";
  const third = total / 3;
  if (index < third) return "plc1";
  if (index < 2 * third) return "plc2";
  return "plc3";
}

// ── Content piece parsers ────────────────────────────────────────────────────

function parseEmailSequence(content: Record<string, unknown>): ParsedItem[] {
  const items: ParsedItem[] = [];

  const es = content["emailSequence"] as Record<string, unknown[]> | undefined;
  if (!es || typeof es !== "object") return items;

  const sections: [string, unknown[]][] = [
    ["preLaunch",    Array.isArray(es["preLaunch"])    ? es["preLaunch"]    : []],
    ["plc2",         Array.isArray(es["plc2"])         ? es["plc2"]         : []],
    ["plc3",         Array.isArray(es["plc3"])         ? es["plc3"]         : []],
    ["cartOpen",     Array.isArray(es["cartOpen"])     ? es["cartOpen"]     : []],
    ["cartMiddle",   Array.isArray(es["cartMiddle"])   ? es["cartMiddle"]   : []],
    ["cartClose",    Array.isArray(es["cartClose"])    ? es["cartClose"]    : []],
    ["postPurchase", Array.isArray(es["postPurchase"]) ? es["postPurchase"] : []],
  ];

  const preLaunchItems = sections[0]![1] as unknown[];
  let globalDayOffset = 0;

  for (const [section, emails] of sections) {
    let localIndex = 0;
    for (const email of emails) {
      const e = email as Record<string, unknown>;

      // Day: prefer explicit "day" field, otherwise assign sequentially
      const day = typeof e["day"] === "number" ? e["day"] - 1 : globalDayOffset;
      const subject = String(e["subject"] ?? e["title"] ?? `Email ${globalDayOffset + 1}`);
      const body = String(e["body"] ?? e["content"] ?? e["copy"] ?? "");
      const trigger = typeof e["mentalTrigger"] === "string" ? e["mentalTrigger"] : null;

      const phase = section === "preLaunch"
        ? preLaunchPhase(localIndex, preLaunchItems.length)
        : sectionToPhase(section);

      items.push({
        phase,
        name:             subject,
        description:      body.slice(0, 200),
        dayIndex:         day,
        deliveryChannels: ["email"],
        contentType:      "email",
        mentalTrigger:    trigger,
        objective:        `Email de ${section}: ${subject}`,
        copyHints:        trigger ? `Gatilho: ${trigger}` : null,
        generatedCopy:    {
          subject,
          body,
          previewText: String(e["preview"] ?? e["previewText"] ?? ""),
        },
      });

      localIndex++;
      globalDayOffset++;
    }
  }

  return items;
}

function parseWhatsAppContent(
  content: Record<string, unknown>,
  channel: "whatsapp" | "telegram",
): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Try multiple schema patterns the LLM might return
  const rootKey = channel === "telegram" ? "telegramSequence" : "whatsappSequence";
  const seq = (
    content[rootKey] ??
    content["messages"] ??
    content["sequence"] ??
    content["broadcasts"]
  ) as Record<string, unknown> | unknown[] | undefined;

  if (!seq) {
    // Flat fallback: treat root-level "text" or "message" as single item
    const text = String(content["text"] ?? content["message"] ?? content["body"] ?? "");
    if (text.length > 10) {
      items.push({
        phase:            "plc1",
        name:             `Mensagem ${channel}`,
        description:      text.slice(0, 200),
        dayIndex:         0,
        deliveryChannels: [channel],
        contentType:      channel,
        mentalTrigger:    null,
        objective:        `Mensagem de lançamento via ${channel}`,
        copyHints:        null,
        generatedCopy:    { message: text },
      });
    }
    return items;
  }

  // Flat array of messages
  if (Array.isArray(seq)) {
    seq.forEach((msg, i) => {
      const m = msg as Record<string, unknown>;
      const text = String(m["text"] ?? m["message"] ?? m["body"] ?? m["copy"] ?? "");
      if (!text) return;
      const day = typeof m["day"] === "number" ? m["day"] - 1 : i;
      items.push({
        phase:            "plc1",
        name:             String(m["name"] ?? m["title"] ?? `Mensagem ${i + 1}`),
        description:      text.slice(0, 200),
        dayIndex:         day,
        deliveryChannels: [channel],
        contentType:      channel,
        mentalTrigger:    typeof m["mentalTrigger"] === "string" ? m["mentalTrigger"] : null,
        objective:        String(m["objective"] ?? `Mensagem ${channel} dia ${day}`),
        copyHints:        null,
        generatedCopy:    { message: text },
      });
    });
    return items;
  }

  // Sectioned object: { preLaunch: [...], cartOpen: [...], ... }
  let dayOffset = 0;
  for (const [section, arr] of Object.entries(seq as Record<string, unknown>)) {
    if (!Array.isArray(arr)) continue;
    let localIndex = 0;
    for (const msg of arr) {
      const m = msg as Record<string, unknown>;
      const text = String(m["text"] ?? m["message"] ?? m["body"] ?? m["copy"] ?? "");
      if (!text) continue;
      const day = typeof m["day"] === "number" ? m["day"] - 1 : dayOffset;
      items.push({
        phase:            sectionToPhase(section),
        name:             String(m["name"] ?? m["title"] ?? `Mensagem ${dayOffset + 1}`),
        description:      text.slice(0, 200),
        dayIndex:         day,
        deliveryChannels: [channel],
        contentType:      channel,
        mentalTrigger:    typeof m["mentalTrigger"] === "string" ? m["mentalTrigger"] : null,
        objective:        String(m["objective"] ?? `${section} dia ${day}`),
        copyHints:        null,
        generatedCopy:    { message: text },
      });
      localIndex++;
      dayOffset++;
    }
  }

  return items;
}

// ── Integration config lookup ────────────────────────────────────────────────

async function getDispatchConfig(workspaceId: string): Promise<{
  emailProvider: "rd_station" | "activecampaign" | "resend" | null;
  emailListId: string | null;
  emailFromName: string | null;
  emailFromEmail: string | null;
  phoneNumbers: string[];
}> {
  const integrations = await db
    .select({
      provider: workspaceIntegrationsTable.provider,
      metadata: workspaceIntegrationsTable.metadata,
    })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.status, "connected"),
        inArray(workspaceIntegrationsTable.provider, [
          "rd_station",
          "activecampaign",
          "whatsapp_business",
          "telegram",
        ]),
      ),
    );

  let emailProvider: "rd_station" | "activecampaign" | "resend" | null = null;
  let emailListId: string | null = null;
  let emailFromName: string | null = null;
  let emailFromEmail: string | null = null;
  const phoneNumbers: string[] = [];

  for (const intg of integrations) {
    const meta = (intg.metadata ?? {}) as Record<string, unknown>;
    if (intg.provider === "rd_station" && !emailProvider) {
      emailProvider = "rd_station";
      emailListId = String(meta["listId"] ?? meta["audienceId"] ?? "");
      emailFromName = String(meta["fromName"] ?? "");
      emailFromEmail = String(meta["fromEmail"] ?? "");
    }
    if (intg.provider === "activecampaign" && !emailProvider) {
      emailProvider = "activecampaign";
      emailListId = String(meta["listId"] ?? "");
      emailFromName = String(meta["fromName"] ?? "");
      emailFromEmail = String(meta["fromEmail"] ?? "");
    }
    if (intg.provider === "whatsapp_business") {
      const phones = meta["phoneNumbers"] ?? meta["phones"] ?? meta["contactList"];
      if (Array.isArray(phones)) {
        phoneNumbers.push(...phones.map(String));
      }
    }
  }

  // Resend fallback when no DB email integration but RESEND_API_KEY is set
  if (!emailProvider && env.RESEND_API_KEY) {
    emailProvider = "resend";
    emailFromEmail = env.RESEND_FROM_EMAIL ?? null;
  }

  return { emailProvider, emailListId, emailFromName, emailFromEmail, phoneNumbers };
}

// ── Main bridge function ─────────────────────────────────────────────────────

export async function bridgeCampaignToSequence(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<BridgeResult> {
  log.info({ campaignId }, "[BRIDGE] Starting sequence bridge for campaign");

  // A sequence is an execution artifact of the immutable approved plan.  Do
  // this check before looking at (or creating) any dispatch rows.
  const approvedPlan = await getApprovedMasterplan(workspaceId, campaignId);
  if (!approvedPlan) {
    return { sequenceId: "", itemsCreated: 0, skipped: true, reason: "approved_masterplan_required" };
  }

  // 1. Check for an existing sequence linked to this campaign
  const existingSequences = await db
    .select({
      id:     launchSequencesTable.id,
      status: launchSequencesTable.status,
      config: launchSequencesTable.config,
    })
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.workspaceId, workspaceId),
        eq(launchSequencesTable.campaignId, campaignId),
      ),
    );

  // If already active → nothing to do (idempotent)
  const activeSeq = existingSequences.find((s) => s.status === "active");
  if (activeSeq) {
    const activeConfig = (activeSeq.config ?? {}) as Record<string, unknown>;
    if (
      activeConfig["masterplanVersionId"] !== approvedPlan.id ||
      activeConfig["contextFingerprint"] !== approvedPlan.contextFingerprint
    ) {
      return { sequenceId: activeSeq.id, itemsCreated: 0, skipped: true, reason: "active_sequence_masterplan_stale" };
    }
    log.info({ campaignId, sequenceId: activeSeq.id }, "[BRIDGE] Sequence already active — skipping");
    return { sequenceId: activeSeq.id, itemsCreated: 0, skipped: true, reason: "already_active" };
  }

  // 2. Load campaign metadata for sequence creation
  const [campaign] = await db
    .select({
      intakeData:   campaignsTable.intakeData,
      strategyData: campaignsTable.strategyData,
      title:        campaignsTable.title,
    })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) {
    log.warn({ campaignId }, "[BRIDGE] Campaign not found — aborting bridge");
    return { sequenceId: "", itemsCreated: 0, skipped: true, reason: "campaign_not_found" };
  }

  const intake   = (campaign.intakeData  ?? {}) as Record<string, unknown>;
  const strategy = (campaign.strategyData ?? {}) as Record<string, unknown>;

  // 3. Load approved dispatch content pieces
  const pieces = await db
    .select({ id: contentPiecesTable.id, type: contentPiecesTable.type, content: contentPiecesTable.content })
    .from(contentPiecesTable)
    .where(
      and(
        eq(contentPiecesTable.campaignId, campaignId),
        eq(contentPiecesTable.status, "approved"),
        inArray(contentPiecesTable.type as any, [
          "email_sequence",
          "whatsapp_broadcast",
          "whatsapp_group_message",
          "prelaunch_warming",
          "telegram_message",
        ]),
      ),
    );

  if (pieces.length === 0) {
    log.info({ campaignId }, "[BRIDGE] No dispatch content pieces found — sequence not needed");
    return { sequenceId: "", itemsCreated: 0, skipped: true, reason: "no_dispatch_pieces" };
  }

  // Content generated against a different dossier must never become
  // dispatchable.  Older content without these fields is accepted only when
  // the campaign's approved plan is the current binding; newly bridged rows
  // always carry the binding below.
  for (const piece of pieces) {
    const c = (piece.content ?? {}) as Record<string, unknown>;
    const binding = (c["masterplanBinding"] ?? c["_masterplanBinding"]) as Record<string, unknown> | undefined;
    if (!binding ||
      binding["masterplanVersionId"] !== approvedPlan.id ||
      binding["contextFingerprint"] !== approvedPlan.contextFingerprint ||
      binding["contentHash"] !== approvedPlan.contentHash) {
      return { sequenceId: "", itemsCreated: 0, skipped: true, reason: "content_masterplan_binding_stale" };
    }
  }

  // 4. Create or reuse sequence record
  let sequenceId: string;
  const existingDraft = existingSequences.find((s) => ["draft", "scheduled"].includes(s.status));

  if (existingDraft) {
    sequenceId = existingDraft.id;
    log.info({ campaignId, sequenceId }, "[BRIDGE] Reusing existing draft/scheduled sequence");
  } else {
    // Determine launch model from strategy
    const model = (
      String(strategy["launchModel"] ?? intake["campaign.model"] ?? "plf")
        .toLowerCase()
        .replace(/\s/g, "_")
    );
    const validModels = ["plf", "formula_de_lancamento", "semente", "afiliado", "perpetual", "custom"];
    const safeModel = validModels.includes(model) ? model : "plf";

    let newSeq: { id: string } | undefined;
    try {
      [newSeq] = await db
        .insert(launchSequencesTable)
        .values({
        workspaceId,
        campaignId,
        name:        `Sequência — ${campaign.title ?? campaignId.slice(0, 8)}`,
        model:       safeModel as any,
        totalDays:   Number(strategy["launchDurationDays"] ?? intake["campaign.totalDays"] ?? 21),
        productName: String(intake["product.name"] ?? intake["productName"] ?? ""),
        productPrice: String(intake["product.price"] ?? intake["productPrice"] ?? ""),
        revenueTarget: String(intake["campaign.revenueTarget"] ?? strategy["revenueTarget"] ?? ""),
        leadCaptureEnabled: true,
        })
        .returning({ id: launchSequencesTable.id });
    } catch (err) {
      // Concurrent bridge invocation may have won the campaign uniqueness
      // race. Reuse its sequence and let the atomic item activation below
      // complete the retry.
      const [winner] = await db.select({ id: launchSequencesTable.id })
        .from(launchSequencesTable)
        .where(and(
          eq(launchSequencesTable.workspaceId, workspaceId),
          eq(launchSequencesTable.campaignId, campaignId),
        )).limit(1);
      if (!winner) throw err;
      newSeq = winner;
    }

    sequenceId = newSeq.id;
    log.info({ campaignId, sequenceId }, "[BRIDGE] Created new launch sequence");
  }

  // 5. Parse all dispatch content pieces into sequence items
  const allItems: ParsedItem[] = [];

  for (const piece of pieces) {
    const content = (piece.content ?? {}) as Record<string, unknown>;

    switch (piece.type) {
      case "email_sequence":
        allItems.push(...parseEmailSequence(content));
        break;
      case "whatsapp_broadcast":
      case "whatsapp_group_message":
      case "prelaunch_warming":
        allItems.push(...parseWhatsAppContent(content, "whatsapp"));
        break;
      case "telegram_message":
        allItems.push(...parseWhatsAppContent(content, "telegram"));
        break;
    }
  }

  if (allItems.length === 0) {
    log.warn({ campaignId, sequenceId, pieceCount: pieces.length },
      "[BRIDGE] Pieces found but no items parsed — content may be structured unexpectedly");
    return { sequenceId, itemsCreated: 0, skipped: false, reason: "parse_yielded_zero_items" };
  }

  // Sort by dayIndex before inserting
  allItems.sort((a, b) => a.dayIndex - b.dayIndex);

  // Resolve provider configuration before entering the atomic activation unit.
  const dispatchConfig = await getDispatchConfig(workspaceId);
  const now = new Date();
  const activationConfig: Record<string, unknown> = {
    activatedAt: now.toISOString(),
    autoActivatedAt: now.toISOString(),
    autoActivatedBy: "sequence-bridge",
    masterplanVersionId: approvedPlan.id,
    contextFingerprint: approvedPlan.contextFingerprint,
    ...(dispatchConfig.emailProvider && { emailProvider: dispatchConfig.emailProvider }),
    ...(dispatchConfig.emailListId && { emailListId: dispatchConfig.emailListId }),
    ...(dispatchConfig.emailFromName && { emailFromName: dispatchConfig.emailFromName }),
    ...(dispatchConfig.emailFromEmail && { emailFromEmail: dispatchConfig.emailFromEmail }),
    ...(dispatchConfig.phoneNumbers.length > 0 && { phoneNumbers: dispatchConfig.phoneNumbers }),
  };
  // 6. Clear any stale items then insert fresh ones
  let inserted: { id: string }[] = [];
  // Item replacement and activation are one unit. A parser/database failure
  // therefore cannot leave a partially dispatchable sequence behind.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${workspaceId}:${campaignId}`}, 0))`);
    await tx.delete(launchSequenceItemsTable)
      .where(and(
        eq(launchSequenceItemsTable.sequenceId, sequenceId),
        eq(launchSequenceItemsTable.workspaceId, workspaceId),
      ));

    inserted = await tx.insert(launchSequenceItemsTable).values(
    allItems.map((item) => {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + item.dayIndex);

      return {
        sequenceId,
        workspaceId,
        phase:            item.phase,
        name:             item.name.slice(0, 255),
        description:      item.description || null,
        dayIndex:         item.dayIndex,
        deliveryChannels: item.deliveryChannels,
        contentType:      item.contentType,
        mentalTrigger:    item.mentalTrigger,
        objective:        item.objective,
        copyHints:        item.copyHints,
        status:           "scheduled" as const,
        scheduledAt,
          contentPieceId: undefined,
        metadata: {
          generatedCopy: Object.fromEntries(segmentsForPhase(item.phase).map((segment) => [segment, item.generatedCopy])),
          copyPolicyVersion: "segment-phase-v1",
          bridgedAt:      now.toISOString(),
          bridgeSource:   "sequence-bridge",
           masterplanVersionId: approvedPlan.id,
           contextFingerprint: approvedPlan.contextFingerprint,
           contentHash: approvedPlan.contentHash,
           firstTouchExecutable: item.deliveryChannels.every((channel) => channel === "email" || channel === "whatsapp") &&
             item.deliveryChannels.length === 1 && segmentsForPhase(item.phase).length > 0,
        },
      };
    }),
    ).returning({ id: launchSequenceItemsTable.id });

    await tx.update(launchSequencesTable).set({
      status: "active",
      config: activationConfig,
    }).where(and(
      eq(launchSequencesTable.id, sequenceId),
      eq(launchSequencesTable.workspaceId, workspaceId),
    ));
  });

  log.info({ campaignId, sequenceId, itemsInserted: inserted.length }, "[BRIDGE] Items inserted");

  log.info(
    { campaignId, sequenceId, items: inserted.length, emailProvider: dispatchConfig.emailProvider },
    "[BRIDGE] Sequence activated — dispatch scheduler will pick up items",
  );

  return {
    sequenceId,
    itemsCreated: inserted.length,
    skipped: false,
    reason: "bridged_from_content_pieces",
  };
}

import { Worker, type Job } from "bullmq";
import { lte, eq, and, inArray } from "drizzle-orm";
import {
  db,
  launchSequenceItemsTable,
  launchSequencesTable,
  sequenceContactsTable,
  emailDispatchesTable,
  whatsappDispatchesTable,
  campaignsTable,
  contentPiecesTable,
} from "@workspace/db";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { sendEmailDispatch } from "../email-dispatch/email-dispatch.service.js";
import { sendWhatsAppDispatch, createWhatsAppDispatch, sendWhatsAppSystemNotification, getWorkspaceOwnerContact } from "../whatsapp/whatsapp.service.js";
import { sendEmailSystemNotification } from "../email-dispatch/email-dispatch.service.js";
import { createEmailDispatch } from "../email-dispatch/email-dispatch.service.js";
import { emitSequenceEvent } from "./sequence-realtime.js";
import { sendWeeklyReportsToAll } from "../weekly-report/weekly-report.service.js";
import { triggerStrategyPhase, triggerContentPhase } from "../orchestration/orchestration.service.js";

const QUEUE_NAME = "sequence-scheduler";

const redisConnection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times: number) => {
    if (times > 3) return null;
    return Math.min(times * 1000, 5000);
  },
};

let worker: Worker | null = null;
let fallbackInterval: NodeJS.Timeout | null = null;

// ── Core processor ────────────────────────────────────────────────────────────

// ── Weekly report: fires once on Monday between 08:00–08:01 UTC ───────────────
let lastWeeklyReportDate: string | null = null;

async function maybeFireWeeklyReport(now: Date): Promise<void> {
  const log = logger.child({ component: "weekly-report-scheduler" });
  const isMonday = now.getUTCDay() === 1;
  const isReportHour = now.getUTCHours() === 8;
  const todayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  if (isMonday && isReportHour && lastWeeklyReportDate !== todayKey) {
    lastWeeklyReportDate = todayKey;
    log.info({ date: todayKey }, "Firing weekly reports (Monday 08:00 UTC)");
    await sendWeeklyReportsToAll();
  }
}

// ── Presença Social: plano semanal — segunda 08:00 UTC ────────────────────────
let lastPresenceWeeklyDate: string | null = null;

async function maybeFirePresenceWeekly(now: Date): Promise<void> {
  const log = logger.child({ component: "presence-weekly-scheduler" });
  const isMonday = now.getUTCDay() === 1;
  const isPlanHour = now.getUTCHours() === 8;
  const todayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  if (isMonday && isPlanHour && lastPresenceWeeklyDate !== todayKey) {
    lastPresenceWeeklyDate = todayKey;
    log.info({ date: todayKey }, "Firing presence weekly plan generation (Monday 08:00 UTC)");
    const { generateWeekForAllActiveConfigs } = await import(
      "../social-presence/social-presence.service.js"
    );
    await generateWeekForAllActiveConfigs();
  }
}

// ── Clarification timeout watchdog ────────────────────────────────────────────
// Runs every scheduler tick (60s). If a campaign has been in
// autocorrectionStatus === "waiting_clarification" for > 2 hours without the
// user answering, sends a WhatsApp notification to the workspace owner.
// Tracks clarificationNotifiedAt in brainData to avoid spamming (min 2h gap).
const CLARIFICATION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

async function maybeNotifyStaleWaitingClarification(): Promise<void> {
  const log = logger.child({ component: "clarification-watchdog" });
  const now = new Date();
  const threshold = new Date(now.getTime() - CLARIFICATION_TIMEOUT_MS);

  // Find all campaigns in generating/analyzing that might have waiting_clarification
  const candidates = await db
    .select({
      id: campaignsTable.id,
      workspaceId: campaignsTable.workspaceId,
      brainData: (campaignsTable as any).brainData,
    })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.status as any, "generating"),
        lte(campaignsTable.updatedAt as any, threshold),
      ),
    );

  for (const c of candidates) {
    try {
      const brain = ((c.brainData ?? {}) as Record<string, unknown>);
      const contentRetry = ((brain["contentRetry"] ?? {}) as Record<string, unknown>);
      const autocorrectionStatus = contentRetry["autocorrectionStatus"] as string | undefined;

      if (autocorrectionStatus !== "waiting_clarification") continue;

      const lastFailedAt = contentRetry["lastFailedAt"] as string | undefined;
      const clarificationNotifiedAt = contentRetry["clarificationNotifiedAt"] as string | undefined;

      // Check if enough time has passed since the clarification was requested
      const sinceFailure = lastFailedAt ? now.getTime() - new Date(lastFailedAt).getTime() : 0;
      if (sinceFailure < CLARIFICATION_TIMEOUT_MS) continue;

      // Check cooldown — don't re-notify if we already sent one within the last 2h
      if (clarificationNotifiedAt) {
        const sinceNotified = now.getTime() - new Date(clarificationNotifiedAt).getTime();
        if (sinceNotified < CLARIFICATION_TIMEOUT_MS) continue;
      }

      // Get owner contact (phone + email)
      const ownerContact = await getWorkspaceOwnerContact(c.workspaceId);

      const failedPieceType = contentRetry["lastFailedPieceType"] as string | undefined;
      const pieceLabel = failedPieceType ?? "conteúdo da campanha";
      const appUrl = env.APP_URL;
      const campaignUrl = `${appUrl}/campaigns/${c.id}`;

      let notified = false;

      // ── Channel 1: WhatsApp (preferred) ────────────────────────────────
      if (ownerContact.phone) {
        const waMessage = `🤖 *NexOS AI — Ação necessária*\n\nO sistema pausou a geração de *${pieceLabel}* e precisa de uma informação do seu briefing para continuar.\n\n📋 Responda a pergunta do agente para que a automação retome:\n${campaignUrl}\n\nIsso leva menos de 1 minuto.`;
        notified = await sendWhatsAppSystemNotification(c.workspaceId, ownerContact.phone, waMessage);
        if (notified) log.info({ campaignId: c.id }, "Clarification watchdog: WA notification sent to owner");
      }

      // ── Channel 2: Email fallback (when WA not available) ───────────────
      if (!notified && ownerContact.email) {
        const emailHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e0e0e0;border:1px solid #222">
  <p style="font-size:22px;font-weight:bold;color:#fff;margin:0 0 16px">⚡ NexOS AI — Ação necessária</p>
  <p style="color:#aaa;margin:0 0 20px">O pipeline da sua campanha está aguardando sua resposta para continuar a geração automática de conteúdo.</p>
  <div style="background:#111;border:1px solid #333;padding:16px;margin:0 0 20px">
    <p style="margin:0;color:#fff">📋 <strong>Peça bloqueada:</strong> ${pieceLabel}</p>
    <p style="margin:8px 0 0;color:#aaa;font-size:13px">O Entry Analyzer gerou uma pergunta específica sobre o seu briefing. Responda para que a automação retome instantaneamente.</p>
  </div>
  <a href="${campaignUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold;font-size:14px;letter-spacing:1px">RESPONDER AGORA</a>
  <p style="color:#555;font-size:12px;margin:24px 0 0">NexOS AI • Esta é uma notificação automática de sistema</p>
</div>`;
        notified = await sendEmailSystemNotification(
          ownerContact.email,
          `⚡ NexOS AI: sua campanha aguarda uma resposta (${pieceLabel})`,
          emailHtml,
        );
        if (notified) log.info({ campaignId: c.id }, "Clarification watchdog: email notification sent to owner");
      }

      if (!notified) {
        log.info({ campaignId: c.id }, "Clarification watchdog: no channel available (no phone, no email config) — skipping");
      }

      if (notified) {
        // Record notification time to avoid spam
        const updatedBrain = {
          ...brain,
          contentRetry: {
            ...contentRetry,
            clarificationNotifiedAt: now.toISOString(),
          },
        };
        await db
          .update(campaignsTable)
          .set({ brainData: updatedBrain as any })
          .where(eq(campaignsTable.id, c.id));
      }
    } catch (err) {
      log.warn({ err, campaignId: c.id }, "Clarification watchdog failed for campaign — non-blocking");
    }
  }
}

// ── Stuck campaign auto-recovery ──────────────────────────────────────────────
// Runs every scheduler tick (60s). Campaigns stuck in "analyzing" or "generating"
// without progress are force-reset to a retryable state.
//
// Two-tier detection (5-minute universal policy):
//   Fast path (5 min): pipelineCheckpoint.lastProgressAt is stale by 5+ min.
//     Both content.service.ts and orchestration.worker.ts heartbeats fire every
//     90s, keeping lastProgressAt fresh on all active pipelines.
//   Slow path (5 min): updatedAt stale — catches crashes before the heartbeat
//     starts (very first tick). Both phases touch updatedAt at start.
//
// After 10 scheduler resets, the problematic piece is auto-skipped (never blocked).
const STUCK_ANALYZING_MS = 5 * 60 * 1000;
const STUCK_GENERATING_MS = 5 * 60 * 1000;
const STUCK_PROGRESS_MS   = 5 * 60 * 1000;

async function recoverStuckCampaigns(): Promise<void> {
  const log = logger.child({ component: "failsafe-recovery" });
  const now = new Date();

  // ── Campaigns stuck in "analyzing" ────────────────────────────────────────
  const analyzeThreshold = new Date(now.getTime() - STUCK_ANALYZING_MS);
  const stuckAnalyzing = await db
    .select({ id: campaignsTable.id, workspaceId: campaignsTable.workspaceId, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.status as any, "analyzing"),
        lte(campaignsTable.updatedAt as any, analyzeThreshold),
      ),
    );

  for (const c of stuckAnalyzing) {
    try {
      const brain = ((c.brainData ?? {}) as Record<string, unknown>);
      const contentRetry = ((brain["contentRetry"] ?? {}) as Record<string, unknown>);
      const retryCount = (contentRetry["retryCount"] as number | undefined) ?? 0;

      // Fast-path guard: check lastProgressAt — if recent, the pipeline is active, skip reset
      const cp = (brain["pipelineCheckpoint"] as { lastProgressAt?: string } | undefined);
      if (cp?.lastProgressAt) {
        const progressAge = now.getTime() - new Date(cp.lastProgressAt).getTime();
        if (progressAge < STUCK_PROGRESS_MS) {
          log.info({ campaignId: c.id, progressAgeMs: progressAge }, "[FAILSAFE-AUTO] analyzing — lastProgressAt recent, skipping reset");
          continue;
        }
      }

      // After 3 auto-resets, auto-skip the problematic piece — write to
      // contentRetry.skippedPieces (canonical path read by skipAgent()).
      // Also inserts a visible placeholder piece so the approval UI can display it.
      if (retryCount >= 3) {
        const failedPieceType = contentRetry["lastFailedPieceType"] as string | undefined;
        const currentSkipped = ((contentRetry["skippedPieces"] ?? []) as string[]);
        const newSkipped = failedPieceType && !currentSkipped.includes(failedPieceType)
          ? [...currentSkipped, failedPieceType]
          : currentSkipped;
        const autoSkipBrain = {
          ...brain,
          pipelineCheckpoint: { lockedAt: null, lastProgressAt: null },
          contentRetry: {
            ...contentRetry,
            skippedPieces: newSkipped,
            retryCount: 0,
            autoSkippedAt: new Date().toISOString(),
            autoSkippedPiece: failedPieceType,
          },
        };
        await db.update(campaignsTable).set({ status: "intake" as any, updatedAt: new Date(), brainData: autoSkipBrain as any }).where(eq(campaignsTable.id, c.id));
        // Insert visible placeholder so approval UI shows the piece (not silently hidden)
        if (failedPieceType) {
          const [existing] = await db.select({ id: contentPiecesTable.id }).from(contentPiecesTable)
            .where(and(eq(contentPiecesTable.campaignId, c.id), eq(contentPiecesTable.type, failedPieceType as any))).limit(1);
          if (!existing) {
            await db.insert(contentPiecesTable).values({
              campaignId: c.id, workspaceId: c.workspaceId, type: failedPieceType as any, status: "draft",
              title: `[Pulado automaticamente] ${failedPieceType}`,
              content: { _notGenerated: true, _autoSkipped: true, _minimalFallback: true, reason: "Pulado após 3 tentativas — use Reescrever com IA." } as any,
              aiProvider: "none" as any, creditsUsed: 0,
            }).catch(e => log.warn({ e, campaignId: c.id, failedPieceType }, "[FAILSAFE-AUTO] placeholder insert failed — non-blocking"));
          }
        }
        log.warn({ campaignId: c.id, retryCount, failedPieceType }, "[FAILSAFE-AUTO] analyzing 3 resets — auto-skipped piece, re-triggering strategy");
        triggerStrategyPhase(c.id, c.workspaceId, log).catch((err) =>
          log.warn({ err, campaignId: c.id }, "[FAILSAFE-AUTO] failed to re-trigger strategy after auto-skip"),
        );
        continue;
      }

      const updatedBrain = {
        ...brain,
        contentRetry: { ...contentRetry, retryCount: retryCount + 1, lastRetryAt: new Date().toISOString() },
        // Clear pipeline lock so the next trigger can acquire it without blocking
        pipelineCheckpoint: brain["pipelineCheckpoint"]
          ? { ...(brain["pipelineCheckpoint"] as Record<string, unknown>), lockedAt: undefined, lastProgressAt: undefined }
          : undefined,
      };

      // If strategy was completed (checkpoint shows "strategy" in completedSteps), reset to
      // strategy_ready so content generation can proceed directly. Otherwise keep the
      // campaign in "analyzing" — NEVER reset to "intake" during an auto-recovery retry.
      // Resetting to "intake" causes the frontend to redirect to the briefing page mid-run,
      // which breaks UX. The strategy agent will re-run from "analyzing" automatically.
      // Only after retryCount >= 3 (auto-skip path above) is user intervention needed.
      const savedCp = (brain["pipelineCheckpoint"] as { completedSteps?: string[] } | undefined);
      const strategyDone = savedCp?.completedSteps?.includes("strategy") ?? false;
      const targetStatus = strategyDone ? "strategy_ready" : "analyzing";

      await db
        .update(campaignsTable)
        .set({ status: targetStatus as any, updatedAt: new Date(), brainData: updatedBrain as any })
        .where(eq(campaignsTable.id, c.id));
      log.warn(
        { campaignId: c.id, retryCount: retryCount + 1, targetStatus, strategyDone },
        `[FAILSAFE-AUTO] analyzing stuck → reset to ${targetStatus} — re-triggering`,
      );
      // Auto-resume: re-trigger the appropriate phase without waiting for client
      if (targetStatus === "strategy_ready") {
        triggerContentPhase(c.id, c.workspaceId, log).catch((err) =>
          log.warn({ err, campaignId: c.id }, "[FAILSAFE-AUTO] failed to re-trigger content after analyzing reset"),
        );
      } else {
        triggerStrategyPhase(c.id, c.workspaceId, log).catch((err) =>
          log.warn({ err, campaignId: c.id }, "[FAILSAFE-AUTO] failed to re-trigger strategy after analyzing reset"),
        );
      }
    } catch (err) {
      log.warn({ err, campaignId: c.id }, "[FAILSAFE-AUTO] failed to reset stuck analyzing campaign");
    }
  }

  // ── Campaigns stuck in "generating" ───────────────────────────────────────
  const genThreshold = new Date(now.getTime() - STUCK_GENERATING_MS);
  const stuckGenerating = await db
    .select({ id: campaignsTable.id, workspaceId: campaignsTable.workspaceId, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.status as any, "generating"),
        lte(campaignsTable.updatedAt as any, genThreshold),
      ),
    );

  for (const c of stuckGenerating) {
    try {
      const brain = ((c.brainData ?? {}) as Record<string, unknown>);
      const contentRetry = ((brain["contentRetry"] ?? {}) as Record<string, unknown>);
      const retryCount = (contentRetry["retryCount"] as number | undefined) ?? 0;

      // Fast-path guard: check lastProgressAt — if recent (< 8 min), pipeline is active
      const cp = (brain["pipelineCheckpoint"] as { lastProgressAt?: string } | undefined);
      if (cp?.lastProgressAt) {
        const progressAge = now.getTime() - new Date(cp.lastProgressAt).getTime();
        if (progressAge < STUCK_PROGRESS_MS) {
          log.info({ campaignId: c.id, progressAgeMs: progressAge }, "[FAILSAFE-AUTO] generating — lastProgressAt recent, skipping reset");
          continue;
        }
      }

      // After 3 auto-resets, auto-skip the problematic piece — write to
      // contentRetry.skippedPieces (canonical path read by skipAgent()).
      // Also inserts a visible placeholder piece so the approval UI can display it.
      if (retryCount >= 3) {
        const failedPieceType = contentRetry["lastFailedPieceType"] as string | undefined;
        const currentSkipped = ((contentRetry["skippedPieces"] ?? []) as string[]);
        const newSkipped = failedPieceType && !currentSkipped.includes(failedPieceType)
          ? [...currentSkipped, failedPieceType]
          : currentSkipped;
        const autoSkipBrain = {
          ...brain,
          pipelineCheckpoint: { lockedAt: null, lastProgressAt: null },
          contentRetry: {
            ...contentRetry,
            skippedPieces: newSkipped,
            retryCount: 0,
            autoSkippedAt: new Date().toISOString(),
            autoSkippedPiece: failedPieceType,
          },
        };
        await db.update(campaignsTable).set({ status: "strategy_ready" as any, updatedAt: new Date(), brainData: autoSkipBrain as any }).where(eq(campaignsTable.id, c.id));
        // Insert visible placeholder so approval UI shows the piece (not silently hidden)
        if (failedPieceType) {
          const [existing] = await db.select({ id: contentPiecesTable.id }).from(contentPiecesTable)
            .where(and(eq(contentPiecesTable.campaignId, c.id), eq(contentPiecesTable.type, failedPieceType as any))).limit(1);
          if (!existing) {
            await db.insert(contentPiecesTable).values({
              campaignId: c.id, workspaceId: c.workspaceId, type: failedPieceType as any, status: "draft",
              title: `[Pulado automaticamente] ${failedPieceType}`,
              content: { _notGenerated: true, _autoSkipped: true, _minimalFallback: true, reason: "Pulado após 3 tentativas — use Reescrever com IA." } as any,
              aiProvider: "none" as any, creditsUsed: 0,
            }).catch(e => log.warn({ e, campaignId: c.id, failedPieceType }, "[FAILSAFE-AUTO] placeholder insert failed — non-blocking"));
          }
        }
        log.warn({ campaignId: c.id, retryCount, failedPieceType }, "[FAILSAFE-AUTO] generating 3 resets — auto-skipped piece, re-triggering content");
        triggerContentPhase(c.id, c.workspaceId, log).catch((err) =>
          log.warn({ err, campaignId: c.id }, "[FAILSAFE-AUTO] failed to re-trigger content after auto-skip"),
        );
        continue;
      }

      const updatedBrain = {
        ...brain,
        contentRetry: { ...contentRetry, retryCount: retryCount + 1, lastRetryAt: new Date().toISOString() },
      };
      await db
        .update(campaignsTable)
        .set({ status: "strategy_ready" as any, updatedAt: new Date(), brainData: updatedBrain as any })
        .where(eq(campaignsTable.id, c.id));
      log.warn({ campaignId: c.id, retryCount: retryCount + 1 }, "[FAILSAFE-AUTO] generating > 5min → reset to strategy_ready, re-triggering");
      // Auto-resume: re-trigger content phase without waiting for client
      triggerContentPhase(c.id, c.workspaceId, log).catch((err) =>
        log.warn({ err, campaignId: c.id }, "[FAILSAFE-AUTO] failed to re-trigger content after generating reset"),
      );
    } catch (err) {
      log.warn({ err, campaignId: c.id }, "[FAILSAFE-AUTO] failed to reset stuck generating campaign");
    }
  }
}

export async function processScheduledItems(): Promise<void> {
  const log = logger.child({ component: "sequence-scheduler" });

  const now = new Date();

  await maybeFireWeeklyReport(now).catch((err) =>
    log.warn({ err }, "Weekly report tick failed — non-blocking"),
  );

  await recoverStuckCampaigns().catch((err) =>
    log.warn({ err }, "Stuck campaign recovery failed — non-blocking"),
  );

  await maybeNotifyStaleWaitingClarification().catch((err) =>
    log.warn({ err }, "Clarification watchdog tick failed — non-blocking"),
  );

  // Social media scheduled posts (Instagram / TikTok / Facebook)
  const { processScheduledSocialPosts } = await import("../social/social.autopost.service.js");
  await processScheduledSocialPosts().catch((err) =>
    log.warn({ err }, "Social post scheduler tick failed — non-blocking"),
  );

  // Presença Social Always-On: plano semanal (segunda 08h) + posts agendados
  await maybeFirePresenceWeekly(now).catch((err) =>
    log.warn({ err }, "Presence weekly tick failed — non-blocking"),
  );
  const { publishDuePresencePosts } = await import(
    "../social-presence/social-presence.service.js"
  );
  await publishDuePresencePosts().catch((err) =>
    log.warn({ err }, "Presence post scheduler tick failed — non-blocking"),
  );

  const dueItems = await db
    .select({
      item: launchSequenceItemsTable,
      sequence: {
        id: launchSequencesTable.id,
        workspaceId: launchSequencesTable.workspaceId,
        name: launchSequencesTable.name,
        productName: launchSequencesTable.productName,
        productPrice: launchSequencesTable.productPrice,
        config: launchSequencesTable.config,
      },
    })
    .from(launchSequenceItemsTable)
    .innerJoin(
      launchSequencesTable,
      eq(launchSequenceItemsTable.sequenceId, launchSequencesTable.id),
    )
    .where(
      and(
        eq(launchSequenceItemsTable.status, "scheduled"),
        lte(launchSequenceItemsTable.scheduledAt, now),
        eq(launchSequencesTable.status, "active"),
      ),
    );

  if (dueItems.length === 0) return;

  log.info({ count: dueItems.length }, "Processing due sequence items");

  for (const { item, sequence } of dueItems) {
    // A2 FIX (Bug #05): Atomic claim — only update if still "scheduled".
    // When BullMQ + setInterval both fire (Redis restart), both processes
    // see the same rows in the SELECT above. The UPDATE with AND status='scheduled'
    // acts as a compare-and-swap: only one process gets 1 affected row.
    // The loser gets 0 rows back and skips the item, preventing double-sends.
    const claimed = await db
      .update(launchSequenceItemsTable)
      .set({ status: "content_generating" })
      .where(
        and(
          eq(launchSequenceItemsTable.id, item.id),
          eq(launchSequenceItemsTable.status, "scheduled"),
        ),
      )
      .returning({ id: launchSequenceItemsTable.id });

    if (claimed.length === 0) {
      log.info({ itemId: item.id }, "A2: item already claimed by another process — skip (idempotency guard)");
      continue;
    }

    try {
      const cfg = (sequence.config ?? {}) as Record<string, unknown>;
      const channels = (item.deliveryChannels as string[]) ?? [];

      emitSequenceEvent({
        sequenceId: sequence.id,
        workspaceId: sequence.workspaceId,
        type: "item_dispatching",
        itemId: item.id,
        message: `Disparando "${item.name}" (Dia ${item.dayIndex})`,
        data: { channels, phase: item.phase },
      });

      const dispatched: string[] = [];

      // ── Email dispatch ────────────────────────────────────────────────────
      if (channels.includes("email") && cfg["emailListId"]) {
        try {
          const emailBody = buildEmailHtml(item, sequence);
          // Map "resend" to "custom_smtp" for DB enum compatibility (Resend auto-used as fallback)
          const rawProvider = (cfg["emailProvider"] as string) ?? "activecampaign";
          const dbProvider = rawProvider === "resend" ? "custom_smtp" : rawProvider;
          const emailDispatch = await createEmailDispatch(sequence.workspaceId, {
            campaignId: undefined,
            provider: dbProvider as "rd_station" | "activecampaign" | "custom_smtp",
            listId: String(cfg["emailListId"]),
            subject: buildEmailSubject(item),
            fromName: String(cfg["emailFromName"] ?? sequence.name),
            fromEmail: String(cfg["emailFromEmail"] ?? env.RESEND_FROM_EMAIL),
            htmlContent: emailBody,
          });
          await sendEmailDispatch(sequence.workspaceId, emailDispatch.id);
          dispatched.push("email");
          log.info({ itemId: item.id, dispatchId: emailDispatch.id }, "Email dispatched");
        } catch (err) {
          log.warn({ err, itemId: item.id }, "Email dispatch failed — continuing");
        }
      }

      // ── WhatsApp dispatch (segment-aware for cart phases) ────────────────
      if (channels.includes("whatsapp")) {
        const isCartPhase = ["cart_open", "cart_middle", "cart_close"].includes(item.phase);

        if (isCartPhase) {
          // Segment-aware: send different messages to hot/warm/cold leads
          try {
            const contacts = await db
              .select({ phone: sequenceContactsTable.phone, segment: sequenceContactsTable.segment })
              .from(sequenceContactsTable)
              .where(
                and(
                  eq(sequenceContactsTable.sequenceId, item.sequenceId),
                  inArray(sequenceContactsTable.segment, ["hot", "warm", "cold"]),
                ),
              );

            const bySegment = { hot: [] as string[], warm: [] as string[], cold: [] as string[] };
            for (const c of contacts) {
              if (c.phone && (c.segment === "hot" || c.segment === "warm" || c.segment === "cold")) {
                bySegment[c.segment].push(c.phone);
              }
            }

            const meta = (item.metadata as Record<string, unknown>) ?? {};
            const generatedCopy = meta["generatedCopy"] as Record<string, { whatsapp?: { message: string } }> | undefined;

            for (const seg of ["hot", "warm", "cold"] as const) {
              const phones = bySegment[seg];
              if (phones.length === 0) continue;

              const segCopy = generatedCopy?.[seg];
              const message = segCopy?.whatsapp?.message ?? buildWhatsAppMessageForSegment(item, sequence, seg);

              try {
                const waDispatch = await createWhatsAppDispatch(sequence.workspaceId, {
                  type: "broadcast",
                  recipients: phones,
                  message,
                });
                await sendWhatsAppDispatch(sequence.workspaceId, waDispatch.id);
                log.info({ itemId: item.id, seg, phones: phones.length }, `WhatsApp dispatched to ${seg} segment`);
              } catch (err) {
                log.warn({ err, itemId: item.id, seg }, "Segment WhatsApp dispatch failed");
              }
            }

            dispatched.push("whatsapp");
          } catch (err) {
            log.warn({ err, itemId: item.id }, "Segment-aware WhatsApp dispatch failed — continuing");
          }
        } else if (cfg["phoneNumbers"]) {
          // Standard broadcast to all configured numbers
          const phones = cfg["phoneNumbers"] as string[];
          if (phones.length > 0) {
            try {
              const waDispatch = await createWhatsAppDispatch(sequence.workspaceId, {
                type: "broadcast",
                recipients: phones,
                message: buildWhatsAppMessage(item, sequence),
              });
              await sendWhatsAppDispatch(sequence.workspaceId, waDispatch.id);
              dispatched.push("whatsapp");
              log.info({ itemId: item.id, dispatchId: waDispatch.id }, "WhatsApp dispatched");
            } catch (err) {
              log.warn({ err, itemId: item.id }, "WhatsApp dispatch failed — continuing");
            }
          }
        }
      }

      await db
        .update(launchSequenceItemsTable)
        .set({ status: "dispatched", metadata: { ...((item.metadata as Record<string, unknown>) ?? {}), dispatchedChannels: dispatched, dispatchedAt: now.toISOString() } })
        .where(eq(launchSequenceItemsTable.id, item.id));

      emitSequenceEvent({
        sequenceId: sequence.id,
        workspaceId: sequence.workspaceId,
        type: "item_dispatched",
        itemId: item.id,
        message: `✓ "${item.name}" disparado via ${dispatched.join(" + ") || "nenhum canal configurado"}`,
        data: { channels: dispatched, phase: item.phase, dayIndex: item.dayIndex },
      });
    } catch (err) {
      log.error({ err, itemId: item.id }, "Sequence item dispatch failed");
      await db
        .update(launchSequenceItemsTable)
        .set({ status: "scheduled" })
        .where(eq(launchSequenceItemsTable.id, item.id));
    }
  }

  // ── Check if sequence is complete ─────────────────────────────────────────
  const activeSequenceIds = [...new Set(dueItems.map((d) => d.sequence.id))];
  for (const seqId of activeSequenceIds) {
    const remaining = await db
      .select({ id: launchSequenceItemsTable.id })
      .from(launchSequenceItemsTable)
      .where(
        and(
          eq(launchSequenceItemsTable.sequenceId, seqId),
          inArray(launchSequenceItemsTable.status, ["pending", "scheduled", "content_generating"]),
        ),
      );

    if (remaining.length === 0) {
      await db
        .update(launchSequencesTable)
        .set({ status: "completed" })
        .where(eq(launchSequencesTable.id, seqId));
      log.info({ seqId }, "Sequence completed — all items dispatched");
    }
  }
}

function buildEmailSubject(item: typeof launchSequenceItemsTable.$inferSelect): string {
  const hints = item.copyHints ?? "";
  const subjectMatch = hints.match(/assunto[:\s]+([^\n]+)/i);
  if (subjectMatch) return subjectMatch[1]!.trim();

  const phaseSubjects: Record<string, string> = {
    plc1: "🎯 A oportunidade que você estava esperando",
    plc2: "✨ Veja a transformação real",
    plc3: "🤝 Você faz parte disso",
    cart_open: "🔓 Carrinho aberto — vagas limitadas",
    cart_middle: "⏰ Ainda dá tempo de garantir",
    cart_close: "🚨 Últimas horas — carrinho fecha hoje",
    post_purchase: "🎉 Bem-vindo! Próximos passos",
  };

  return phaseSubjects[item.phase] ?? item.name;
}

function buildEmailHtml(
  item: typeof launchSequenceItemsTable.$inferSelect,
  sequence: { name: string; productName: string | null; productPrice: string | null },
): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <h2 style="color:#1a1a2e">${item.name}</h2>
  <p>${item.description ?? item.objective ?? ""}</p>
  ${item.copyHints ? `<p style="color:#555;font-style:italic">${item.copyHints}</p>` : ""}
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
  <p style="font-size:12px;color:#999">
    ${sequence.name}${sequence.productName ? ` · ${sequence.productName}` : ""}
  </p>
</body>
</html>`;
}

function buildWhatsAppMessage(
  item: typeof launchSequenceItemsTable.$inferSelect,
  sequence: { name: string; productName: string | null },
): string {
  const hints = item.copyHints ?? "";
  const waMatch = hints.match(/whatsapp[:\s]+([^\n]+(?:\n(?!email|assunto)[^\n]+)*)/i);
  if (waMatch) return waMatch[1]!.trim().substring(0, 1000);

  return [
    `*${item.name}*`,
    "",
    item.description ?? item.objective ?? "",
    "",
    sequence.productName ? `_${sequence.productName}_` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .substring(0, 1000);
}

function buildWhatsAppMessageForSegment(
  item: typeof launchSequenceItemsTable.$inferSelect,
  sequence: { name: string; productName: string | null; productPrice: string | null },
  segment: "hot" | "warm" | "cold",
): string {
  const product = sequence.productName ?? "o produto";
  const price = sequence.productPrice ? `R$${sequence.productPrice}` : "";

  const templates: Record<"hot" | "warm" | "cold", Record<string, string>> = {
    hot: {
      cart_open: `🔓 *Acesso VIP liberado!*\n\nVocê foi um dos primeiros a abrir todos os conteúdos — por isso quero te dar acesso especial antes de todo mundo.\n\n👉 ${product}${price ? ` por ${price}` : ""} — garanta agora:\n{{CTA_URL}}\n\n_Somente para quem acompanhou tudo do início_ ⚡`,
      cart_middle: `⚡ *Update exclusivo para você*\n\nJá temos dezenas de alunos confirmados em ${product}.\n\nAs vagas estão indo rápido — e você que acompanhou tudo merece garantir o seu lugar.\n\n👉 {{CTA_URL}}`,
      cart_close: `🚨 *Últimas horas — para você que acompanhou tudo*\n\nO carrinho de ${product} fecha em poucas horas.\n\nVocê viu tudo, sabe o que está em jogo. Não deixe para depois.\n\n👉 Garantir agora: {{CTA_URL}}`,
    },
    warm: {
      cart_open: `🔓 *Carrinho aberto — ${product}*\n\nChegou o momento! As inscrições para ${product} estão abertas.${price ? `\n\nInvestimento: ${price}` : ""}\n\nCom garantia total de satisfação.\n\n👉 Saiba mais: {{CTA_URL}}`,
      cart_middle: `⏰ *Ainda dá tempo!*\n\nAs vagas para ${product} ainda estão disponíveis — mas estão acabando.\n\nNão fique de fora:\n👉 {{CTA_URL}}`,
      cart_close: `🚨 *Última chamada — ${product}*\n\nO carrinho fecha hoje. Última chance de garantir ${product}${price ? ` por ${price}` : ""}.\n\n👉 {{CTA_URL}}\n\n_Após o fechamento não haverá novas turmas em breve._`,
    },
    cold: {
      cart_open: `💡 *Uma pergunta rápida...*\n\nVocê sabia que ${product} está com inscrições abertas agora?\n\nSe você ainda tem dúvida se é para você, veja o que estamos entregando:\n👉 {{CTA_URL}}`,
      cart_middle: `🤔 *Ainda na dúvida?*\n\nEntendo. Por isso separei um depoimento de quem estava no mesmo lugar que você e decidiu entrar em ${product}.\n\nVeja aqui: {{CTA_URL}}`,
      cart_close: `⏳ *Última chance — depois disso acabou*\n\nO carrinho de ${product} fecha em poucas horas.\n\nSe você está na dúvida, essa é a última oportunidade.\n\n👉 {{CTA_URL}}\n\n_P.S.: Temos garantia total. Sem risco para você._`,
    },
  };

  const msg = templates[segment][item.phase] ?? buildWhatsAppMessage(item, sequence);
  return msg.substring(0, 1000);
}

// ── BullMQ worker ─────────────────────────────────────────────────────────────

export function initSequenceScheduler(): void {
  const log = logger.child({ component: "sequence-scheduler" });

  if (env.REDIS_URL) {
    try {
      const { Queue } = require("bullmq") as typeof import("bullmq");

      const queue = new Queue(QUEUE_NAME, { connection: redisConnection });
      queue
        .upsertJobScheduler(
          "sequence-tick",
          { every: 60_000 },
          { name: "tick", data: {}, opts: { removeOnComplete: 5, removeOnFail: 10 } },
        )
        .catch((err) => log.warn({ err }, "Failed to register repeatable job — using setInterval fallback"));

      worker = new Worker(
        QUEUE_NAME,
        async (_job: Job) => {
          await processScheduledItems();
        },
        { connection: redisConnection, concurrency: 1 },
      );

      worker.on("failed", (job, err) => {
        log.error({ jobId: job?.id, err }, "Sequence scheduler job failed");
      });

      log.info("Sequence scheduler BullMQ worker started (60s tick)");
      return;
    } catch (err) {
      log.warn({ err }, "BullMQ unavailable — falling back to setInterval");
    }
  }

  fallbackInterval = setInterval(() => {
    processScheduledItems().catch((err) => log.error({ err }, "Scheduler tick error"));
  }, 60_000);

  log.info("Sequence scheduler started via setInterval (60s) — Redis not available");
}

export async function closeSequenceScheduler(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
}

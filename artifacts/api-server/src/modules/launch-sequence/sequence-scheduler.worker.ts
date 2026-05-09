import { Worker, type Job } from "bullmq";
import { lte, eq, and, inArray } from "drizzle-orm";
import {
  db,
  launchSequenceItemsTable,
  launchSequencesTable,
  emailDispatchesTable,
  whatsappDispatchesTable,
} from "@workspace/db";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { sendEmailDispatch } from "../email-dispatch/email-dispatch.service.js";
import { sendWhatsAppDispatch, createWhatsAppDispatch } from "../whatsapp/whatsapp.service.js";
import { createEmailDispatch } from "../email-dispatch/email-dispatch.service.js";
import { emitSequenceEvent } from "./sequence-realtime.js";

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

export async function processScheduledItems(): Promise<void> {
  const log = logger.child({ component: "sequence-scheduler" });

  const now = new Date();

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
    await db
      .update(launchSequenceItemsTable)
      .set({ status: "content_generating" })
      .where(eq(launchSequenceItemsTable.id, item.id));

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
          const emailDispatch = await createEmailDispatch(sequence.workspaceId, {
            campaignId: undefined,
            provider: (cfg["emailProvider"] as "rd_station" | "activecampaign") ?? "activecampaign",
            listId: String(cfg["emailListId"]),
            subject: buildEmailSubject(item),
            fromName: String(cfg["emailFromName"] ?? sequence.name),
            fromEmail: String(cfg["emailFromEmail"] ?? "contato@nexos.ai"),
            htmlContent: emailBody,
          });
          await sendEmailDispatch(sequence.workspaceId, emailDispatch.id);
          dispatched.push("email");
          log.info({ itemId: item.id, dispatchId: emailDispatch.id }, "Email dispatched");
        } catch (err) {
          log.warn({ err, itemId: item.id }, "Email dispatch failed — continuing");
        }
      }

      // ── WhatsApp dispatch ─────────────────────────────────────────────────
      if (channels.includes("whatsapp") && cfg["phoneNumbers"]) {
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

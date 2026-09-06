import { logger } from "../../lib/logger.js";
import { publishPost, syncPostMetrics, getDueScheduledPosts } from "./social.service.js";
import { registerScheduler, runSchedulerTick } from "../operations/scheduler-health.registry.js";

// ─── Scheduler poll (when Redis unavailable) ──────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startSocialScheduler(): void {
  if (schedulerInterval) return;
  registerScheduler("social-publishing", 3 * 60_000);

  // Poll every minute for due posts
  schedulerInterval = setInterval(() => {
    void runSchedulerTick("social-publishing", async () => {
      try {
        const duePosts = await getDueScheduledPosts();
        if (duePosts.length === 0) return;

        logger.info({ count: duePosts.length }, "Processing due social posts");

        for (const post of duePosts) {
          try {
            // Scheduler jobs have no request auth context; the row's persisted
            // owner is the only valid workspace context for this operation.
            await publishPost(post.workspaceId, post.id);
          } catch (err) {
            logger.error({ err, postId: post.id }, "Failed to publish scheduled post");
          }
        }
      } catch (err) {
        logger.error({ err }, "Social scheduler poll failed");
        throw err;
      }
    }).catch(() => undefined);
  }, 60_000);

  logger.info("Social publishing scheduler started (60s poll)");
}

export function stopSocialScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("Social publishing scheduler stopped");
  }
}

// ─── Metrics sync (runs every 6 hours) ───────────────────────────────────────

let metricsInterval: ReturnType<typeof setInterval> | null = null;

export function startMetricsSyncScheduler(
  publishedPosts: () => Promise<Array<{ id: string; workspaceId: string }>>
): void {
  if (metricsInterval) return;
  registerScheduler("social-metrics", 13 * 60 * 60_000);

  metricsInterval = setInterval(() => {
    void runSchedulerTick("social-metrics", async () => {
      try {
        const posts = await publishedPosts();
        for (const post of posts) {
          try {
            // The producer must carry the owning workspace with each post; never
            // synchronize provider data from an unscoped post ID.
            await syncPostMetrics(post.workspaceId, post.id);
          } catch (err) {
            logger.error({ err, postId: post.id }, "Metrics sync failed for post");
          }
        }
      } catch (err) {
        logger.error({ err }, "Metrics sync scheduler failed");
        throw err;
      }
    }).catch(() => undefined);
  }, 6 * 60 * 60 * 1000);

  logger.info("Social metrics sync scheduler started (6h interval)");
}

export function stopMetricsSyncScheduler(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

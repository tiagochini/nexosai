import { logger } from "../../lib/logger.js";
import { publishPost, syncPostMetrics, getDueScheduledPosts } from "./social.service.js";

// ─── Scheduler poll (when Redis unavailable) ──────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startSocialScheduler(): void {
  if (schedulerInterval) return;

  // Poll every minute for due posts
  schedulerInterval = setInterval(async () => {
    try {
      const duePosts = await getDueScheduledPosts();
      if (duePosts.length === 0) return;

      logger.info({ count: duePosts.length }, "Processing due social posts");

      for (const post of duePosts) {
        try {
          await publishPost(post.id);
        } catch (err) {
          logger.error({ err, postId: post.id }, "Failed to publish scheduled post");
        }
      }
    } catch (err) {
      logger.error({ err }, "Social scheduler poll failed");
    }
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

export function startMetricsSyncScheduler(publishedPostIds: () => Promise<string[]>): void {
  if (metricsInterval) return;

  metricsInterval = setInterval(async () => {
    try {
      const ids = await publishedPostIds();
      for (const id of ids) {
        try {
          await syncPostMetrics(id);
        } catch (err) {
          logger.error({ err, postId: id }, "Metrics sync failed for post");
        }
      }
    } catch (err) {
      logger.error({ err }, "Metrics sync scheduler failed");
    }
  }, 6 * 60 * 60 * 1000);

  logger.info("Social metrics sync scheduler started (6h interval)");
}

export function stopMetricsSyncScheduler(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

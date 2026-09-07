import { logger } from "../../lib/logger.js";
import { lifecycleSchedulerTick } from "./lifecycle.service.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await lifecycleSchedulerTick();
  } catch (err) {
    logger.error({ err }, "Lifecycle scheduler tick failed");
  } finally {
    running = false;
  }
}

export function startLifecycleScheduler(): void {
  if (interval) return;
  interval = setInterval(() => void tick(), 60_000);
  interval.unref();
  void tick();
  logger.info("Lifecycle scheduler started");
}

export function stopLifecycleScheduler(): void {
  if (!interval) return;
  clearInterval(interval);
  interval = null;
}
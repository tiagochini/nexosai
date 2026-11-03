/**
 * Process-local scheduler heartbeats for the operational health endpoint.
 *
 * This deliberately reports lifecycle metadata only: no job, account, provider,
 * request, or error payload is retained. A scheduler being stale is advisory:
 * its work may have a safe fallback, so callers must not turn this into an
 * outage unless that scheduler is explicitly made a critical dependency.
 */
export type SchedulerHealth = {
  startedAt: string;
  lastTickAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastDurationMs: number | null;
  lastOutcome: "completed" | "failed" | "skipped" | null;
  inFlight: boolean;
  stale: boolean;
};

type SchedulerRecord = Omit<SchedulerHealth, "stale"> & { staleAfterMs: number };
const schedulers = new Map<string, SchedulerRecord>();

function safeErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ("code" in current && typeof current.code === "string" && /^[A-Z0-9]{5}$/.test(current.code)) return current.code;
    current = "cause" in current ? current.cause : null;
  }
  return null;
}

export function registerScheduler(name: string, staleAfterMs: number): void {
  if (!schedulers.has(name)) {
    schedulers.set(name, {
      startedAt: new Date().toISOString(),
      lastTickAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastDurationMs: null,
      lastOutcome: null,
      inFlight: false,
      staleAfterMs,
    });
  }
}

/**
 * Runs a local timer callback at most once. The boolean result is useful to
 * callers that need to distinguish an intentional overlap skip from a failure.
 */
export async function runSchedulerTick(name: string, callback: () => Promise<void>): Promise<boolean> {
  const record = schedulers.get(name);
  if (!record) throw new Error(`Scheduler "${name}" must be registered before ticking`);
  if (record.inFlight) { record.lastOutcome = "skipped"; return false; }

  record.inFlight = true;
  record.lastTickAt = new Date().toISOString();
  const started = Date.now();
  try {
    await callback();
    record.lastSuccessAt = new Date().toISOString();
    record.lastOutcome = "completed";
    return true;
  } catch (error) {
    // Keep provider messages/payloads out of logs; SQLSTATE is safe and makes
    // database failures actionable (e.g. missing table/column/permission).
    const code = safeErrorCode(error);
    record.lastErrorAt = new Date().toISOString();
    record.lastOutcome = "failed";
    throw new Error(`Scheduler "${name}" tick failed${code ? ` [${code}]` : ""}`);
  } finally {
    record.lastDurationMs = Date.now() - started;
    record.inFlight = false;
  }
}

export function getSchedulerHealth(now = Date.now()): Record<string, SchedulerHealth> {
  return Object.fromEntries(Array.from(schedulers.entries()).map(([name, record]) => {
    const reference = record.lastSuccessAt ?? record.startedAt;
    return [name, {
      startedAt: record.startedAt,
      lastTickAt: record.lastTickAt,
      lastSuccessAt: record.lastSuccessAt,
      lastErrorAt: record.lastErrorAt,
      lastDurationMs: record.lastDurationMs,
      lastOutcome: record.lastOutcome,
      inFlight: record.inFlight,
      stale: now - new Date(reference).getTime() > record.staleAfterMs,
    }];
  }));
}

/** Test isolation for the process-local registry; never used by application code. */
export function resetSchedulerHealthForTests(): void {
  schedulers.clear();
}

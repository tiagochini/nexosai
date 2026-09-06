/**
 * Small dependency-injected seams for the orchestration fallback paths.
 *
 * The production claim is a PostgreSQL conditional update. Keeping the policy
 * here lets the race behaviour be verified without Redis, a worker, or module
 * mocks; callers must supply a durable (cross-process) claim implementation.
 */
export async function runKnownNoRedisFallback(
  claim: () => Promise<boolean>,
  execute: () => Promise<void>,
): Promise<boolean> {
  if (!(await claim())) return false;
  await execute();
  return true;
}

export type EnqueueReconciliation = "persisted" | "unknown";

/**
 * An add acknowledgement failure is never permission for direct execution.
 * `unknown` includes both a negative point-in-time lookup and a failed lookup:
 * either can race a late Redis write.
 */
export async function reconcileAmbiguousEnqueue(
  getJob: () => Promise<unknown | undefined | null>,
): Promise<EnqueueReconciliation> {
  try {
    return (await getJob()) ? "persisted" : "unknown";
  } catch {
    return "unknown";
  }
}
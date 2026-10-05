import { pool } from "@workspace/db";
import { sendWelcomeEmailNow } from "../modules/academy/academy-funnel.service.js";

// Test-only child process. No real transport can be reached through this worker.
try {
  const [leadId, mode] = process.argv.slice(2);
  if (!process.send || !leadId || !/^[0-9a-f-]{36}$/i.test(leadId) || !["hold", "complete"].includes(mode ?? "")) {
    throw new Error("Invalid test worker invocation");
  }
  await sendWelcomeEmailNow(leadId, async () => {
    process.send!({ type: "claimed" });
    if (mode === "hold") {
      // Simulate an active provider operation until the parent kills this worker.
      const keepAlive = setInterval(() => {}, 1000);
      try { await new Promise<void>(() => {}); } finally { clearInterval(keepAlive); }
    }
    return { status: "sent", providerId: "offline-child-receipt" };
  });
  process.send!({ type: "completed" });
} catch {
  process.send?.({ type: "error" });
  process.exitCode = 1;
} finally {
  await pool.end();
  process.disconnect?.();
}

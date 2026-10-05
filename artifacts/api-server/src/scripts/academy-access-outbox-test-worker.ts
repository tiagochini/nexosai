import { pool } from "@workspace/db";
import { dispatchAcademyAccessEmail } from "../modules/academy/academy-access-outbox.service.js";
try {
  const [id, mode] = process.argv.slice(2);
  if (process.env.NODE_ENV !== "test" || !process.send || !id || !/^[0-9a-f-]{36}$/i.test(id) || !["hold", "complete"].includes(mode ?? "")) throw new Error("Invalid worker invocation");
  await dispatchAcademyAccessEmail(id, { deliver: async () => {
    process.send!({ type: "claimed" });
    if (mode === "hold") {
      const keepAlive = setInterval(() => {}, 1000);
      try { await new Promise<void>(() => {}); } finally { clearInterval(keepAlive); }
    }
    return { status: "sent", providerId: "offline-child-receipt" };
  } });
  process.send!({ type: "completed" });
} catch { process.send?.({ type: "error" }); process.exitCode = 1; }
finally { await pool.end(); process.disconnect?.(); }

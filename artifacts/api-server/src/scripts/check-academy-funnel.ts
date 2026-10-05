import { pool } from "@workspace/db";
import { inspectFunnelDelivery } from "../modules/academy/academy-funnel-inspection.js";

try {
  if (process.argv.length !== 2) throw new Error("Unsupported arguments");
  const report = await inspectFunnelDelivery();
  console.log(JSON.stringify(report, null, 2));
  // 2 means operational review required, not permission to resend anything.
  process.exitCode = report.requiresReview ? 2 : 0;
} catch {
  console.error("Academy inspection failed; check database configuration and availability.");
  process.exitCode = 1;
} finally {
  await pool.end();
}

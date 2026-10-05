import { eq, or, sql } from "drizzle-orm";
import { db, pool, academyAccessEmailOutboxTable } from "@workspace/db";
try {
  const report = await db.transaction(async (trx) => {
    const counts = await trx.select({ status: academyAccessEmailOutboxTable.status, count: sql<number>`count(*)::int` })
      .from(academyAccessEmailOutboxTable).groupBy(academyAccessEmailOutboxTable.status);
    const review = await trx.select({ id: academyAccessEmailOutboxTable.id, status: academyAccessEmailOutboxTable.status, attempts: academyAccessEmailOutboxTable.attempts, claimedAt: academyAccessEmailOutboxTable.claimedAt, errorCode: academyAccessEmailOutboxTable.errorCode })
      .from(academyAccessEmailOutboxTable).where(or(eq(academyAccessEmailOutboxTable.status, "sending"), eq(academyAccessEmailOutboxTable.status, "failed")))
      .orderBy(academyAccessEmailOutboxTable.createdAt, academyAccessEmailOutboxTable.id).limit(100);
    return { counts, review, reviewLimit: 100 };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  console.log(JSON.stringify(report, null, 2));
  if (report.counts.some((row) => ["sending", "failed"].includes(row.status) && row.count > 0)) process.exitCode = 2;
} catch { console.error("Access outbox inspection failed"); process.exitCode = 1; }
finally { await pool.end(); }

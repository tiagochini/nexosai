import { db, workspacesTable } from "./index.js";
import { eq } from "drizzle-orm";

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function main() {
  const all = await db.select({ id: workspacesTable.id, settings: workspacesTable.settings }).from(workspacesTable);
  let updated = 0;
  for (const ws of all) {
    const s = (ws.settings as Record<string, unknown>) ?? {};
    if (!s.referralCode) {
      const code = genCode();
      await db
        .update(workspacesTable)
        .set({ settings: { ...s, referralCode: code, referralCount: 0 } })
        .where(eq(workspacesTable.id, ws.id));
      updated++;
      console.log(`  ✅ ${ws.id.substring(0, 8)} → ${code}`);
    } else {
      console.log(`  ⏭  ${ws.id.substring(0, 8)} → ${s.referralCode} (já existe)`);
    }
  }
  console.log(`\nConcluído. ${updated} workspace(s) atualizados.`);
}

main().catch(console.error).finally(() => process.exit(0));

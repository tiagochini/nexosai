import { db } from "./index.js";
import { inviteCodesTable } from "./schema/invite-codes.js";

async function main() {
  await db.insert(inviteCodesTable).values({
    code: "NEXOSTEST01",
    planSlug: "agency",
    label: "UI Test",
  }).onConflictDoNothing();
  console.log("OK — code: NEXOSTEST01");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

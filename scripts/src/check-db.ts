import { db } from "@workspace/db";
import { contentPiecesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  // Get the most recent media brief
  const pieces = await db.select().from(contentPiecesTable)
    .where(eq(contentPiecesTable.type, "media_brief"))
    .limit(3);
  for (const p of pieces) {
    const c = p.content as Record<string, unknown>;
    console.log("MEDIA BRIEF:", p.id, p.campaignId);
    console.log("imageConcepts:", JSON.stringify((c["imageConcepts"] as unknown[])?.length ?? 0));
    console.log("videoConcepts:", JSON.stringify((c["videoConcepts"] as unknown[])?.length ?? 0));
    // show raw content snippet
    const raw = JSON.stringify(c).slice(0, 500);
    console.log("content snippet:", raw);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

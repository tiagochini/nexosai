import { readFile } from "node:fs/promises";
import { or, eq } from "drizzle-orm";
import { db, workspacesTable } from "@workspace/db";
import { cleanupE2eFixtures, markerFromSuffix } from "./e2e-fixtures.js";

const input = process.argv[2];
if (!input) throw new Error("Usage: pnpm test:e2e-cleanup <manifest.json|suffix>");
let manifest: { marker: string; users: string[]; workspaces: string[]; integrations: string[] };
try {
  manifest = JSON.parse(await readFile(input, "utf8"));
} catch {
  const marker = markerFromSuffix(input);
  const workspaces = await db.select({ id: workspacesTable.id, ownerId: workspacesTable.ownerId })
    .from(workspacesTable)
    .where(or(
      eq(workspacesTable.name, `${marker} Primary`),
      eq(workspacesTable.name, `${marker} Secondary`),
    ));
  manifest = { marker, workspaces: workspaces.map((row) => row.id), users: workspaces.map((row) => row.ownerId), integrations: [] };
}
await cleanupE2eFixtures(manifest);
console.log(JSON.stringify({ cleaned: manifest.marker }));
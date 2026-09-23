import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const generatedType = fileURLToPath(
  new URL("../../api-zod/src/generated/types/getCampaignControlRoomEvidenceParams.ts", import.meta.url),
);

const original = await readFile(generatedType, "utf8");
const updated = original.replace(
  "export type GetCampaignControlRoomEvidenceParams =",
  "export type GetCampaignControlRoomEvidenceQuery =",
);

if (updated === original) {
  throw new Error("Expected generated evidence query params type was not found");
}

await writeFile(generatedType, updated);
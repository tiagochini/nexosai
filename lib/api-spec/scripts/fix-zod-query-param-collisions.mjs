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

const previewType = fileURLToPath(
  new URL("../../api-zod/src/generated/types/getCampaignControlRoomPreviewsParams.ts", import.meta.url),
);
const previewOriginal = await readFile(previewType, "utf8");
const previewUpdated = previewOriginal.replace(
  "export type GetCampaignControlRoomPreviewsParams =",
  "export type GetCampaignControlRoomPreviewsQuery =",
);
if (previewUpdated === previewOriginal) throw new Error("Expected generated previews query params type was not found");
await writeFile(previewType, previewUpdated);
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

const diffType = fileURLToPath(
  new URL("../../api-zod/src/generated/types/getCampaignControlRoomVersionDiffParams.ts", import.meta.url),
);
const diffOriginal = await readFile(diffType, "utf8");
const diffUpdated = diffOriginal.replace(
  "export type GetCampaignControlRoomVersionDiffParams =",
  "export type GetCampaignControlRoomVersionDiffQuery =",
);
if (diffUpdated === diffOriginal) throw new Error("Expected generated version diff query params type was not found");
await writeFile(diffType, diffUpdated);

const typesIndex = fileURLToPath(new URL("../../api-zod/src/generated/types/index.ts", import.meta.url));
const indexOriginal = await readFile(typesIndex, "utf8");
const indexUpdated = indexOriginal
  .replace('export * from "./getCampaignParams";\n', "")
  .replace('export * from "./getCampaignControlRoomApprovalsParams";\n', "")
  .replace('export * from "./decideCampaignControlRoomApprovalBody";\n', "")
  // Orval emits both this type and a Zod value with the same name. Keep the
  // runtime validator exported from generated/api, but not the colliding type.
  .replace('export * from "./getLifecycleTimelineParams";\n', "");
await writeFile(typesIndex, indexUpdated);
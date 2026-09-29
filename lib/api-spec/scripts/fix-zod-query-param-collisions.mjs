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
// Orval emits both these types and Zod values with the same names. Keep the
// runtime validators, but not the colliding type exports. Accept both quote
// styles so a generator formatting change cannot silently undo this fix.
const collidingExports = [
  "getCampaignParams",
  "getCampaignControlRoomApprovalsParams",
  "decideCampaignControlRoomApprovalBody",
  "getLifecycleTimelineParams",
];
let indexUpdated = indexOriginal;
for (const name of collidingExports) {
  indexUpdated = indexUpdated.replace(
    new RegExp(`^export \\* from ['"]\\./${name}['"];?\\r?\\n`, "m"),
    "",
  );
}
await writeFile(typesIndex, indexUpdated);

for (const relativePath of [
  "../../api-client-react/src/generated/api.ts",
  "../../api-client-react/src/generated/api.schemas.ts",
  "../../api-zod/src/generated/api.ts",
]) {
  const generatedFile = fileURLToPath(new URL(relativePath, import.meta.url));
  const content = await readFile(generatedFile, "utf8");
  const normalized = content.replace(/\n{2,}$/, "\n");
  if (normalized !== content) await writeFile(generatedFile, normalized);
}
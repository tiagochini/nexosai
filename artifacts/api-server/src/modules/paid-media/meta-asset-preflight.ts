import { AppError } from "../../lib/errors.js";
type Json = Record<string, any>;
export type MetaAssetReader = (
  path: string,
  query: Record<string, string>,
) => Promise<Json>;
export async function requireAccountAssets(
  read: MetaAssetReader,
  account: string,
  edge: "customaudiences" | "advideos" | "adspixels",
  ids: string[],
) {
  const missing = new Set(ids);
  if (!missing.size) return;
  let after = "";
  for (let page = 0; page < 100; page++) {
    const result = await read(`${account}/${edge}`, {
      fields: "id",
      limit: "500",
      ...(after ? { after } : {}),
    });
    for (const row of result.data ?? []) missing.delete(String(row.id));
    if (!missing.size) return;
    const next = result.paging?.cursors?.after;
    if (!result.paging?.next || typeof next !== "string" || next === after)
      break;
    after = next; // Never follow an untrusted URL containing credentials.
  }
  throw new AppError(
    422,
    `Há ativos de ${edge} sem acesso pela conta selecionada. Revise os IDs e permissões.`,
    "META_ASSET_ACCESS_REQUIRED",
  );
}
export async function verifyMetaLaunchAssets(
  tree: Json,
  account: string,
  read: MetaAssetReader,
) {
  const audiences: string[] = [],
    videos: string[] = [];
  for (const group of tree.adGroups ?? []) {
    for (const field of ["custom_audiences", "excluded_custom_audiences"])
      for (const row of group.targeting?.[field] ?? []) audiences.push(row.id);
    for (const ad of group.ads ?? []) {
      const videoId = ad.creative?.object_story_spec?.video_data?.video_id;
      if (videoId) videos.push(videoId);
    }
  }
  await requireAccountAssets(read, account, "customaudiences", audiences);
  await requireAccountAssets(read, account, "advideos", videos);
  for (const id of new Set(videos)) {
    const video = await read(id, { fields: "id,status" });
    if (video.id !== id || video.status?.video_status !== "ready")
      throw new AppError(
        422,
        "O vídeo ainda não está pronto na Meta.",
        "META_VIDEO_NOT_READY",
      );
  }
  const catalog = tree.campaign?.catalog;
  if (catalog) {
    const set = await read(catalog.productSetId, {
      fields: "id,product_catalog,product_count",
    });
    if (
      set.id !== catalog.productSetId ||
      set.product_catalog?.id !== catalog.catalogId ||
      !(Number(set.product_count) > 0)
    )
      throw new AppError(
        422,
        "O conjunto de produtos precisa pertencer ao catálogo aprovado e conter produtos.",
        "META_CATALOG_NOT_READY",
      );
  }
}

/** Keep organic Meta operations on one reviewed Graph API version. */
export const META_GRAPH_VERSION = "v22.0";

export function metaGraphUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `https://graph.facebook.com/${META_GRAPH_VERSION}${normalizedPath}`;
}
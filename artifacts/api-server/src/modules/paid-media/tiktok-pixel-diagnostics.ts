type Page = { id: string; status: string; publishedUrl: string | null; html: string | null; metadata: unknown };
/** Stored deployment evidence only: never claims a browser tag executed. */
export function tikTokPageConfiguration(pages: Page[], pixelCode: string) {
  return pages.flatMap(page => {
    const metadata = page.metadata as { implementation?: { tracking?: { tiktokPixelId?: string } } } | null;
    if (metadata?.implementation?.tracking?.tiktokPixelId !== pixelCode) return [];
    return [{ pageId: page.id, publishedUrl: page.publishedUrl, published: page.status === "published" && Boolean(page.publishedUrl), tagInStoredHtml: Boolean(page.html?.includes("analytics.tiktok.com/i18n/pixel/events.js") && page.html.includes(pixelCode)), measurementSource: "stored_page_configuration" }];
  });
}

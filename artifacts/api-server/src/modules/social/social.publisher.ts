import { logger } from "../../lib/logger.js";
import type { SocialPost, WorkspaceIntegration } from "@workspace/db";

export type PublishResult = {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
};

export type MetricsResult = {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  reach: number;
  impressions: number;
  clicks: number;
};

// ─── Meta (Instagram + Facebook) ─────────────────────────────────────────────

async function metaGraphRequest<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;
  const url = new URL(`https://graph.facebook.com/v22.0${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    ...fetchOptions,
    headers: { "Content-Type": "application/json", ...fetchOptions.headers },
  });
  const data = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || (data as { error?: { message: string } }).error) {
    const msg =
      (data as { error?: { message: string } }).error?.message ??
      `Meta API error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Aguarda o container do Instagram estar pronto (status_code === "FINISHED") antes de publicar.
 * Instagram processa imagens e vídeos de forma assíncrona — publicar sem esperar causa
 * "Media ID is not available".
 */
async function waitForInstagramContainer(
  containerId: string,
  token: string,
  maxWaitMs = 30_000
): Promise<void> {
  const pollIntervalMs = 2_000;
  const maxAttempts = Math.ceil(maxWaitMs / pollIntervalMs);

  for (let i = 0; i < maxAttempts; i++) {
    const status = await metaGraphRequest<{ status_code: string; id: string }>(
      `/${containerId}`,
      { params: { fields: "status_code", access_token: token } }
    );
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") {
      throw new Error("Instagram rejeitou a mídia ao criar o container (status: ERROR). Verifique se a URL da imagem está acessível publicamente.");
    }
    // "IN_PROGRESS" ou "PUBLISHED" — aguardar
    await new Promise<void>((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`Instagram container ${containerId} não ficou pronto após ${maxWaitMs / 1000}s. Tente novamente.`);
}

export async function publishToInstagram(
  post: SocialPost,
  integration: WorkspaceIntegration
): Promise<PublishResult> {
  try {
    const token = integration.accessToken;
    const igAccountId = integration.accountId;
    if (!token || !igAccountId) {
      return { success: false, error: "Instagram account not fully connected" };
    }

    const mediaUrls = post.mediaUrls as string[];
    const caption = buildCaption(post.caption, post.hashtags as string[]);

    if (post.postType === "carousel" && mediaUrls.length > 1) {
      // Create child containers
      const childIds: string[] = [];
      for (const url of mediaUrls) {
        const isVideo = /\.(mp4|mov|avi)$/i.test(url);
        const child = await metaGraphRequest<{ id: string }>(
          `/${igAccountId}/media`,
          {
            method: "POST",
            body: JSON.stringify({
              [isVideo ? "video_url" : "image_url"]: url,
              is_carousel_item: true,
              access_token: token,
            }),
          }
        );
        childIds.push(child.id);
      }
      // Create carousel container
      const container = await metaGraphRequest<{ id: string }>(
        `/${igAccountId}/media`,
        {
          method: "POST",
          body: JSON.stringify({
            media_type: "CAROUSEL",
            children: childIds.join(","),
            caption,
            access_token: token,
          }),
        }
      );
      // Aguardar container ficar pronto (obrigatório para não receber "Media ID is not available")
      await waitForInstagramContainer(container.id, token);
      // Publish
      const published = await metaGraphRequest<{ id: string }>(
        `/${igAccountId}/media_publish`,
        {
          method: "POST",
          body: JSON.stringify({
            creation_id: container.id,
            access_token: token,
          }),
        }
      );
      return {
        success: true,
        platformPostId: published.id,
        platformUrl: `https://www.instagram.com/p/${published.id}/`,
      };
    }

    // Single media
    const isVideo = post.postType === "reel" || post.postType === "feed_video";
    const mediaUrl = mediaUrls[0];
    if (!mediaUrl) return { success: false, error: "No media URL provided" };

    const body: Record<string, unknown> = {
      caption,
      access_token: token,
    };
    if (isVideo) {
      body["video_url"] = mediaUrl;
      body["media_type"] = post.postType === "reel" ? "REELS" : "VIDEO";
    } else if (post.postType === "story") {
      body["image_url"] = mediaUrl;
      body["media_type"] = "STORIES";
    } else {
      body["image_url"] = mediaUrl;
    }

    const container = await metaGraphRequest<{ id: string }>(
      `/${igAccountId}/media`,
      { method: "POST", body: JSON.stringify(body) }
    );

    // Aguardar container ficar pronto (obrigatório para imagens e vídeos)
    await waitForInstagramContainer(container.id, token);

    const published = await metaGraphRequest<{ id: string }>(
      `/${igAccountId}/media_publish`,
      {
        method: "POST",
        body: JSON.stringify({
          creation_id: container.id,
          access_token: token,
        }),
      }
    );

    // Stories use a different URL scheme; carousel/feed use /p/
    const platformUrl =
      post.postType === "story"
        ? null // Story URLs require the username which we don't have here; link will be absent
        : `https://www.instagram.com/p/${published.id}/`;

    return {
      success: true,
      platformPostId: published.id,
      platformUrl: platformUrl ?? undefined,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    logger.error({ err, postId: post.id }, "Instagram publish failed");
    // Meta permission/auth errors → mensagem acionável em vez de texto técnico da API
    const isPermissionError =
      /does not exist|missing permissions|OAuthException|invalid token|token|Invalid OAuth/i.test(raw);
    const msg = isPermissionError
      ? `Conta Instagram desconectada ou token expirado. Reconecte em /integracoes para voltar a publicar. (Detalhe técnico: ${raw})`
      : raw;
    return { success: false, error: msg };
  }
}

export async function publishToFacebook(
  post: SocialPost,
  integration: WorkspaceIntegration
): Promise<PublishResult> {
  try {
    const token = integration.accessToken;
    const pageId = integration.accountId;
    if (!token || !pageId) {
      return { success: false, error: "Facebook page not fully connected" };
    }

    const caption = buildCaption(post.caption, post.hashtags as string[]);
    const mediaUrls = post.mediaUrls as string[];

    let endpoint = `/${pageId}/feed`;
    const body: Record<string, unknown> = {
      message: caption,
      access_token: token,
    };

    if (mediaUrls.length === 1 && post.postType === "feed_image") {
      endpoint = `/${pageId}/photos`;
      body["url"] = mediaUrls[0];
      body["caption"] = caption;
      delete body["message"];
    } else if (
      post.postType === "feed_video" ||
      post.postType === "reel"
    ) {
      endpoint = `/${pageId}/videos`;
      body["file_url"] = mediaUrls[0];
      body["description"] = caption;
      delete body["message"];
    } else if (post.linkUrl) {
      body["link"] = post.linkUrl;
    }

    const result = await metaGraphRequest<{ id: string }>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      success: true,
      platformPostId: result.id,
      platformUrl: `https://www.facebook.com/${result.id}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, postId: post.id }, "Facebook publish failed");
    const isPermissionError =
      /does not exist|missing permissions|OAuthException|invalid token|token|Invalid OAuth/i.test(msg);
    return {
      success: false,
      error: isPermissionError
        ? `Página Facebook desconectada ou token expirado. Reconecte em /integracoes para voltar a publicar. (Detalhe técnico: ${msg})`
        : msg,
    };
  }
}

export async function getInstagramMetrics(
  platformPostId: string,
  accessToken: string
): Promise<MetricsResult> {
  try {
    const data = await metaGraphRequest<{
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    }>(`/${platformPostId}/insights`, {
      params: {
        metric:
          "impressions,reach,likes,comments,shares,saved,video_views,clicks",
        access_token: accessToken,
      },
    });

    const get = (name: string) => {
      const item = data.data.find((d) => d.name === name);
      return item?.values?.[0]?.value ?? 0;
    };

    return {
      likes: get("likes"),
      comments: get("comments"),
      shares: get("shares"),
      views: get("video_views"),
      reach: get("reach"),
      impressions: get("impressions"),
      clicks: get("clicks"),
    };
  } catch {
    return {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
    };
  }
}

// ─── TikTok ──────────────────────────────────────────────────────────────────

export async function publishToTikTok(
  post: SocialPost,
  integration: WorkspaceIntegration
): Promise<PublishResult> {
  try {
    const token = integration.accessToken;
    if (!token) {
      return { success: false, error: "TikTok account not connected" };
    }

    const mediaUrls = post.mediaUrls as string[];
    const videoUrl = mediaUrls[0];
    if (!videoUrl) return { success: false, error: "No video URL provided" };

    const caption = buildCaption(post.caption, post.hashtags as string[]);

    // TikTok Content Posting API v2
    const initRes = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: caption.slice(0, 150),
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
        }),
      }
    );

    const initData = (await initRes.json()) as {
      data?: { publish_id?: string };
      error?: { message: string };
    };

    if (!initRes.ok || initData.error) {
      return {
        success: false,
        error: initData.error?.message ?? `TikTok API error ${initRes.status}`,
      };
    }

    const publishId = initData.data?.publish_id;
    if (!publishId) return { success: false, error: "TikTok: no publish_id" };

    return {
      success: true,
      platformPostId: publishId,
      platformUrl: `https://www.tiktok.com/`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, postId: post.id }, "TikTok publish failed");
    return { success: false, error: msg };
  }
}

export async function getTikTokMetrics(
  publishId: string,
  accessToken: string
): Promise<MetricsResult> {
  try {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ publish_id: publishId }),
      }
    );
    const data = (await res.json()) as {
      data?: {
        status?: string;
        publicaly_available_post_id?: string[];
      };
    };

    const videoId = data.data?.publicaly_available_post_id?.[0];
    if (!videoId) return zeroMetrics();

    const statsRes = await fetch(
      `https://open.tiktokapis.com/v2/video/query/?fields=like_count,comment_count,share_count,view_count`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          filters: { video_ids: [videoId] },
        }),
      }
    );

    const statsData = (await statsRes.json()) as {
      data?: {
        videos?: Array<{
          like_count?: number;
          comment_count?: number;
          share_count?: number;
          view_count?: number;
        }>;
      };
    };

    const v = statsData.data?.videos?.[0];
    if (!v) return zeroMetrics();

    return {
      likes: v.like_count ?? 0,
      comments: v.comment_count ?? 0,
      shares: v.share_count ?? 0,
      views: v.view_count ?? 0,
      reach: v.view_count ?? 0,
      impressions: v.view_count ?? 0,
      clicks: 0,
    };
  } catch {
    return zeroMetrics();
  }
}

// ─── WhatsApp Business ────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  post: SocialPost,
  integration: WorkspaceIntegration,
  recipientPhone: string
): Promise<PublishResult> {
  try {
    const token = integration.accessToken;
    const phoneNumberId = (integration.metadata as Record<string, string>)?.phoneNumberId;
    if (!token || !phoneNumberId) {
      return { success: false, error: "WhatsApp Business not fully configured" };
    }

    const mediaUrls = post.mediaUrls as string[];
    const hasMedia = mediaUrls.length > 0;

    let body: Record<string, unknown>;

    if (hasMedia) {
      const url = mediaUrls[0]!;
      const isVideo = /\.(mp4|mov)$/i.test(url);
      body = {
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: isVideo ? "video" : "image",
        [isVideo ? "video" : "image"]: {
          link: url,
          caption: post.caption ?? "",
        },
      };
    } else {
      body = {
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: post.caption ?? "" },
      };
    }

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error?.message ?? `WhatsApp API error ${res.status}`,
      };
    }

    const msgId = data.messages?.[0]?.id;
    return { success: true, platformPostId: msgId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, postId: post.id }, "WhatsApp send failed");
    return { success: false, error: msg };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCaption(caption: string | null, hashtags: string[]): string {
  const base = caption ?? "";
  if (!hashtags.length) return base;
  const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return `${base}\n\n${tags}`;
}

function zeroMetrics(): MetricsResult {
  return {
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
    reach: 0,
    impressions: 0,
    clicks: 0,
  };
}

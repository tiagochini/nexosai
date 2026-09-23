import { logger } from "../../lib/logger.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";
import type { SocialPost, WorkspaceIntegration } from "@workspace/db";

export type PublishResult = {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
  /** HTTP status is retained for deterministic retry classification only. */
  statusCode?: number;
  ambiguous?: boolean;
  pending?: boolean;
  definitiveRejected?: boolean;
};

export type SocialCredentialFailureKind =
  | "invalid_credential"
  | "invalid_account"
  | "invalid_permission"
  | "transient";

export type SocialCredentialReadiness =
  | { ok: true }
  | {
      ok: false;
      kind: SocialCredentialFailureKind;
      statusCode?: number;
      error: string;
      /** The persisted integration status to use for terminal failures. */
      integrationStatus?: "expired" | "error";
    };

const expectedProviderForPlatform: Partial<Record<SocialPost["platform"], string>> = {
  instagram: "instagram",
  facebook_page: "meta_ads",
  tiktok: "tiktok_ads",
};

export function classifyProbeFailure(
  statusCode: number | undefined,
  error: string,
): SocialCredentialReadiness {
  if (statusCode === 408 || statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
    return {
      ok: false,
      kind: "transient",
      statusCode,
      error: "credential_probe_temporarily_unavailable",
    };
  }
  const normalized = error.toLowerCase();
  if (normalized.includes("permission")) {
    return {
      ok: false,
      kind: "invalid_permission",
      statusCode,
      error: "credential_probe_missing_permission",
      integrationStatus: "error",
    };
  }
  if (normalized.includes("account") || normalized.includes("mismatch")) {
    return {
      ok: false,
      kind: "invalid_account",
      statusCode,
      error: "credential_probe_account_mismatch",
      integrationStatus: "error",
    };
  }
  return {
    ok: false,
    kind: "invalid_credential",
    statusCode,
    error: "credential_probe_rejected",
    integrationStatus: "expired",
  };
}

/**
 * Canonical fail-closed gate for every social provider mutation.
 *
 * Callers still own workspace-scoped integration selection and persistence of
 * the resulting status. This function never includes token material in its
 * result or logs and performs the provider probe only after all local checks.
 */
export async function checkSocialCredentialReadiness(
  platform: SocialPost["platform"],
  integration: WorkspaceIntegration | null | undefined,
): Promise<SocialCredentialReadiness> {
  if (!integration) {
    return {
      ok: false,
      kind: "invalid_account",
      error: "credential_integration_missing",
      integrationStatus: "error",
    };
  }
  const expectedProvider = expectedProviderForPlatform[platform];
  if (!expectedProvider || integration.provider !== expectedProvider) {
    return {
      ok: false,
      kind: "invalid_account",
      error: "credential_integration_provider_mismatch",
      integrationStatus: "error",
    };
  }
  if (integration.status !== "connected") {
    return {
      ok: false,
      kind: "invalid_credential",
      error: "credential_integration_not_connected",
      integrationStatus: integration.status === "expired" ? "expired" : "error",
    };
  }
  if (!integration.accessToken?.trim() || !integration.accountId?.trim()) {
    return {
      ok: false,
      kind: "invalid_credential",
      error: "credential_integration_credentials_missing",
      integrationStatus: "error",
    };
  }
  if (integration.tokenExpiresAt && integration.tokenExpiresAt <= new Date()) {
    return {
      ok: false,
      kind: "invalid_credential",
      error: "credential_integration_expired",
      integrationStatus: "expired",
    };
  }

  try {
    const probe = await probeSocialIntegration(platform, integration);
    if (probe.ok) return { ok: true };
    return classifyProbeFailure(probe.statusCode, probe.error ?? "provider_probe_failed");
  } catch (error) {
    const statusCode =
      error instanceof ProviderOutcomeError ? error.statusCode
        : typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode) || undefined
          : undefined;
    return classifyProbeFailure(statusCode, "provider_probe_failed");
  }
}
export class ProviderOutcomeError extends Error {
  constructor(message: string, readonly statusCode?: number, readonly ambiguous = false) { super(message); }
}
export function classifyProviderError(error: unknown): Pick<PublishResult, "ambiguous" | "statusCode" | "definitiveRejected"> {
  if (error instanceof ProviderOutcomeError) {
    return {
      ambiguous: error.ambiguous,
      statusCode: error.statusCode,
      definitiveRejected: Boolean(error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && !error.ambiguous),
    };
  }
  return { ambiguous: true };
}
export async function persistPostMutationStage(
  callback: PublishOptions["onStage"],
  stage: { name: string; providerId?: string },
): Promise<void> {
  try {
    await callback?.(stage);
  } catch {
    throw new ProviderOutcomeError("Provider mutation stage persistence failed", undefined, true);
  }
}
export function requireProviderId(id: unknown, provider: string): asserts id is string {
  if (typeof id !== "string" || id.length === 0) {
    throw new ProviderOutcomeError(`${provider} mutation returned no provider id`, undefined, true);
  }
}
export type PublishOptions = {
  attemptKey?: string;
  onStage?: (stage: { name: string; providerId?: string; intent?: boolean }) => Promise<void>;
};

export type ProviderReadback = {
  confirmed: boolean;
  pending?: boolean;
  platformPostId?: string;
  platformUrl?: string;
  accountId?: string;
};

/** Credential/permission probe. It deliberately returns no provider payload. */
export async function probeSocialIntegration(
  platform: SocialPost["platform"],
  integration: WorkspaceIntegration,
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  if (!integration.accessToken || !integration.accountId) return { ok: false, error: "integration_credentials_missing" };
  if (platform === "instagram" || platform === "facebook_page") {
    const metadata = (integration.metadata ?? {}) as Record<string, unknown>;
    const pageId = typeof metadata.pageId === "string" ? metadata.pageId : undefined;
    const probeId = platform === "instagram" && pageId ? pageId : integration.accountId;
    const fields = platform === "instagram" && pageId ? "id,instagram_business_account" : "id";
    const response = await metaGraphFetch(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(probeId)}?fields=${fields}&access_token=${encodeURIComponent(integration.accessToken)}`,
    );
    if (!response.ok) return { ok: false, statusCode: response.status, error: "provider_probe_failed" };
    const body = await response.json() as { instagram_business_account?: { id?: string } };
    if (platform === "instagram" && pageId) {
      if (body.instagram_business_account?.id !== integration.accountId) {
        return { ok: false, error: "integration_account_mismatch" };
      }
    }
    const permissionsResponse = await metaGraphFetch(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(pageId ?? integration.accountId!)}?fields=tasks&access_token=${encodeURIComponent(integration.accessToken)}`,
    );
    if (!permissionsResponse.ok) return { ok: false, statusCode: permissionsResponse.status, error: "provider_permissions_unproven" };
    const permissionsBody = await permissionsResponse.json() as { tasks?: string[] };
    const tasks = permissionsBody.tasks;
    const required = platform === "instagram"
      ? ["MANAGE"] : ["CREATE_CONTENT"];
    if (!tasks || required.some((name) => !tasks.some((task) => task.toUpperCase() === name))) {
      return { ok: false, error: "provider_permissions_unproven" };
    }
    return { ok: true };
  }
  if (platform === "tiktok") {
    const response = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id", {
      headers: { Authorization: `Bearer ${integration.accessToken}` },
    });
    if (!response.ok) return { ok: false, statusCode: response.status, error: "provider_probe_failed" };
    const body = await response.json() as { data?: { user?: { open_id?: string } } };
    if (!body.data?.user?.open_id) {
      return { ok: false, error: "integration_account_unproven" };
    }
    if (body.data.user.open_id !== integration.accountId) {
      return { ok: false, error: "integration_account_mismatch" };
    }

    // user.info only proves identity. The publish adapter requires the
    // Content Posting API, so positively prove creator authorization before
    // allowing any mutation. A successful response without creator metadata
    // is deliberately treated as missing permission.
    const creatorResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    if (!creatorResponse.ok) {
      return { ok: false, statusCode: creatorResponse.status, error: "provider_permissions_unproven" };
    }
    const creatorBody = await creatorResponse.json() as {
      data?: { privacy_level_options?: string[] };
    };
    if (!creatorBody.data?.privacy_level_options?.length) {
      return { ok: false, error: "provider_permissions_unproven" };
    }
  }
  return { ok: true };
}

/** Independent readback; a submit receipt alone never confirms publication. */
export async function readBackSocialPost(
  platform: SocialPost["platform"],
  integration: WorkspaceIntegration,
  providerPostId: string,
  postType?: SocialPost["postType"],
): Promise<ProviderReadback> {
  if ((platform === "instagram" || platform === "facebook_page") && integration.accessToken) {
    if (platform === "instagram") {
      const response = await metaGraphFetch(
        `https://graph.facebook.com/v22.0/${encodeURIComponent(integration.accountId!)}\/${postType === "story" ? "stories" : "media"}?fields=id,permalink&limit=100&access_token=${encodeURIComponent(integration.accessToken)}`,
      );
      if (!response.ok) return { confirmed: false, pending: response.status === 404 || response.status === 408 || response.status === 429 || response.status >= 500 };
      const body = await response.json() as { data?: Array<{ id?: string; permalink?: string }> };
      const match = body.data?.find((item) => item.id === providerPostId);
      return match ? { confirmed: true, platformPostId: match.id, platformUrl: match.permalink } : { confirmed: false, pending: true };
    }
    const response = await metaGraphFetch(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(providerPostId)}?fields=id,from,permalink_url&access_token=${encodeURIComponent(integration.accessToken)}`,
    );
    if (!response.ok) return { confirmed: false, pending: response.status === 404 || response.status === 408 || response.status === 429 || response.status >= 500 };
    const body = await response.json() as { id?: string; from?: { id?: string }; permalink_url?: string };
    const accountId = body.from?.id;
    return {
      confirmed: body.id === providerPostId && accountId === integration.accountId,
      pending: !body.id,
      platformPostId: body.id,
      platformUrl: body.permalink_url,
      accountId,
    };
  }
  // TikTok's publish status endpoint is the provider-supported readback.
  if (platform === "tiktok" && integration.accessToken) {
    for (let i = 0; i < 6; i++) {
      const response = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
        method: "POST",
        headers: { Authorization: `Bearer ${integration.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ publish_id: providerPostId }),
      });
      if (!response.ok) return { confirmed: false, pending: response.status === 408 || response.status === 429 || response.status >= 500 };
      const body = await response.json() as { data?: { status?: string; publicaly_available_post_id?: string[] } };
      const status = body.data?.status?.toUpperCase();
      const videoId = body.data?.publicaly_available_post_id?.[0];
      if (status === "PUBLISH_COMPLETE" && videoId) {
        return { confirmed: true, platformPostId: videoId, platformUrl: `https://www.tiktok.com/` };
      }
      if (["FAILED", "PUBLISH_FAILED"].includes(status ?? "")) return { confirmed: false };
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return platform === "tiktok" ? { confirmed: false, pending: true } : { confirmed: false };
}

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
  let res: Response;
  try {
    res = await metaGraphFetch(url.toString(), {
      ...fetchOptions,
      headers: { "Content-Type": "application/json", ...fetchOptions.headers },
    });
  } catch (error) {
    throw new ProviderOutcomeError("Meta mutation transport failed", undefined, true);
  }
  let data: T & { error?: { message: string } };
  try {
    data = await res.json() as T & { error?: { message: string } };
  } catch {
    if (fetchOptions.method === "POST") throw new ProviderOutcomeError("Meta mutation response was not parseable", res.status, true);
    throw new ProviderOutcomeError("Meta response was not parseable", res.status, false);
  }
  if (!res.ok || (data as { error?: { message: string } }).error) {
    const msg =
      (data as { error?: { message: string } }).error?.message ??
      `Meta API error ${res.status}`;
    throw new ProviderOutcomeError(msg, res.status, res.status === 408 || res.status === 429 || res.status >= 500);
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
  // Vídeos (Reels, VIDEO) levam até 5 minutos para processar no Instagram.
  // Imagens geralmente ficam prontas em 2-5s.
  const pollIntervalMs = 3_000;
  const maxAttempts = Math.ceil(maxWaitMs / pollIntervalMs);

  for (let i = 0; i < maxAttempts; i++) {
    const status = await metaGraphRequest<{ status_code: string; id: string }>(
      `/${containerId}`,
      { params: { fields: "status_code", access_token: token } }
    );
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") {
      throw new Error("Instagram rejeitou a mídia ao criar o container (status: ERROR). Verifique se a URL da imagem/vídeo está acessível publicamente.");
    }
    // "IN_PROGRESS" ou "PUBLISHED" — aguardar
    await new Promise<void>((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`Instagram container ${containerId} não ficou pronto após ${maxWaitMs / 1000}s. Tente novamente.`);
}

export async function publishToInstagram(
  post: SocialPost,
  integration: WorkspaceIntegration,
  options?: PublishOptions,
): Promise<PublishResult> {
  try {
    const token = integration.accessToken;
    const igAccountId = integration.accountId;
    if (!token || !igAccountId) {
      return { success: false, error: "Instagram account not fully connected" };
    }

    const mediaUrls = post.mediaUrls as string[];
    const caption = buildCaption(post.caption, post.hashtags as string[]);

    if (post.postType === "carousel") {
      if (mediaUrls.length < 2 || mediaUrls.length > 10) {
        return { success: false, error: "Instagram carousels require between 2 and 10 media items." };
      }
      // Create child containers
      const childIds: string[] = [];
      for (const url of mediaUrls) {
        await options?.onStage?.({ name: "child_container_intent", intent: true });
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
        requireProviderId(child.id, "Instagram child container");
        childIds.push(child.id);
        // A carousel parent can only reference children once each is processed.
        await waitForInstagramContainer(
          child.id,
          token,
          isVideo ? 300_000 : 30_000,
        );
      }
      // Create carousel container
      await options?.onStage?.({ name: "parent_container_intent", intent: true });
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
      requireProviderId(container.id, "Instagram container");
      await persistPostMutationStage(options?.onStage, { name: "container_created", providerId: container.id });
      // Aguardar container ficar pronto (obrigatório para não receber "Media ID is not available")
      await waitForInstagramContainer(container.id, token);
      // Publish
      await options?.onStage?.({ name: "media_publish_intent", intent: true });
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
      requireProviderId(published.id, "Instagram media publish");
      await persistPostMutationStage(options?.onStage, { name: "media_published", providerId: published.id });
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

    // For story posts, detect image vs video by URL extension so video-mode stories
    // use video_url (not image_url) while still targeting the STORIES media_type.
    const isStoryVideoUrl = post.postType === "story" && /\.(mp4|mov|avi|webm)(\?|$)/i.test(mediaUrl);

    const body: Record<string, unknown> = {
      caption,
      access_token: token,
    };
    if (isVideo) {
      body["video_url"] = mediaUrl;
      body["media_type"] = post.postType === "reel" ? "REELS" : "VIDEO";
    } else if (post.postType === "story") {
      if (isStoryVideoUrl) {
        body["video_url"] = mediaUrl;
      } else {
        body["image_url"] = mediaUrl;
      }
      body["media_type"] = "STORIES";
    } else {
      body["image_url"] = mediaUrl;
    }

    await options?.onStage?.({ name: "container_created_intent", intent: true });
    const container = await metaGraphRequest<{ id: string }>(
      `/${igAccountId}/media`,
      { method: "POST", body: JSON.stringify(body) }
    );
    requireProviderId(container.id, "Instagram container");
    await persistPostMutationStage(options?.onStage, { name: "container_created", providerId: container.id });

    // Vídeos (Reels, feed_video, story-video) precisam de até 5 min para processar no Instagram.
    // Imagens ficam prontas em segundos — mantemos 30s como fallback seguro.
    const containerWaitMs = (isVideo || isStoryVideoUrl) ? 300_000 : 30_000;
    await waitForInstagramContainer(container.id, token, containerWaitMs);

    await options?.onStage?.({ name: "media_publish_intent", intent: true });
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
    requireProviderId(published.id, "Instagram media publish");
    await persistPostMutationStage(options?.onStage, { name: "media_published", providerId: published.id });

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
    const outcome = err instanceof ProviderOutcomeError ? err : undefined;
    logger.error({ err, postId: post.id }, "Instagram publish failed");
    // Meta permission/auth errors → mensagem acionável em vez de texto técnico da API
    const isPermissionError =
      /does not exist|missing permissions|OAuthException|invalid token|token|Invalid OAuth/i.test(raw);
    const msg = isPermissionError
      ? `Conta Instagram desconectada ou token expirado. Reconecte em /integracoes para voltar a publicar. (Detalhe técnico: ${raw})`
      : raw;
    return { success: false, error: msg, statusCode: outcome?.statusCode, ambiguous: outcome?.ambiguous || /lease|stage persistence/i.test(msg), definitiveRejected: Boolean(outcome?.statusCode && outcome.statusCode >= 400 && outcome.statusCode < 500 && !outcome.ambiguous) };
  }
}

export async function publishToFacebook(
  post: SocialPost,
  integration: WorkspaceIntegration,
  options?: PublishOptions,
): Promise<PublishResult> {
  try {
    const token = integration.accessToken;
    const pageId = integration.accountId;
    if (!token || !pageId) {
      return { success: false, error: "Facebook page not fully connected" };
    }

    const caption = buildCaption(post.caption, post.hashtags as string[]);
    const mediaUrls = post.mediaUrls as string[];

    if (post.postType === "carousel") {
      if (mediaUrls.length < 2 || mediaUrls.length > 10) {
        return { success: false, error: "Facebook albums require between 2 and 10 media items." };
      }

      // Facebook albums are published by first creating unpublished page photos,
      // then attaching their media IDs to one feed post. This preserves slide order.
      const photoIds: string[] = [];
      for (const url of mediaUrls) {
        await options?.onStage?.({ name: "unpublished_photo_intent", intent: true });
        const photo = await metaGraphRequest<{ id: string }>(`/${pageId}/photos`, {
          method: "POST",
          body: JSON.stringify({
            url,
            published: false,
            access_token: token,
          }),
        });
        requireProviderId(photo.id, "Facebook photo");
        await persistPostMutationStage(options?.onStage, { name: "unpublished_photo_created", providerId: photo.id });
        photoIds.push(photo.id);
      }
      await options?.onStage?.({ name: "feed_publish_intent", intent: true });
      const result = await metaGraphRequest<{ id: string }>(`/${pageId}/feed`, {
        method: "POST",
        body: JSON.stringify({
          message: caption,
          attached_media: photoIds.map((media_fbid) => ({ media_fbid })),
          access_token: token,
        }),
      });
      requireProviderId(result.id, "Facebook feed");
      await persistPostMutationStage(options?.onStage, { name: "published", providerId: result.id });
      return {
        success: true,
        platformPostId: result.id,
        platformUrl: `https://www.facebook.com/${result.id}`,
      };
    }

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

    await options?.onStage?.({ name: "publish_intent", intent: true });
    const result = await metaGraphRequest<{ id: string }>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    requireProviderId(result.id, "Facebook publish");
    await persistPostMutationStage(options?.onStage, { name: "published", providerId: result.id });

    return {
      success: true,
      platformPostId: result.id,
      platformUrl: `https://www.facebook.com/${result.id}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const outcome = err instanceof ProviderOutcomeError ? err : undefined;
    logger.error({ err, postId: post.id }, "Facebook publish failed");
    const isPermissionError =
      /does not exist|missing permissions|OAuthException|invalid token|token|Invalid OAuth/i.test(msg);
    return {
      success: false,
        error: isPermissionError
        ? `Página Facebook desconectada ou token expirado. Reconecte em /integracoes para voltar a publicar. (Detalhe técnico: ${msg})`
        : msg,
        statusCode: outcome?.statusCode,
        ambiguous: outcome?.ambiguous || /lease|stage persistence/i.test(msg),
        definitiveRejected: Boolean(outcome?.statusCode && outcome.statusCode >= 400 && outcome.statusCode < 500 && !outcome.ambiguous),
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
  } catch (error) {
    if (error instanceof ProviderOutcomeError) throw error;
    throw new ProviderOutcomeError("Instagram metrics request failed", undefined, true);
  }
}

// ─── TikTok ──────────────────────────────────────────────────────────────────

export async function publishToTikTok(
  post: SocialPost,
  integration: WorkspaceIntegration,
  options?: PublishOptions,
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
    await options?.onStage?.({ name: "publish_init_intent", intent: true });
    let initRes: Response;
    try {
      initRes = await fetch(
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
    } catch {
      return { success: false, error: "TikTok mutation transport failed", ambiguous: true };
    }

    let initData: {
      data?: { publish_id?: string };
      error?: { message: string };
    };
    try {
      initData = await initRes.json() as typeof initData;
    } catch {
      return { success: false, error: "TikTok mutation response was not parseable", statusCode: initRes.status, ambiguous: true };
    }

    if (!initRes.ok || initData.error) {
      return {
        success: false,
        error: initData.error?.message ?? `TikTok API error ${initRes.status}`,
        statusCode: initRes.status,
        ambiguous: initRes.status === 408 || initRes.status === 429 || initRes.status >= 500,
        definitiveRejected: initRes.status >= 400 && initRes.status < 500 && ![408, 429].includes(initRes.status),
      };
    }

    const publishId = initData.data?.publish_id;
    requireProviderId(publishId, "TikTok publish init");
    await persistPostMutationStage(options?.onStage, { name: "publish_initialized", providerId: publishId });

    return {
      success: true,
      platformPostId: publishId,
      platformUrl: `https://www.tiktok.com/`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const outcome = err instanceof ProviderOutcomeError ? err : undefined;
    logger.error({ err, postId: post.id }, "TikTok publish failed");
    return { success: false, error: msg, statusCode: outcome?.statusCode, ambiguous: outcome?.ambiguous || /lease|stage persistence/i.test(msg), definitiveRejected: Boolean(outcome?.statusCode && outcome.statusCode >= 400 && outcome.statusCode < 500 && !outcome.ambiguous) };
  }
}

export async function getTikTokMetrics(
  publishId: string,
  accessToken: string
): Promise<MetricsResult> {
  try {
    const res = await metaGraphFetch(
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
    if (!res.ok) {
      throw new ProviderOutcomeError("TikTok metrics request rejected", res.status, res.status === 408 || res.status === 429 || res.status >= 500);
    }
    const data = (await res.json()) as {
      data?: {
        status?: string;
        publicaly_available_post_id?: string[];
      };
    };

    const videoId = data.data?.publicaly_available_post_id?.[0];
    if (!videoId) {
      throw new ProviderOutcomeError("TikTok metrics response missing published video id");
    }

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
    if (!statsRes.ok) {
      throw new ProviderOutcomeError("TikTok metrics stats request rejected", statsRes.status, statsRes.status === 408 || statsRes.status === 429 || statsRes.status >= 500);
    }

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
    if (!v) {
      throw new ProviderOutcomeError("TikTok metrics response missing video statistics");
    }

    return {
      likes: v.like_count ?? 0,
      comments: v.comment_count ?? 0,
      shares: v.share_count ?? 0,
      views: v.view_count ?? 0,
      reach: v.view_count ?? 0,
      impressions: v.view_count ?? 0,
      clicks: 0,
    };
    } catch (error) {
      if (error instanceof ProviderOutcomeError) throw error;
      throw new ProviderOutcomeError("TikTok metrics request failed", undefined, true);
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

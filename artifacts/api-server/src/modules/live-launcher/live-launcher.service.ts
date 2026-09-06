import { eq, and } from "drizzle-orm";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";

export interface LiveSession {
  id: string;
  workspaceId: string;
  igUserId: string;
  broadcastId: string | null;
  streamUrl: string | null;
  streamKey: string | null;
  status: "scheduled" | "broadcast_ready" | "live" | "ended" | "error";
  scheduledAt: Date;
  firedAt: Date | null;
  title: string;
  description: string;
  linkedCampaignId: string | null;
  redirectUrl: string | null;
  metadata: Record<string, unknown>;
}

// In-memory registry of scheduled live sessions (persists across restarts via DB in prod)
const scheduledSessions = new Map<string, ReturnType<typeof setTimeout>>();

export async function getInstagramAccessToken(workspaceId: string): Promise<{ accessToken: string; igUserId: string } | null> {
  const [integration] = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, "instagram"),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    )
    .limit(1);

  if (!integration?.accessToken) return null;
  const meta = integration.metadata as Record<string, unknown>;
  const igUserId = (meta?.igUserId ?? integration.accountId) as string | undefined;
  if (!igUserId) return null;
  return { accessToken: integration.accessToken, igUserId };
}

export async function createInstagramBroadcast(
  accessToken: string,
  igUserId: string,
  title: string,
  description: string,
): Promise<{ broadcastId: string; streamUrl: string; streamKey: string } | null> {
  try {
    const res = await metaGraphFetch(
      `https://graph.facebook.com/v20.0/${igUserId}/live_videos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          status: "SCHEDULED_UNPUBLISHED",
          access_token: accessToken,
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      logger.warn({ err, igUserId }, "live-launcher: failed to create IG broadcast");
      return null;
    }
    const data = (await res.json()) as { id: string; stream_url: string; secure_stream_url: string };
    // stream_url contains rtmp://.../{stream-key} — split it
    const parts = (data.secure_stream_url ?? data.stream_url ?? "").split("/");
    const streamKey = parts.pop() ?? "";
    const streamUrl = parts.join("/");
    return { broadcastId: data.id, streamUrl, streamKey };
  } catch (err) {
    logger.error({ err }, "live-launcher: IG broadcast creation exception");
    return null;
  }
}

export async function goLiveOnInstagram(
  accessToken: string,
  broadcastId: string,
): Promise<boolean> {
  try {
    const res = await metaGraphFetch(
      `https://graph.facebook.com/v20.0/${broadcastId}?status=LIVE&access_token=${accessToken}`,
      { method: "POST" },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function endInstagramBroadcast(
  accessToken: string,
  broadcastId: string,
): Promise<boolean> {
  try {
    const res = await metaGraphFetch(
      `https://graph.facebook.com/v20.0/${broadcastId}?status=VOD&access_token=${accessToken}`,
      { method: "POST" },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function postBroadcastComment(
  accessToken: string,
  broadcastId: string,
  message: string,
): Promise<void> {
  try {
    await metaGraphFetch(`https://graph.facebook.com/v20.0/${broadcastId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: accessToken }),
    });
  } catch { /* fire-and-forget */ }
}

export interface ScheduleLiveOptions {
  workspaceId: string;
  campaignId?: string;
  title: string;
  description: string;
  delayMs: number; // ms from now to fire
  redirectUrl?: string; // sent as comment when live ends
  durationMs?: number; // how long the broadcast runs (default 5 min)
}

export type LiveLaunchResult = {
  sessionId: string;
  scheduledAt: Date;
  firesInMs: number;
  broadcastId: string | null;
  streamUrl: string | null;
  streamKey: string | null;
  message: string;
};

export async function scheduleLiveLaunch(opts: ScheduleLiveOptions): Promise<LiveLaunchResult> {
  const creds = await getInstagramAccessToken(opts.workspaceId);
  const sessionId = `live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const scheduledAt = new Date(Date.now() + opts.delayMs);
  const durationMs = opts.durationMs ?? 5 * 60 * 1000;

  let broadcastId: string | null = null;
  let streamUrl: string | null = null;
  let streamKey: string | null = null;

  // Pre-create the broadcast so host has RTMP credentials ready
  if (creds) {
    const broadcast = await createInstagramBroadcast(
      creds.accessToken,
      creds.igUserId,
      opts.title,
      opts.description,
    );
    if (broadcast) {
      broadcastId = broadcast.broadcastId;
      streamUrl = broadcast.streamUrl;
      streamKey = broadcast.streamKey;
    }
  }

  const capturedBroadcastId = broadcastId;
  const capturedCreds = creds;

  // Schedule the "go live" trigger
  const timer = setTimeout(async () => {
    logger.info({ sessionId, campaignId: opts.campaignId }, "live-launcher: firing scheduled live");
    scheduledSessions.delete(sessionId);

    if (capturedCreds && capturedBroadcastId) {
      await goLiveOnInstagram(capturedCreds.accessToken, capturedBroadcastId);

      // After durationMs, end the broadcast and drop redirect link comment
      setTimeout(async () => {
        if (opts.redirectUrl) {
          await postBroadcastComment(
            capturedCreds.accessToken,
            capturedBroadcastId,
            `🔴 CONTINUA AO VIVO AQUI: ${opts.redirectUrl}\nNossa live principal está rolando agora — venha ver os agentes construindo uma campanha completa em 90 minutos!`,
          );
        }
        await endInstagramBroadcast(capturedCreds.accessToken, capturedBroadcastId);
        logger.info({ sessionId }, "live-launcher: IG broadcast ended, redirect comment posted");
      }, durationMs);
    } else {
      logger.warn({ sessionId }, "live-launcher: no IG credentials — broadcast not started");
    }
  }, opts.delayMs);

  scheduledSessions.set(sessionId, timer);

  return {
    sessionId,
    scheduledAt,
    firesInMs: opts.delayMs,
    broadcastId,
    streamUrl,
    streamKey,
    message: creds
      ? `Live agendada. Broadcast criado no Instagram. Configure seu OBS com as credenciais RTMP e fique pronto para ir ao ar em ${Math.round(opts.delayMs / 60000)} minutos.`
      : `Live agendada (sem integração Instagram conectada — conecte em Integrações para ativar o broadcast automático).`,
  };
}

export function cancelScheduledLive(sessionId: string): boolean {
  const timer = scheduledSessions.get(sessionId);
  if (!timer) return false;
  clearTimeout(timer);
  scheduledSessions.delete(sessionId);
  return true;
}

export function listScheduledLives(): string[] {
  return Array.from(scheduledSessions.keys());
}

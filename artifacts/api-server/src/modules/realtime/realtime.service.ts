import { Server as SocketIOServer, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyAccessToken, type TokenPayload } from "../auth/auth.service.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../lib/env.js";
import { and, eq } from "drizzle-orm";
import { db, campaignsTable, workspacesTable } from "@workspace/db";
import { z } from "zod/v4";

const idSchema = z.string().uuid();
type RoomReply = (result: { ok: boolean; code?: string }) => void;

export function isRealtimeOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Non-browser clients still require authentication.
  const origins = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
  if (env.NODE_ENV !== "production") origins.push(new URL(env.APP_URL).origin);
  return origins.includes(origin);
}

let io: SocketIOServer | null = null;

export interface CampaignEvent {
  campaignId: string;
  type:
    | "agent_started"
    | "agent_thinking"
    | "agent_completed"
    | "agent_failed"
    | "agent_fallback_used"
    | "checkpoint_created"
    | "asset_generated"
    | "phase_changed"
    | "execution_update"
    | "campaign_completed"
    | "clarification_needed"
    | "clarification_answered"
    | "contract_violation"
    | "budget_proposal"
    | "budget_skip_warning"
    | "agent_warning";
  agentType?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export async function authorizeRealtimeCampaign(auth: TokenPayload, id: string): Promise<boolean> {
  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable)
    .innerJoin(workspacesTable, eq(workspacesTable.id, campaignsTable.workspaceId))
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, auth.workspaceId),
      eq(workspacesTable.ownerId, auth.userId), eq(workspacesTable.status, "active"))).limit(1);
  return !!campaign;
}

export function initRealtime(httpServer: HttpServer, authorizeCampaign = authorizeRealtimeCampaign): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: (origin, callback) => callback(null, isRealtimeOriginAllowed(origin)), methods: ["GET", "POST"] },
    // CORS alone does not protect WebSocket upgrades.
    allowRequest: (req, callback) => callback(null, isRealtimeOriginAllowed(req.headers.origin)),
    path: "/api/socket.io",
  });

  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth["token"] ??
      socket.handshake.headers["authorization"]?.replace("Bearer ", "");

    if (typeof token !== "string" || !token) {
      next(new Error("Authentication required"));
      return;
    }

    try {
      const payload = verifyAccessToken(token as string);
      if (!idSchema.safeParse(payload.userId).success || !idSchema.safeParse(payload.workspaceId).success) {
        throw new Error("Invalid claims");
      }
      const [workspace] = await db.select({ id: workspacesTable.id }).from(workspacesTable).where(and(
        eq(workspacesTable.id, payload.workspaceId), eq(workspacesTable.ownerId, payload.userId),
        eq(workspacesTable.status, "active"),
      )).limit(1);
      if (!workspace) throw new Error("Workspace unavailable");
      const exp = (payload as typeof payload & { exp?: number }).exp;
      if (typeof exp !== "number" || !Number.isFinite(exp) || exp * 1000 <= Date.now()) {
        throw new Error("Invalid expiration");
      }
      socket.data["auth"] = payload;
      socket.data["expiresAt"] = exp * 1000;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const auth = socket.data["auth"];
    const expiryTimer = setTimeout(() => socket.disconnect(true), Math.min(
      socket.data["expiresAt"] - Date.now(), 2_147_483_647,
    ));
    expiryTimer.unref();
    // A leave received during the authorization query cancels that join.
    const subscriptions = new Map<string, symbol>();
    logger.info({ userId: auth?.userId }, "WebSocket client connected");

    socket.on("join:campaign", async (campaignId: unknown, reply?: RoomReply) => {
      const respond = (ok: boolean, code?: string) => {
        if (typeof reply === "function") reply({ ok, ...(code ? { code } : {}) });
      };
      if (!idSchema.safeParse(campaignId).success) return respond(false, "INVALID_CAMPAIGN_ID");
      const id = campaignId as string;
      if (subscriptions.has(id)) {
        return socket.rooms.has(`campaign:${id}`) ? respond(true) : respond(false, "JOIN_PENDING");
      }
      if (!subscriptions.has(id) && subscriptions.size >= 50) return respond(false, "ROOM_LIMIT");
      const request = Symbol();
      subscriptions.set(id, request);
      try {
        const campaign = await authorizeCampaign(auth, id);
        // Foreign and nonexistent IDs have the same response, avoiding an existence oracle.
        if (!campaign) {
          if (subscriptions.get(id) === request) subscriptions.delete(id);
          return respond(false, "CAMPAIGN_NOT_FOUND");
        }
        if (!socket.connected || Date.now() >= socket.data["expiresAt"] || subscriptions.get(id) !== request) return respond(false, "JOIN_CANCELLED");
        await socket.join(`campaign:${id}`);
        // Also handle leave/disconnect while an asynchronous adapter joins.
        if (!socket.connected || subscriptions.get(id) !== request) {
          await socket.leave(`campaign:${id}`);
          return respond(false, "JOIN_CANCELLED");
        }
        respond(true);
      } catch {
        if (subscriptions.get(id) === request) subscriptions.delete(id);
        // Do not log a database error containing query parameters or credentials.
        logger.warn("Realtime campaign authorization failed");
        respond(false, "REALTIME_UNAVAILABLE");
      }
    });

    socket.on("leave:campaign", (campaignId: unknown, reply?: RoomReply) => {
      if (!idSchema.safeParse(campaignId).success) {
        if (typeof reply === "function") reply({ ok: false, code: "INVALID_CAMPAIGN_ID" });
        return;
      }
      subscriptions.delete(campaignId as string);
      socket.leave(`campaign:${campaignId}`);
      if (typeof reply === "function") reply({ ok: true });
    });

    socket.on("join:workspace", () => {
      if (auth?.workspaceId) {
        socket.join(`workspace:${auth.workspaceId}`);
      }
    });

    socket.on("disconnect", () => {
      clearTimeout(expiryTimer);
      subscriptions.clear();
      logger.info({ userId: auth?.userId }, "WebSocket client disconnected");
    });
  });

  logger.info("WebSocket (Socket.io) server initialized");
  return io;
}

export function emitCampaignEvent(event: CampaignEvent): void {
  if (!io) return;
  // RC-011: wrap in try/catch — Socket.io Redis adapter can throw synchronously
  // when Redis is rate-limited or unavailable. Never let a realtime emit kill the
  // DB-persistence pipeline. Campaign state lives in Postgres, not in Socket.io.
  try {
    io.to(`campaign:${event.campaignId}`).emit("campaign:event", event);
  } catch (err) {
    logger.warn(
      { err, campaignId: event.campaignId, eventType: event.type },
      "RC-011: emitCampaignEvent failed (Redis/Socket.io degraded) — suppressed. DB state is unaffected.",
    );
  }
}

export function emitAgentThinking(
  campaignId: string,
  agentType: string,
  thought: string,
): void {
  emitCampaignEvent({
    campaignId,
    type: "agent_thinking",
    agentType,
    message: thought,
    timestamp: new Date().toISOString(),
  });
}

export function emitAgentStarted(
  campaignId: string,
  agentType: string,
): void {
  emitCampaignEvent({
    campaignId,
    type: "agent_started",
    agentType,
    message: `${agentType} agent activated`,
    timestamp: new Date().toISOString(),
  });
}

export function emitAgentCompleted(
  campaignId: string,
  agentType: string,
  summary?: string,
): void {
  emitCampaignEvent({
    campaignId,
    type: "agent_completed",
    agentType,
    message: summary ?? `${agentType} agent completed`,
    timestamp: new Date().toISOString(),
  });
}

export function emitCheckpointCreated(
  campaignId: string,
  checkpointType: string,
  data: Record<string, unknown>,
): void {
  emitCampaignEvent({
    campaignId,
    type: "checkpoint_created",
    message: `Approval required: ${checkpointType}`,
    data: { checkpointType, ...data },
    timestamp: new Date().toISOString(),
  });
}

export function emitClarificationNeeded(
  campaignId: string,
  requestId: string,
  agentRole: string,
  question: string,
  options: string[] | null,
  context: string | null,
  isBriefingGap: boolean,
  severity: string,
): void {
  emitCampaignEvent({
    campaignId,
    type: "clarification_needed",
    agentType: agentRole,
    message: question,
    data: { requestId, options, context, isBriefingGap, severity },
    timestamp: new Date().toISOString(),
  });
}

export function emitWorkspaceAlert(
  workspaceId: string,
  type: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!io) return;
  try {
    io.to(`workspace:${workspaceId}`).emit("workspace:alert", {
      workspaceId,
      type,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn(
      { err, workspaceId, type },
      "emitWorkspaceAlert failed (Socket.io degraded) — suppressed.",
    );
  }
}

export function getIO(): SocketIOServer | null {
  return io;
}

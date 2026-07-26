import { Server as SocketIOServer, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyAccessToken } from "../auth/auth.service.js";
import { logger } from "../../lib/logger.js";

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
    | "budget_skip_warning";
  agentType?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export function initRealtime(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth["token"] ??
      socket.handshake.headers["authorization"]?.replace("Bearer ", "");

    if (!token) {
      next(new Error("Authentication required"));
      return;
    }

    try {
      const payload = verifyAccessToken(token as string);
      socket.data["auth"] = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const auth = socket.data["auth"];
    logger.info({ userId: auth?.userId }, "WebSocket client connected");

    socket.on("join:campaign", (campaignId: string) => {
      socket.join(`campaign:${campaignId}`);
      logger.info({ campaignId, userId: auth?.userId }, "Joined campaign room");
    });

    socket.on("leave:campaign", (campaignId: string) => {
      socket.leave(`campaign:${campaignId}`);
    });

    socket.on("join:workspace", () => {
      if (auth?.workspaceId) {
        socket.join(`workspace:${auth.workspaceId}`);
      }
    });

    socket.on("disconnect", () => {
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

export function getIO(): SocketIOServer | null {
  return io;
}

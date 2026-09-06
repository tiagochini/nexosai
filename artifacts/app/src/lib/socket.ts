import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

export interface CampaignEvent {
  campaignId: string;
  type:
    | "agent_started"
    | "agent_thinking"
    | "agent_completed"
    | "agent_failed"
    | "checkpoint_created"
    | "asset_generated"
    | "phase_changed"
    | "execution_update"
    | "campaign_completed"
    | "clarification_needed"
    | "clarification_answered";
  agentType?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface WorkspaceAlert {
  workspaceId: string;
  type: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

let _socket: Socket | null = null;
let removeRecoveryListeners: (() => void) | null = null;
let lastAuthErrorLogAt = 0;

const AUTH_ERROR_LOG_INTERVAL_MS = 60_000;

function getAccessToken() {
  return typeof window === "undefined"
    ? ""
    : window.localStorage.getItem("accessToken") ?? "";
}

/**
 * Socket.IO reads `socket.auth` for each connection attempt. Updating it here
 * lets a connection that is retrying through an API restart use a token that
 * was refreshed while it was offline.
 */
function refreshSocketAuth(socket: Socket) {
  const token = getAccessToken();
  const currentAuth =
    typeof socket.auth === "function" ? undefined : socket.auth;
  if (currentAuth?.token !== token) {
    socket.auth = { token };
  }
}

function isAuthError(error: Error) {
  return /\b(401|403)\b|auth|token|jwt|unauthori[sz]ed/i.test(
    error.message,
  );
}

function logAuthError(error: Error) {
  if (!isAuthError(error)) return;

  const now = Date.now();
  if (now - lastAuthErrorLogAt < AUTH_ERROR_LOG_INTERVAL_MS) return;

  lastAuthErrorLogAt = now;
  console.warn(
    "[Socket] Authentication failed; realtime updates will retry after credentials refresh.",
    error.message,
  );
}

function installRecoveryListeners(socket: Socket) {
  if (typeof window === "undefined") return () => {};

  const reconnectWhenAvailable = () => {
    if (_socket !== socket || socket.connected) return;

    refreshSocketAuth(socket);
    // Calling connect while Socket.IO is already retrying is a no-op, while
    // this also resumes a socket that was disconnected outside its retry loop.
    socket.connect();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      reconnectWhenAvailable();
    }
  };

  window.addEventListener("online", reconnectWhenAvailable);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    window.removeEventListener("online", reconnectWhenAvailable);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

function getSocket(): Socket {
  if (_socket) return _socket;

  const token = getAccessToken();

  const socket = io({
    path: "/api/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    // API workflow deployments briefly take the socket endpoint down. Keep
    // trying, but spread retries out enough that many clients do not stampede
    // the API as it comes back.
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
  });
  _socket = socket;

  socket.io.on("reconnect_attempt", () => {
    refreshSocketAuth(socket);
  });

  socket.on("connect_error", (error) => {
    // 502s during a restart are expected and Socket.IO will retry them. Only
    // surface likely credential failures, throttled to avoid console spam.
    logAuthError(error);
  });

  removeRecoveryListeners = installRecoveryListeners(socket);

  return socket;
}

export function useCampaignSocket(
  campaignId: string | undefined,
  onEvent: (event: CampaignEvent) => void,
  enabled = true,
) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!campaignId || !enabled) return;

    const socket = getSocket();

    const joinAndListen = () => {
      socket.emit("join:campaign", campaignId);
    };

    const handler = (event: CampaignEvent) => {
      if (event.campaignId === campaignId) {
        cbRef.current(event);
      }
    };

    // Keep this listener for the effect lifetime: rooms are left by the
    // server during a transport restart and must be joined on every connect.
    socket.on("connect", joinAndListen);
    socket.on("campaign:event", handler);
    if (socket.connected) joinAndListen();

    return () => {
      socket.off("campaign:event", handler);
      socket.off("connect", joinAndListen);
    };
  }, [campaignId, enabled]);
}

/**
 * Joins the authenticated workspace room and listens for workspace-level alerts.
 * Use this in a top-level layout component so operator alerts are always visible.
 */
export function useWorkspaceSocket(
  workspaceId: string | undefined,
  onAlert: (alert: WorkspaceAlert) => void,
) {
  const cbRef = useRef(onAlert);
  cbRef.current = onAlert;

  useEffect(() => {
    if (!workspaceId) return;

    const socket = getSocket();

    const joinWorkspace = () => {
      socket.emit("join:workspace");
    };

    const handler = (alert: WorkspaceAlert) => {
      if (alert.workspaceId === workspaceId) {
        cbRef.current(alert);
      }
    };

    socket.on("connect", joinWorkspace);
    socket.on("workspace:alert", handler);
    if (socket.connected) joinWorkspace();

    return () => {
      socket.off("workspace:alert", handler);
      socket.off("connect", joinWorkspace);
    };
  }, [workspaceId]);
}

export function disconnectSocket() {
  removeRecoveryListeners?.();
  removeRecoveryListeners = null;
  _socket?.disconnect();
  _socket = null;
}

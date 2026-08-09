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

function getSocket(): Socket {
  if (_socket?.connected) return _socket;

  const token = localStorage.getItem("accessToken") ?? "";

  _socket = io({
    path: "/api/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  _socket.on("connect_error", (err) => {
    console.warn("[Socket] connect error:", err.message);
  });

  return _socket;
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

    if (socket.connected) {
      joinAndListen();
    } else {
      socket.once("connect", joinAndListen);
    }

    const handler = (event: CampaignEvent) => {
      if (event.campaignId === campaignId) {
        cbRef.current(event);
      }
    };

    socket.on("campaign:event", handler);

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

    if (socket.connected) {
      joinWorkspace();
    } else {
      socket.once("connect", joinWorkspace);
    }

    const handler = (alert: WorkspaceAlert) => {
      if (alert.workspaceId === workspaceId) {
        cbRef.current(alert);
      }
    };

    socket.on("workspace:alert", handler);

    return () => {
      socket.off("workspace:alert", handler);
      socket.off("connect", joinWorkspace);
    };
  }, [workspaceId]);
}

export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
}

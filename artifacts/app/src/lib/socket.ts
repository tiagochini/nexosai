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
    | "campaign_completed";
  agentType?: string;
  message?: string;
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

export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
}

import { getIO } from "../realtime/realtime.service.js";
import { logger } from "../../lib/logger.js";

export interface SequenceEvent {
  sequenceId: string;
  workspaceId: string;
  type:
    | "item_dispatching"
    | "item_dispatched"
    | "item_failed"
    | "engagement_received"
    | "segment_updated"
    | "sequence_completed"
    | "adaptive_suggestion";
  itemId?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export function emitSequenceEvent(event: SequenceEvent): void {
  try {
    const io = getIO();
    if (!io) return;

    io.to(`sequence:${event.sequenceId}`).emit("sequence_event", {
      ...event,
      timestamp: new Date().toISOString(),
    });

    io.to(`workspace:${event.workspaceId}`).emit("sequence_event", {
      ...event,
      timestamp: new Date().toISOString(),
    });
  } catch {
    logger.warn({ sequenceId: event.sequenceId }, "Could not emit sequence event");
  }
}

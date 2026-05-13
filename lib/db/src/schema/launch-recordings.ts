import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export type RecordingState = "recording" | "paused" | "stopped";

export type RecordingEvent = {
  id: string;
  type:
    | "briefing_started"
    | "briefing_completed"
    | "strategy_generated"
    | "copy_generated"
    | "approval_requested"
    | "approved"
    | "creative_delivered"
    | "budget_set"
    | "campaign_activated"
    | "cart_opened"
    | "cart_closed"
    | "metrics_snapshot"
    | "recording_paused"
    | "recording_resumed"
    | "custom";
  phase: string;
  timestamp: string; // ISO
  durationMs: number; // ms since recording started (excluding paused time)
  data: Record<string, unknown>;
};

export const launchRecordingsTable = pgTable("launch_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  campaignId: uuid("campaign_id"),
  name: text("name").notNull(),
  state: text("state").notNull().default("recording"), // RecordingState
  events: jsonb("events").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  totalPausedMs: integer("total_paused_ms").notNull().default(0),
  // Video file stored on server
  videoPath: text("video_path"),
  videoSize: integer("video_size"), // bytes
  videoUploadedAt: timestamp("video_uploaded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

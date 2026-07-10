import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

// ─── Status state machine ───────────────────────────────────────────────────
// intake → script_generating → script_ready → script_approved
// → storyboard_generating → storyboard_ready → storyboard_approved
// → preview_generating → preview_ready → preview_approved
// → final_generating → completed | failed

export const videoProjectStatusEnum = pgEnum("video_project_status", [
  "intake",
  "script_generating",
  "script_ready",
  "script_approved",
  "storyboard_generating",
  "storyboard_ready",
  "storyboard_approved",
  "preview_generating",
  "preview_ready",
  "preview_approved",
  "awaiting_clone",
  "final_generating",
  "completed",
  "failed",
]);

export const videoFormatEnum = pgEnum("video_format", [
  "vsl",
  "cpl",
  "live_promo",
  "stories",
  "reels",
  "youtube",
  "webinar_promo",
  "testimonial",
  "product_demo",
]);

// ─── Scene shape (stored in JSONB) ──────────────────────────────────────────
export const SceneSchema = z.object({
  id: z.string(),
  order: z.number(),
  title: z.string(),
  durationSeconds: z.number(),
  voiceoverText: z.string(),
  visualDescription: z.string(),
  sceneType: z.enum(["hook", "problem", "solution", "proof", "cta", "bridge", "transition"]),
  style: z.string(),
  palette: z.array(z.string()),
  transition: z.string(),
  mood: z.string(),
  hasAvatar: z.boolean().default(false),
  videoPrompt: z.string(),
  clipUrl: z.string().optional(),
  clipUrlHd: z.string().optional(),
  clipStatus: z.enum(["pending", "generating", "ready", "failed"]).default("pending"),
  approvedAt: z.string().optional(),
  notes: z.string().optional(),
});

export type VideoScene = z.infer<typeof SceneSchema>;

// ─── Config shape ────────────────────────────────────────────────────────────
export const VideoConfigSchema = z.object({
  hasUserFace: z.boolean().default(false),
  voiceStyle: z.enum(["narrator", "avatar", "voice_clone", "subtitles_only"]).default("narrator"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  palette: z.array(z.string()).optional(),
  styleKeywords: z.array(z.string()).optional(),
  rhythm: z.enum(["slow", "medium", "fast", "dynamic"]).default("medium"),
  tone: z.enum(["inspirational", "urgent", "educational", "conversational", "cinematic"]).default("inspirational"),
  avatarPhotoUrl: z.string().optional(),
  voiceSampleUrl: z.string().optional(),
  voiceId: z.string().optional(),
  avatarId: z.string().optional(),
  providerUsed: z.string().optional(),
  totalCreditsUsed: z.number().default(0),
});

export type VideoConfig = z.infer<typeof VideoConfigSchema>;

// ─── Table ───────────────────────────────────────────────────────────────────
export const videoProjectsTable = pgTable("video_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  format: videoFormatEnum("format").notNull().default("vsl"),
  status: videoProjectStatusEnum("status").notNull().default("intake"),
  config: jsonb("config").$type<VideoConfig>().notNull().default({} as VideoConfig),
  script: text("script"),
  storyboard: jsonb("storyboard").$type<VideoScene[]>().notNull().default([]),
  creditsUsed: integer("credits_used").notNull().default(0),
  errorMessage: text("error_message"),
  pendingAction: text("pending_action"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VideoProject = typeof videoProjectsTable.$inferSelect;
export type InsertVideoProject = typeof videoProjectsTable.$inferInsert;

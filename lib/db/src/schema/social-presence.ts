import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const presencePlatformEnum = pgEnum("presence_platform", [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
]);

export const presencePostStatusEnum = pgEnum("presence_post_status", [
  "draft",       // gerado pela IA, aguardando aprovação
  "scheduled",   // aprovado e agendado — scheduler publica em scheduledFor
  "publishing",  // claim do scheduler (evita double-publish)
  "published",   // publicado com sucesso na plataforma
  "failed",      // falhou após retries
  "cancelled",   // descartado pelo usuário
]);

// ─── JSONB types ──────────────────────────────────────────────────────────────

export type PresencePlatformConfig = {
  platform: "instagram" | "facebook" | "tiktok" | "linkedin";
  enabled: boolean;
  postsPerDay: number; // 1–5
  autoPublish: boolean;
  preferredTimes: string[]; // ["09:00", "19:30"]
};

export type PresenceWeeklyInsight = {
  weekStart: string; // YYYY-MM-DD (segunda-feira analisada)
  summary: string;
  wins: string[];
  losses: string[];
  adjustments: string[];
  winningFormats: string[];
  generatedAt: string;
};

export type PresenceBioSuggestion = {
  platform: string;
  bio: string;
  highlights: string[]; // destaques sugeridos (Instagram) / seções (LinkedIn)
  keywords: string[];
  generatedAt: string;
};

export type PresencePostMetrics = {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  reach: number;
  impressions: number;
};

// ─── Tables ───────────────────────────────────────────────────────────────────

export const socialPresenceConfigTable = pgTable("social_presence_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  platforms: jsonb("platforms")
    .notNull()
    .$type<PresencePlatformConfig[]>()
    .default([]),
  contentPillars: text("content_pillars").array().notNull().default([]),
  tone: text("tone").notNull().default(""),
  businessContext: text("business_context").notNull().default(""),
  // Alinhamento de campanha explicitamente escolhido pelo usuário.
  // null = sem alinhamento; preenchido = conteúdo alinhado a essa campanha.
  alignedCampaignId: uuid("aligned_campaign_id").references(
    () => campaignsTable.id,
    { onDelete: "set null" },
  ),
  weeklyInsight: jsonb("weekly_insight").$type<PresenceWeeklyInsight | null>(),
  bioSuggestions: jsonb("bio_suggestions")
    .notNull()
    .$type<PresenceBioSuggestion[]>()
    .default([]),
  lastWeekGeneratedAt: timestamp("last_week_generated_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const socialPresencePostsTable = pgTable("social_presence_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  platform: presencePlatformEnum("platform").notNull(),
  status: presencePostStatusEnum("status").notNull().default("draft"),
  // Planejamento semanal
  weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
  dayIndex: integer("day_index").notNull().default(0), // 0=segunda … 6=domingo
  postingTime: text("posting_time").notNull().default("09:00"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  // Conteúdo
  format: text("format").notNull().default("feed"), // feed | reel | carousel | story | text | live
  pillar: text("pillar").notNull().default(""),
  caption: text("caption").notNull().default(""),
  hashtags: text("hashtags").array().notNull().default([]),
  visualDirection: text("visual_direction").notNull().default(""),
  videoScript: text("video_script"),
  mediaUrls: jsonb("media_urls").notNull().$type<string[]>().default([]),
  objective: text("objective").notNull().default(""),
  // Alinhamento com lançamento
  launchAligned: boolean("launch_aligned").notNull().default(false),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  launchPhase: text("launch_phase"),
  // Publicação
  publishedAt: timestamp("published_at", { withTimezone: true }),
  platformPostId: text("platform_post_id"),
  platformUrl: text("platform_url"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  // Métricas pós-publicação
  metrics: jsonb("metrics")
    .notNull()
    .$type<PresencePostMetrics>()
    .default({ likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0 }),
  metricsSyncedAt: timestamp("metrics_synced_at", { withTimezone: true }),
  aiGenerated: boolean("ai_generated").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── Zod / Types ──────────────────────────────────────────────────────────────

export const insertSocialPresenceConfigSchema = createInsertSchema(
  socialPresenceConfigTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertSocialPresencePostSchema = createInsertSchema(
  socialPresencePostsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertSocialPresenceConfig = z.infer<
  typeof insertSocialPresenceConfigSchema
>;
export type SocialPresenceConfig =
  typeof socialPresenceConfigTable.$inferSelect;
export type InsertSocialPresencePost = z.infer<
  typeof insertSocialPresencePostSchema
>;
export type SocialPresencePost = typeof socialPresencePostsTable.$inferSelect;

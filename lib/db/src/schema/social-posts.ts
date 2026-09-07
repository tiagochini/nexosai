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
import { workspaceIntegrationsTable } from "./workspace-integrations";
import { campaignsTable } from "./campaigns";
import { contentPiecesTable } from "./content";
import { masterplanVersionsTable } from "./masterplan-versions";

export const socialPlatformEnum = pgEnum("social_platform", [
  "instagram",
  "facebook_page",
  "tiktok",
  "whatsapp_business",
  "youtube",
  "linkedin",
]);

export const socialPostStatusEnum = pgEnum("social_post_status", [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
]);

export const socialPostTypeEnum = pgEnum("social_post_type", [
  "feed_image",
  "feed_video",
  "reel",
  "story",
  "carousel",
  "text",
  "whatsapp_message",
]);

export type SocialMetrics = {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  reach: number;
  impressions: number;
  clicks: number;
};

export const socialPostsTable = pgTable("social_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  masterplanVersionId: uuid("masterplan_version_id").references(() => masterplanVersionsTable.id, { onDelete: "restrict" }),
  contextFingerprint: text("context_fingerprint"),
  contentPieceId: uuid("content_piece_id").references(
    () => contentPiecesTable.id,
    { onDelete: "set null" }
  ),
  integrationId: uuid("integration_id")
    .notNull()
    .references(() => workspaceIntegrationsTable.id, { onDelete: "cascade" }),
  platform: socialPlatformEnum("platform").notNull(),
  postType: socialPostTypeEnum("post_type").notNull().default("feed_image"),
  status: socialPostStatusEnum("status").notNull().default("draft"),
  caption: text("caption"),
  hashtags: text("hashtags").array().notNull().default([]),
  mediaUrls: jsonb("media_urls")
    .notNull()
    .$type<string[]>()
    .default([]),
  callToAction: text("call_to_action"),
  linkUrl: text("link_url"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  platformPostId: text("platform_post_id"),
  platformUrl: text("platform_url"),
  metrics: jsonb("metrics")
    .notNull()
    .$type<SocialMetrics>()
    .default({
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
    }),
  retryCount: integer("retry_count").notNull().default(0),
  manualRetryCount: integer("manual_retry_count").notNull().default(0),
  reelScript: text("reel_script"),
  errorMessage: text("error_message"),
  aiGenerated: boolean("ai_generated").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSocialPostSchema = createInsertSchema(
  socialPostsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type SocialPost = typeof socialPostsTable.$inferSelect;

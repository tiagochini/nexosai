import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

export const commentClassificationEnum = pgEnum("comment_classification", [
  "hostile",
  "spam",
  "question",
  "compliment",
  "objection",
  "neutral",
]);

export const commentActionEnum = pgEnum("comment_action", [
  "pending",
  "replied",
  "deleted",
  "hidden",
  "liked",
  "ignored",
  "error",
]);

export const commentPlatformEnum = pgEnum("comment_platform", [
  "instagram",
  "facebook_page",
  "tiktok",
]);

export const socialCommentActionsTable = pgTable("social_comment_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  platform: commentPlatformEnum("platform").notNull(),
  postId: text("post_id").notNull(),
  commentId: text("comment_id").notNull(),
  parentCommentId: text("parent_comment_id"),
  authorName: text("author_name"),
  authorId: text("author_id"),
  commentText: text("comment_text").notNull(),
  classification: commentClassificationEnum("classification"),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
  action: commentActionEnum("action").notNull().default("pending"),
  aiReply: text("ai_reply"),
  platformReplyId: text("platform_reply_id"),
  processingError: text("processing_error"),
  overriddenBy: uuid("overridden_by"),
  overriddenAt: timestamp("overridden_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSocialCommentActionSchema = createInsertSchema(
  socialCommentActionsTable,
).omit({ id: true, createdAt: true });

export type InsertSocialCommentAction = z.infer<
  typeof insertSocialCommentActionSchema
>;
export type SocialCommentAction =
  typeof socialCommentActionsTable.$inferSelect;

import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";

export const assetTypeEnum = pgEnum("asset_type", [
  "copy",
  "post",
  "carousel",
  "email",
  "whatsapp_message",
  "telegram_message",
  "ad_copy",
  "video_concept",
  "video_low_res",
  "video_high_res",
  "creative_brief",
  "landing_page",
  "sales_page",
  "capture_page",
  "funnel",
  "timeline",
  "strategy_doc",
  "offer_doc",
  "targeting_doc",
  "script",
  "ad_set",
]);

export const assetStatusEnum = pgEnum("asset_status", [
  "draft",
  "concept_pending_approval",
  "concept_approved",
  "generating",
  "preview_ready",
  "approved",
  "rejected",
  "published",
  "archived",
]);

export const campaignAssetsTable = pgTable("campaign_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id"),
  assetType: assetTypeEnum("asset_type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  metadata: jsonb("metadata").notNull().default({}),
  status: assetStatusEnum("status").notNull().default("draft"),
  previewUrl: text("preview_url"),
  finalUrl: text("final_url"),
  isLowRes: boolean("is_low_res").notNull().default(false),
  platform: text("platform"),
  phase: text("phase"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCampaignAssetSchema = createInsertSchema(
  campaignAssetsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCampaignAsset = z.infer<typeof insertCampaignAssetSchema>;
export type CampaignAsset = typeof campaignAssetsTable.$inferSelect;

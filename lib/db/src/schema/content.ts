import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { workspacesTable } from "./workspaces";

export const contentTypeEnum = pgEnum("content_type", [
  "email_sequence",
  "sales_page",
  "whatsapp_broadcast",
  "whatsapp_group_message",
  "telegram_message",
  "social_post",
  "ad_copy",
  "vsl_script",
  "media_brief",
  "content_calendar",
  "prelaunch_warming",
  "cart_open_announcement",
  "cart_close_urgency",
  "remarketing_sequence",
  "cpl_script",
  "webinar_script",
  "live_script",
  "stories_sequence",
  "landing_page_structure",
  "creative_direction",
  "targeting_config",
  "media_buying_plan",
  "video_strategy",
  "creator_growth_plan",
  "seo_organic_plan",
  "compliance_report",
  "optimization_report",
]);

export const contentStatusEnum = pgEnum("content_status", [
  "generating",
  "draft",
  "pending_approval",
  "budget_proposed",
  "approved",
  "rejected",
  "archived",
]);

export const mediaConceptStatusEnum = pgEnum("media_concept_status", [
  "pending_concept",
  "concept_approved",
  "concept_rejected",
  "in_production",
  "produced",
]);

export const mentalTriggerEnum = pgEnum("mental_trigger", [
  "authority",
  "social_proof",
  "reciprocity",
  "community",
  "scarcity",
  "urgency",
  "anticipation",
  "event",
  "transformation",
  "fear_of_loss",
  "curiosity",
  "contrast",
]);

export const contentPiecesTable = pgTable("content_pieces", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  type: contentTypeEnum("type").notNull(),
  status: contentStatusEnum("status").notNull().default("draft"),
  title: text("title").notNull(),
  phase: text("phase"),
  launchPhase: text("launch_phase"),
  dayIndex: integer("day_index"),
  mentalTrigger: mentalTriggerEnum("mental_trigger"),
  sequenceItemId: uuid("sequence_item_id"),
  content: jsonb("content").notNull().default({}),
  aiProvider: text("ai_provider"),
  creditsUsed: integer("credits_used").notNull().default(0),
  agentVersion: text("agent_version").default("1.0"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const mediaBriefsTable = pgTable("media_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  contentPieceId: uuid("content_piece_id").references(
    () => contentPiecesTable.id,
    { onDelete: "set null" },
  ),
  mediaType: text("media_type").notNull(),
  conceptStatus: mediaConceptStatusEnum("concept_status")
    .notNull()
    .default("pending_concept"),
  conceptData: jsonb("concept_data").notNull().default({}),
  lowResUrl: text("low_res_url"),
  finalUrl: text("final_url"),
  userFeedback: text("user_feedback"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  producedAt: timestamp("produced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ContentPiece = typeof contentPiecesTable.$inferSelect;
export type MediaBrief = typeof mediaBriefsTable.$inferSelect;

export const contentTypeValues = [
  "email_sequence",
  "sales_page",
  "whatsapp_broadcast",
  "whatsapp_group_message",
  "telegram_message",
  "social_post",
  "ad_copy",
  "vsl_script",
  "media_brief",
  "content_calendar",
  "prelaunch_warming",
  "cart_open_announcement",
  "cart_close_urgency",
  "remarketing_sequence",
  "cpl_script",
  "webinar_script",
  "live_script",
  "stories_sequence",
  "landing_page_structure",
  "creative_direction",
  "targeting_config",
  "media_buying_plan",
  "video_strategy",
  "creator_growth_plan",
  "compliance_report",
  "optimization_report",
] as const;

export const ContentTypeSchema = z.enum(contentTypeValues);

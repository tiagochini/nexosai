import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";

export const checkpointTypeEnum = pgEnum("checkpoint_type", [
  "strategy_approval",
  "timeline_approval",
  "creative_concept_approval",
  "video_concept_approval",
  "video_preview_approval",
  "landing_page_approval",
  "ad_set_approval",
  "targeting_approval",
  "offer_approval",
  "execution_approval",
  "budget_approval",
]);

export const checkpointStatusEnum = pgEnum("checkpoint_status", [
  "pending",
  "approved",
  "rejected",
  "revision_requested",
]);

export const approvalCheckpointsTable = pgTable("approval_checkpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id"),
  checkpointType: checkpointTypeEnum("checkpoint_type").notNull(),
  status: checkpointStatusEnum("status").notNull().default("pending"),
  data: jsonb("data").notNull().default({}),
  userFeedback: text("user_feedback"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertApprovalCheckpointSchema = createInsertSchema(
  approvalCheckpointsTable,
).omit({ id: true, createdAt: true, approvedAt: true });

export type InsertApprovalCheckpoint = z.infer<
  typeof insertApprovalCheckpointSchema
>;
export type ApprovalCheckpoint = typeof approvalCheckpointsTable.$inferSelect;

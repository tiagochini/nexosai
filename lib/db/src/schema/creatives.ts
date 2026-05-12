import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { workspacesTable } from "./workspaces";

export const creativeStatusEnum = pgEnum("creative_status", [
  "concept_pending",
  "concept_ready",
  "preview_generating",
  "preview_ready",
  "final_generating",
  "approved",
  "rejected",
]);

export const creativeFormatEnum = pgEnum("creative_format", [
  "feed_square",
  "feed_portrait",
  "stories",
  "banner",
  "carousel_slide",
]);

export const creativePlatformEnum = pgEnum("creative_platform", [
  "instagram",
  "facebook",
  "google",
  "tiktok",
  "universal",
]);

export const campaignCreativesTable = pgTable("campaign_creatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  status: creativeStatusEnum("status").notNull().default("concept_pending"),
  format: creativeFormatEnum("format").notNull().default("feed_square"),
  platform: creativePlatformEnum("platform").notNull().default("instagram"),
  requestNote: text("request_note"),
  concept: jsonb("concept").$type<CreativeConcept | null>(),
  previewUrl: text("preview_url"),
  finalUrl: text("final_url"),
  prompt: text("prompt"),
  rejectionReason: text("rejection_reason"),
  conceptApprovedAt: timestamp("concept_approved_at", { withTimezone: true }),
  previewApprovedAt: timestamp("preview_approved_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  imageExpired: boolean("image_expired").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export interface CreativeConcept {
  headline: string;
  subHeadline: string;
  visualDescription: string;
  colorPalette: string[];
  cta: string;
  mentalTrigger: string;
  angle: string;
  mood: string;
  platform: string;
  format: string;
  dallePrompt: string;
  rationale: string;
}

export type CampaignCreative = typeof campaignCreativesTable.$inferSelect;
export type InsertCampaignCreative = typeof campaignCreativesTable.$inferInsert;

export const CreativeConceptSchema = z.object({
  headline: z.string(),
  subHeadline: z.string(),
  visualDescription: z.string(),
  colorPalette: z.array(z.string()),
  cta: z.string(),
  mentalTrigger: z.string(),
  angle: z.string(),
  mood: z.string(),
  platform: z.string(),
  format: z.string(),
  dallePrompt: z.string(),
  rationale: z.string(),
});

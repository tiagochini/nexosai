import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

export const vslFormatEnum = pgEnum("vsl_format", [
  "vsl",
  "webinar",
  "masterclass",
  "challenge_day",
  "long_form_video",
]);

export const vslStatusEnum = pgEnum("vsl_status", [
  "draft",
  "generating",
  "generated",
  "pending_approval",
  "approved",
  "rejected",
  "archived",
]);

export const vslsTable = pgTable("vsls", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  format: vslFormatEnum("format").notNull().default("vsl"),
  status: vslStatusEnum("status").notNull().default("draft"),
  totalDuration: text("total_duration"),
  totalWordCount: integer("total_word_count"),
  hookData: jsonb("hook_data").notNull().default({}),
  sections: jsonb("sections").notNull().default([]),
  offerReveal: jsonb("offer_reveal").notNull().default({}),
  ctas: jsonb("ctas").notNull().default({}),
  technicalNotes: jsonb("technical_notes").notNull().default({}),
  vslNotes: text("vsl_notes"),
  productName: text("product_name"),
  productPrice: text("product_price"),
  targetAudience: text("target_audience"),
  mainPromise: text("main_promise"),
  intakeSnapshot: jsonb("intake_snapshot").notNull().default({}),
  aiProvider: text("ai_provider"),
  creditsUsed: integer("credits_used").notNull().default(0),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  generationStartedAt: timestamp("generation_started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Vsl = typeof vslsTable.$inferSelect;

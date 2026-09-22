import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  jsonb,
  date,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

export const launchModelEnum = pgEnum("launch_model", [
  "plf",
  "formula_de_lancamento",
  "semente",
  "afiliado",
  "perpetual",
  "custom",
]);

export const launchSequenceStatusEnum = pgEnum("launch_sequence_status", [
  "draft",
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export const launchPhaseEnum = pgEnum("launch_phase", [
  "pre_capture",
  "capture",
  "plc1",
  "plc2",
  "plc3",
  "cart_open",
  "cart_middle",
  "cart_close",
  "post_purchase",
  "post_launch",
  "evergreen",
]);

export const launchSequenceItemStatusEnum = pgEnum("launch_sequence_item_status", [
  "pending",
  "content_generating",
  "content_ready",
  "scheduled",
  "dispatched",
  "skipped",
  "failed",
]);

export const launchSequencesTable = pgTable("launch_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  model: launchModelEnum("model").notNull().default("plf"),
  status: launchSequenceStatusEnum("status").notNull().default("draft"),
  totalDays: integer("total_days").notNull().default(21),
  launchStartDate: date("launch_start_date"),
  cartOpenDate: date("cart_open_date"),
  cartCloseDate: date("cart_close_date"),
  revenueTarget: text("revenue_target"),
  productName: text("product_name"),
  productPrice: text("product_price"),
  leadCaptureEnabled: boolean("lead_capture_enabled").notNull().default(false),
  config: jsonb("config").notNull().default({}),
  aiGeneratedPlan: jsonb("ai_generated_plan").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("launch_sequences_workspace_campaign_uidx").on(table.workspaceId, table.campaignId),
  uniqueIndex("launch_sequences_workspace_id_uidx").on(table.workspaceId, table.id),
]);

export const launchSequenceItemsTable = pgTable("launch_sequence_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => launchSequencesTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  phase: launchPhaseEnum("phase").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  dayIndex: integer("day_index").notNull(),
  mentalTrigger: text("mental_trigger"),
  deliveryChannels: jsonb("delivery_channels").notNull().default([]),
  contentType: text("content_type"),
  contentPieceId: uuid("content_piece_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: launchSequenceItemStatusEnum("status").notNull().default("pending"),
  objective: text("objective"),
  copyHints: text("copy_hints"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("launch_sequence_items_workspace_id_uidx").on(table.workspaceId, table.id),
]);

export type LaunchSequence = typeof launchSequencesTable.$inferSelect;
export type LaunchSequenceItem = typeof launchSequenceItemsTable.$inferSelect;

export const launchPhaseValues = [
  "pre_capture",
  "capture",
  "plc1",
  "plc2",
  "plc3",
  "cart_open",
  "cart_middle",
  "cart_close",
  "post_purchase",
  "post_launch",
  "evergreen",
] as const;

export const MentalTriggerValues = [
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
] as const;

export const MentalTriggerSchema = z.enum(MentalTriggerValues);
export type MentalTrigger = z.infer<typeof MentalTriggerSchema>;

import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

export const whatsappDispatchTypeEnum = pgEnum("whatsapp_dispatch_type", [
  "broadcast",
  "individual",
  "group",
  "template",
]);

export const whatsappDispatchStatusEnum = pgEnum("whatsapp_dispatch_status", [
  "queued",
  "sending",
  "ambiguous",
  "sent",
  "delivered",
  "read",
  "failed",
  "cancelled",
]);

export const whatsappDispatchesTable = pgTable("whatsapp_dispatches", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  phoneNumberId: text("phone_number_id").notNull(),
  displayPhoneNumber: text("display_phone_number"),
  type: whatsappDispatchTypeEnum("type").notNull().default("broadcast"),
  recipients: jsonb("recipients").notNull().default([]),
  sequenceItemId: uuid("sequence_item_id"),
  contentPieceId: uuid("content_piece_id"),
  message: text("message").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  templateName: text("template_name"),
  templateParams: jsonb("template_params").notNull().default({}),
  status: whatsappDispatchStatusEnum("status").notNull().default("queued"),
  externalMessageIds: jsonb("external_message_ids").notNull().default([]),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipientCount: integer("recipient_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  readCount: integer("read_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").notNull().default({}),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("whatsapp_dispatches_workspace_idempotency_uidx").on(table.workspaceId, table.idempotencyKey)
    .where(sql`${table.idempotencyKey} is not null`),
]);

export type WhatsappDispatch = typeof whatsappDispatchesTable.$inferSelect;

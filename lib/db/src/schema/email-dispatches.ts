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

export const emailProviderEnum = pgEnum("email_provider", [
  "rd_station",
  "activecampaign",
  "mailchimp",
  "sendgrid",
  "brevo",
  "custom_smtp",
]);

export const emailDispatchStatusEnum = pgEnum("email_dispatch_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "partial",
  "failed",
  "cancelled",
]);

export const emailDispatchesTable = pgTable("email_dispatches", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  provider: emailProviderEnum("provider").notNull(),
  externalCampaignId: text("external_campaign_id"),
  listId: text("list_id"),
  listName: text("list_name"),
  subject: text("subject").notNull(),
  previewText: text("preview_text"),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  contentPieceId: uuid("content_piece_id"),
  htmlContent: text("html_content"),
  textContent: text("text_content"),
  status: emailDispatchStatusEnum("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipientCount: integer("recipient_count").notNull().default(0),
  openCount: integer("open_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  bounceCount: integer("bounce_count").notNull().default(0),
  unsubscribeCount: integer("unsubscribe_count").notNull().default(0),
  openRate: text("open_rate"),
  clickRate: text("click_rate"),
  metadata: jsonb("metadata").notNull().default({}),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type EmailDispatch = typeof emailDispatchesTable.$inferSelect;

export const emailProviderValues = [
  "rd_station",
  "activecampaign",
  "mailchimp",
  "sendgrid",
  "brevo",
  "custom_smtp",
] as const;

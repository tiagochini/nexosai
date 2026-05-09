import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { launchSequencesTable, launchSequenceItemsTable } from "./launch-sequences";

export const contactSegmentEnum = pgEnum("contact_segment", [
  "hot",
  "warm",
  "cold",
  "converted",
  "unsubscribed",
]);

export const engagementEventTypeEnum = pgEnum("engagement_event_type", [
  "delivered",
  "open",
  "click",
  "convert",
  "reply",
  "unsubscribe",
  "bounced",
]);

export const sequenceContactsTable = pgTable("sequence_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => launchSequencesTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  segment: contactSegmentEnum("segment").notNull().default("cold"),
  engagementScore: real("engagement_score").notNull().default(0),
  itemsReceived: integer("items_received").notNull().default(0),
  itemsOpened: integer("items_opened").notNull().default(0),
  itemsClicked: integer("items_clicked").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  tags: jsonb("tags").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sequenceEngagementTable = pgTable("sequence_engagement", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => launchSequencesTable.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").references(() => launchSequenceItemsTable.id, {
    onDelete: "set null",
  }),
  contactId: uuid("contact_id").references(() => sequenceContactsTable.id, {
    onDelete: "set null",
  }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  event: engagementEventTypeEnum("event").notNull(),
  channel: text("channel"),
  externalRef: text("external_ref"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SequenceContact = typeof sequenceContactsTable.$inferSelect;
export type SequenceEngagement = typeof sequenceEngagementTable.$inferSelect;

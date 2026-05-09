import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const agencyClientStatusEnum = pgEnum("agency_client_status", [
  "pending",
  "active",
  "suspended",
  "revoked",
]);

export type AgencyPermissions = {
  canViewCampaigns: boolean;
  canEditCampaigns: boolean;
  canViewMetrics: boolean;
  canViewRevenue: boolean;
  canExecuteCampaigns: boolean;
  canApproveContent: boolean;
  canManageSocial: boolean;
};

export const DEFAULT_AGENCY_PERMISSIONS: AgencyPermissions = {
  canViewCampaigns: true,
  canEditCampaigns: false,
  canViewMetrics: true,
  canViewRevenue: false,
  canExecuteCampaigns: false,
  canApproveContent: false,
  canManageSocial: false,
};

export const agencyClientsTable = pgTable("agency_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  agencyWorkspaceId: uuid("agency_workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  clientWorkspaceId: uuid("client_workspace_id").references(
    () => workspacesTable.id,
    { onDelete: "set null" }
  ),
  clientEmail: text("client_email").notNull(),
  clientName: text("client_name"),
  status: agencyClientStatusEnum("status").notNull().default("pending"),
  inviteToken: text("invite_token"),
  inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
  permissions: jsonb("permissions")
    .notNull()
    .$type<AgencyPermissions>()
    .default(DEFAULT_AGENCY_PERMISSIONS),
  notes: text("notes"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAgencyClientSchema = createInsertSchema(
  agencyClientsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertAgencyClient = z.infer<typeof insertAgencyClientSchema>;
export type AgencyClient = typeof agencyClientsTable.$inferSelect;
export type AgencyClientStatus =
  (typeof agencyClientStatusEnum.enumValues)[number];

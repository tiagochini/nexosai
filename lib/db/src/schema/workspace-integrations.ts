import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  jsonb,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const integrationProviderEnum = pgEnum("integration_provider", [
  // Messaging
  "whatsapp_business",
  "telegram",
  // Email
  "rd_station",
  "activecampaign",
  "mailchimp",
  "resend",
  // Social
  "meta_ads",
  "instagram",
  "facebook",
  "tiktok_ads",
  "google_ads",
  "linkedin_ads",
  // Checkout / Payment gateways
  "stripe",
  "paypal",
  "mercado_pago",
  "pagarme",
  "asaas",
  // Product platforms (with their own checkout)
  "hotmart",
  "eduzz",
  "kiwify",
  // CRM
  "hubspot",
  // Other
  "crypto_native",
  "custom_webhook",
  // AI / Media generation
  "heygen",
  "runway_ml",
  "kling_fal",
  "elevenlabs",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "connected",
  "disconnected",
  "expired",
  "error",
  "pending_approval",
]);

export const workspaceIntegrationsTable = pgTable("workspace_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  provider: integrationProviderEnum("provider").notNull(),
  status: integrationStatusEnum("status").notNull().default("disconnected"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  accountId: text("account_id"),
  accountName: text("account_name"),
  metadata: jsonb("metadata").notNull().default({}),
  isPaymentGateway: boolean("is_payment_gateway").notNull().default(false),
  blocksExecution: boolean("blocks_execution").notNull().default(false),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertWorkspaceIntegrationSchema = createInsertSchema(
  workspaceIntegrationsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertWorkspaceIntegration = z.infer<
  typeof insertWorkspaceIntegrationSchema
>;
export type WorkspaceIntegration =
  typeof workspaceIntegrationsTable.$inferSelect;

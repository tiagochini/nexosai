import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export type WhiteLabelTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  borderRadius: string;
  fontFamily: string;
};

export const DEFAULT_THEME: WhiteLabelTheme = {
  primaryColor: "#6366f1",
  secondaryColor: "#1e1b4b",
  accentColor: "#a78bfa",
  textColor: "#f8fafc",
  bgColor: "#0f0e17",
  borderRadius: "8px",
  fontFamily: "Inter, sans-serif",
};

export const whitelabelConfigsTable = pgTable("whitelabel_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  brandName: text("brand_name").notNull(),
  tagline: text("tagline"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  loginBgUrl: text("login_bg_url"),
  theme: jsonb("theme")
    .notNull()
    .$type<WhiteLabelTheme>()
    .default(DEFAULT_THEME),
  customCss: text("custom_css"),
  customDomain: text("custom_domain"),
  domainVerified: boolean("domain_verified").notNull().default(false),
  domainVerifyToken: text("domain_verify_token"),
  supportEmail: text("support_email"),
  supportUrl: text("support_url"),
  termsUrl: text("terms_url"),
  privacyUrl: text("privacy_url"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertWhitelabelConfigSchema = createInsertSchema(
  whitelabelConfigsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertWhitelabelConfig = z.infer<
  typeof insertWhitelabelConfigSchema
>;
export type WhitelabelConfig = typeof whitelabelConfigsTable.$inferSelect;

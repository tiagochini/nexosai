import {
  pgTable,
  text,
  uuid,
  timestamp,
} from "drizzle-orm/pg-core";

export const masterprintDownloadsTable = pgTable("masterprint_downloads", {
  id: uuid("id").primaryKey().defaultRandom(),
  fingerprint: text("fingerprint").notNull().unique(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  userName: text("user_name").notNull(),
  workspaceId: text("workspace_id").notNull(),
  workspaceName: text("workspace_name").notNull(),
  campaignId: text("campaign_id").notNull(),
  campaignTitle: text("campaign_title"),
  track: text("track"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

import { pgTable, uuid, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";

export const academyPurchasesTable = pgTable("academy_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  accessToken: varchar("access_token", { length: 32 }).unique().notNull(),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  productId: varchar("product_id", { length: 50 }).notNull(),
  asaasPaymentId: varchar("asaas_payment_id", { length: 100 }),
  asaasCustomerId: varchar("asaas_customer_id", { length: 100 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  amountCents: integer("amount_cents").notNull(),
  paymentUrl: varchar("payment_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export type AcademyPurchase = typeof academyPurchasesTable.$inferSelect;
export type NewAcademyPurchase = typeof academyPurchasesTable.$inferInsert;

export const academyLeadsTable = pgTable("academy_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  source: varchar("source", { length: 100 }).default("free-guide").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),
  // Funnel tracking
  funnelEnrolledAt: timestamp("funnel_enrolled_at", { withTimezone: true }),
  funnelStep: integer("funnel_step").default(-1).notNull(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AcademyLead = typeof academyLeadsTable.$inferSelect;
export type NewAcademyLead = typeof academyLeadsTable.$inferInsert;

// Tracks every scheduled and sent funnel email
export const academyFunnelEmailsTable = pgTable("academy_funnel_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").notNull().references(() => academyLeadsTable.id, { onDelete: "cascade" }),
  step: integer("step").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).default("scheduled").notNull(), // scheduled | sent | failed | skipped
  resendId: varchar("resend_id", { length: 100 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AcademyFunnelEmail = typeof academyFunnelEmailsTable.$inferSelect;
export type NewAcademyFunnelEmail = typeof academyFunnelEmailsTable.$inferInsert;

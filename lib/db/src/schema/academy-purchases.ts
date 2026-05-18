import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";

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

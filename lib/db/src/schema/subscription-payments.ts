import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";
import { plansTable } from "./plans";

export const paymentMethodEnum = pgEnum("payment_method", [
  "pix",
  "boleto",
  "bank_transfer",
  "crypto_usdt",
  "crypto_btc",
  "crypto_eth",
  "credit_card",
  "manual",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "paid",
  "failed",
  "refunded",
  "cancelled",
  "expired",
]);

export const paymentCurrencyEnum = pgEnum("payment_currency", [
  "BRL",
  "USD",
  "USDT",
  "BTC",
  "ETH",
]);

export type PixData = {
  qrCode?: string;
  copiaECola?: string;
  expiresAt?: string;
  asaasId?: string;
  instructions?: string;
};

export type CryptoData = {
  address?: string;
  network?: string;
  amount?: number;
  currency?: string;
  expiresAt?: string;
  exchangeRate?: number;
};

export type BankTransferData = {
  bank?: string;
  agency?: string;
  account?: string;
  accountType?: string;
  cnpj?: string;
  companyName?: string;
  instructions?: string;
};

export type BoletoData = {
  barcodeUrl?: string;
  barcode?: string;
  dueDate?: string;
  asaasId?: string;
  nossoNumero?: string;
  instructions?: string;
};

export const subscriptionPaymentsTable = pgTable("subscription_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plansTable.id),
  amountCents: integer("amount_cents").notNull(),
  currency: paymentCurrencyEnum("currency").notNull().default("BRL"),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  description: text("description"),
  externalId: text("external_id"),
  pixData: jsonb("pix_data").$type<PixData>(),
  boletoData: jsonb("boleto_data").$type<BoletoData>(),
  cryptoData: jsonb("crypto_data").$type<CryptoData>(),
  bankTransferData: jsonb("bank_transfer_data").$type<BankTransferData>(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSubscriptionPaymentSchema = createInsertSchema(
  subscriptionPaymentsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertSubscriptionPayment = z.infer<
  typeof insertSubscriptionPaymentSchema
>;
export type SubscriptionPayment =
  typeof subscriptionPaymentsTable.$inferSelect;
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { productsTable } from "./products";
import {
  paymentMethodEnum,
  paymentStatusEnum,
  paymentCurrencyEnum,
  type PixData,
  type BoletoData,
} from "./subscription-payments";

export type CardData = {
  last4?: string;
  brand?: string;
  status?: string;
  asaasId?: string;
};

export const productSalesTable = pgTable("product_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => productsTable.id),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerCpf: text("buyer_cpf"),
  amountCents: integer("amount_cents").notNull(),
  currency: paymentCurrencyEnum("currency").notNull().default("BRL"),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  externalId: text("external_id"),
  pixData: jsonb("pix_data").$type<PixData>(),
  boletoData: jsonb("boleto_data").$type<BoletoData>(),
  cardData: jsonb("card_data").$type<CardData>(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ProductSale = typeof productSalesTable.$inferSelect;
export type InsertProductSale = typeof productSalesTable.$inferInsert;

import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const localeEnum = pgEnum("locale", ["pt-BR", "en-US", "es-LA"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  locale: localeEnum("locale").notNull().default("pt-BR"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  emailVerified: true,
});

export const registerUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(2),
  locale: z.enum(["pt-BR", "en-US", "es-LA"]).default("pt-BR"),
});

export const loginUserSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

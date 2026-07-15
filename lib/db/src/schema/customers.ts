import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  mobile: text("mobile").notNull().unique(),
  passwordHash: text("password_hash"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const addressesTable = pgTable("addresses", {
  id: serial("id").primaryKey(),
  customerId: serial("customer_id").references(() => customersTable.id, { onDelete: "cascade" }),
  governorateId: serial("governorate_id"),
  governorateName: text("governorate_name").notNull(),
  city: text("city").notNull(),
  detailedAddress: text("detailed_address").notNull(),
  landmark: text("landmark"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
export type Address = typeof addressesTable.$inferSelect;

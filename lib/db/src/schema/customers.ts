import { sql } from "drizzle-orm";
import { pgTable, text, serial, timestamp, boolean, index, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  primaryPhone: text("primary_phone").notNull().unique(),
  primaryPhoneHasWhatsApp: boolean("primary_phone_has_whatsapp").notNull().default(true),
  alternatePhone: text("alternate_phone"),
  alternatePhoneHasWhatsApp: boolean("alternate_phone_has_whatsapp").notNull().default(false),
  preferredWhatsAppPhone: text("preferred_whatsapp_phone"),
  passwordHash: text("password_hash"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  check("customers_preferred_whatsapp_valid", sql`${table.preferredWhatsAppPhone} IS NULL OR (${table.primaryPhoneHasWhatsApp} AND ${table.preferredWhatsAppPhone} = ${table.primaryPhone}) OR (${table.alternatePhoneHasWhatsApp} AND ${table.alternatePhone} IS NOT NULL AND ${table.preferredWhatsAppPhone} = ${table.alternatePhone})`),
]);

export const addressesTable = pgTable("addresses", {
  id: serial("id").primaryKey(),
  customerId: serial("customer_id").references(() => customersTable.id, { onDelete: "cascade" }),
  governorateId: serial("governorate_id"),
  governorateName: text("governorate_name").notNull(),
  city: text("city").notNull(),
  detailedAddress: text("detailed_address").notNull(),
  landmark: text("landmark"),
  primaryPhone: text("primary_phone"),
  primaryPhoneHasWhatsApp: boolean("primary_phone_has_whatsapp").notNull().default(true),
  alternatePhone: text("alternate_phone"),
  alternatePhoneHasWhatsApp: boolean("alternate_phone_has_whatsapp").notNull().default(false),
  preferredWhatsAppPhone: text("preferred_whatsapp_phone"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("addresses_customer_default_idx").on(table.customerId, table.isDefault),
  index("addresses_governorate_idx").on(table.governorateId),
  check("addresses_preferred_whatsapp_valid", sql`${table.preferredWhatsAppPhone} IS NULL OR (${table.primaryPhoneHasWhatsApp} AND ${table.preferredWhatsAppPhone} = ${table.primaryPhone}) OR (${table.alternatePhoneHasWhatsApp} AND ${table.alternatePhone} IS NOT NULL AND ${table.preferredWhatsAppPhone} = ${table.alternatePhone})`),
]);

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
export type Address = typeof addressesTable.$inferSelect;

import { pgTable, text, serial, timestamp, boolean, integer, numeric, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const governoratesTable = pgTable("governorates", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  remoteAreaSurcharge: numeric("remote_area_surcharge", { precision: 10, scale: 2 }).notNull().default("0"),
  freeShippingThreshold: numeric("free_shipping_threshold", { precision: 10, scale: 2 }),
  estimatedDays: integer("estimated_days").notNull().default(3),
  estimatedDeliveryText: text("estimated_delivery_text"),
  shippingNotes: text("shipping_notes"),
  deliveryAvailable: boolean("delivery_available").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("governorates_shipping_non_negative", sql`${table.shippingCost} >= 0`),
  check("governorates_surcharge_non_negative", sql`${table.remoteAreaSurcharge} >= 0`),
  check("governorates_threshold_non_negative", sql`${table.freeShippingThreshold} IS NULL OR ${table.freeShippingThreshold} >= 0`),
  check("governorates_estimated_days_positive", sql`${table.estimatedDays} > 0`),
]);

export const citiesTable = pgTable("cities", {
  id: serial("id").primaryKey(),
  governorateId: integer("governorate_id").notNull().references(() => governoratesTable.id, { onDelete: "cascade" }),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  shippingPriceOverride: numeric("shipping_price_override", { precision: 10, scale: 2 }),
  surcharge: numeric("surcharge", { precision: 10, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  check("cities_shipping_override_non_negative", sql`${table.shippingPriceOverride} IS NULL OR ${table.shippingPriceOverride} >= 0`),
  check("cities_surcharge_non_negative", sql`${table.surcharge} >= 0`),
]);

export const insertGovernorateSchema = createInsertSchema(governoratesTable).omit({ id: true, createdAt: true });
export type InsertGovernorate = z.infer<typeof insertGovernorateSchema>;
export type Governorate = typeof governoratesTable.$inferSelect;
export type City = typeof citiesTable.$inferSelect;

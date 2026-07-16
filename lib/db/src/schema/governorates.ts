import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
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
});

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
});

export const insertGovernorateSchema = createInsertSchema(governoratesTable).omit({ id: true, createdAt: true });
export type InsertGovernorate = z.infer<typeof insertGovernorateSchema>;
export type Governorate = typeof governoratesTable.$inferSelect;
export type City = typeof citiesTable.$inferSelect;

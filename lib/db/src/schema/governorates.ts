import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const governoratesTable = pgTable("governorates", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  freeShippingThreshold: numeric("free_shipping_threshold", { precision: 10, scale: 2 }),
  estimatedDays: integer("estimated_days").notNull().default(3),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGovernorateSchema = createInsertSchema(governoratesTable).omit({ id: true, createdAt: true });
export type InsertGovernorate = z.infer<typeof insertGovernorateSchema>;
export type Governorate = typeof governoratesTable.$inferSelect;

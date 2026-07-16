import { pgTable, text, serial, timestamp, boolean, integer, numeric, pgEnum, check, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { customersTable } from "./customers";

export const couponTypeEnum = pgEnum("coupon_type", ["percentage", "fixed", "free_shipping"]);

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: couponTypeEnum("type").notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: numeric("min_order_amount", { precision: 10, scale: 2 }),
  maxUses: integer("max_uses"),
  perCustomerLimit: integer("per_customer_limit"),
  productIds: integer("product_ids").array().notNull().default([]),
  categoryIds: integer("category_ids").array().notNull().default([]),
  usedCount: integer("used_count").notNull().default(0),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("coupons_code_case_insensitive_unique").on(sql`lower(${table.code})`),
  check("coupons_value_non_negative", sql`${table.value} >= 0`),
  check("coupons_percentage_range", sql`${table.type} <> 'percentage' OR ${table.value} <= 100`),
  check("coupons_min_order_non_negative", sql`${table.minOrderAmount} IS NULL OR ${table.minOrderAmount} >= 0`),
  check("coupons_max_uses_non_negative", sql`${table.maxUses} IS NULL OR ${table.maxUses} >= 0`),
  check("coupons_used_count_non_negative", sql`${table.usedCount} >= 0`),
  check("coupons_per_customer_limit_positive", sql`${table.perCustomerLimit} IS NULL OR ${table.perCustomerLimit} > 0`),
]);

export const couponUsageTable = pgTable("coupon_usage", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").notNull().references(() => couponsTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("coupon_usage_coupon_order_unique").on(table.couponId, table.orderId),
  index("coupon_usage_coupon_customer_idx").on(table.couponId, table.customerId),
  check("coupon_usage_discount_non_negative", sql`${table.discountAmount} >= 0`),
]);

export const insertCouponSchema = createInsertSchema(couponsTable).omit({ id: true, createdAt: true, usedCount: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof couponsTable.$inferSelect;

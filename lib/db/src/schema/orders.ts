import { pgTable, text, serial, timestamp, integer, numeric, pgEnum, jsonb, uniqueIndex, index, boolean, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { customersTable } from "./customers";
import { governoratesTable } from "./governorates";

export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "awaiting_confirmation",
  "confirmed",
  "preparing",
  "ready_for_shipping",
  "shipped",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "returned",
  "partially_returned",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["cash_on_delivery", "fawry"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "cash_on_delivery",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  checkoutToken: text("checkout_token").unique(),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  mobile: text("mobile").notNull(),
  primaryPhoneHasWhatsApp: boolean("primary_phone_has_whatsapp").notNull().default(true),
  altMobile: text("alt_mobile"),
  alternatePhoneHasWhatsApp: boolean("alternate_phone_has_whatsapp").notNull().default(false),
  preferredWhatsAppPhone: text("preferred_whatsapp_phone"),

  governorateId: integer("governorate_id").references(() => governoratesTable.id, { onDelete: "set null" }),
  governorateName: text("governorate_name").notNull(),
  city: text("city").notNull(),
  detailedAddress: text("detailed_address").notNull(),
  landmark: text("landmark"),
  deliveryNotes: text("delivery_notes"),
  orderNotes: text("order_notes"),
  internalNotes: text("internal_notes"),

  status: orderStatusEnum("status").notNull().default("new"),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash_on_delivery"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),

  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  couponDiscount: numeric("coupon_discount", { precision: 10, scale: 2 }).notNull().default("0"),
  couponCode: text("coupon_code"),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingBaseCost: numeric("shipping_base_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingSurcharge: numeric("shipping_surcharge", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingDiscount: numeric("shipping_discount", { precision: 10, scale: 2 }).notNull().default("0"),
  freeShippingReason: text("free_shipping_reason"),
  shippingRuleSnapshot: jsonb("shipping_rule_snapshot").$type<Record<string, unknown>>(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),

  estimatedDeliveryDate: text("estimated_delivery_date"),
  trackingNumber: text("tracking_number"),
  shippingCompany: text("shipping_company"),
  assignedToId: integer("assigned_to_id"),
  assignedToName: text("assigned_to_name"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  index("orders_status_created_idx").on(table.status, table.createdAt),
  index("orders_customer_created_idx").on(table.customerId, table.createdAt),
  index("orders_mobile_created_idx").on(table.mobile, table.createdAt),
  index("orders_governorate_created_idx").on(table.governorateId, table.createdAt),
  index("orders_created_idx").on(table.createdAt),
  check("orders_preferred_whatsapp_valid", sql`${table.preferredWhatsAppPhone} IS NULL OR (${table.primaryPhoneHasWhatsApp} AND ${table.preferredWhatsAppPhone} = ${table.mobile}) OR (${table.alternatePhoneHasWhatsApp} AND ${table.altMobile} IS NOT NULL AND ${table.preferredWhatsAppPhone} = ${table.altMobile})`),
]);

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  nameAr: text("name_ar").notNull(),
  coverImage: text("cover_image"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
}, table => [
  index("order_items_order_idx").on(table.orderId),
  index("order_items_product_order_idx").on(table.productId, table.orderId),
]);

export const orderStatusHistoryTable = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull(),
  notes: text("notes"),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("order_status_history_order_created_idx").on(table.orderId, table.createdAt)]);

export const cancellationRequestsTable = pgTable("cancellation_requests", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending / approved / rejected
  employeeDecision: text("employee_decision"),
  employeeNotes: text("employee_notes"),
  employeeId: integer("employee_id"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("cancellation_requests_one_pending_per_order").on(table.orderId).where(sql`${table.status} = 'pending'`),
  index("cancellation_requests_order_created_idx").on(table.orderId, table.createdAt),
  index("cancellation_requests_customer_created_idx").on(table.customerId, table.createdAt),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type OrderStatusHistory = typeof orderStatusHistoryTable.$inferSelect;
export type CancellationRequest = typeof cancellationRequestsTable.$inferSelect;

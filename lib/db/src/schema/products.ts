import { pgTable, text, serial, timestamp, boolean, integer, numeric, pgEnum, check, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stagesTable } from "./classifications";
import { gradesTable } from "./classifications";
import { subjectsTable } from "./classifications";
import { publishersTable } from "./classifications";
import { categoriesTable, subcategoriesTable } from "./classifications";

export const productStatusEnum = pgEnum("product_status", ["active", "draft", "archived"]);
export const customerNoticeTypeEnum = pgEnum("customer_notice_type", ["information", "warning", "preorder", "delayed_delivery", "custom"]);
export const customerNoticeTriggerEnum = pgEnum("customer_notice_trigger", ["product_open", "add_to_cart", "buy_now", "checkout", "first_interaction"]);

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  slug: text("slug").notNull().unique(),
  descriptionShort: text("description_short"),
  descriptionFull: text("description_full"),
  coverImage: text("cover_image"),
  images: text("images").array().notNull().default([]),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  oldPrice: numeric("old_price", { precision: 10, scale: 2 }),
  purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
  sku: text("sku").unique(),
  barcode: text("barcode"),
  status: productStatusEnum("status").notNull().default("active"),

  // Stock
  stockQuantity: integer("stock_quantity").notNull().default(0),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(5),

  // Classifications
  stageId: integer("stage_id").references(() => stagesTable.id, { onDelete: "set null" }),
  gradeId: integer("grade_id").references(() => gradesTable.id, { onDelete: "set null" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  publisherId: integer("publisher_id").references(() => publishersTable.id, { onDelete: "set null" }),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  subcategoryId: integer("subcategory_id").references(() => subcategoriesTable.id, { onDelete: "set null" }),
  educationType: text("education_type"), // عربي / لغات / أزهر
  bookType: text("book_type"),
  edition: text("edition"),
  schoolYear: text("school_year"),
  author: text("author"),

  // Flags
  isBestSeller: boolean("is_best_seller").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isNew: boolean("is_new").notNull().default(false),
  isRevision: boolean("is_revision").notNull().default(false),
  isBundle: boolean("is_bundle").notNull().default(false),
  isOffer: boolean("is_offer").notNull().default(false),
  freeShipping: boolean("free_shipping").notNull().default(false),
  freeShippingStartAt: timestamp("free_shipping_start_at", { withTimezone: true }),
  freeShippingEndAt: timestamp("free_shipping_end_at", { withTimezone: true }),
  freeShippingBadgeText: text("free_shipping_badge_text"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),

  customerNoticeEnabled: boolean("customer_notice_enabled").notNull().default(false),
  customerNoticeTitle: text("customer_notice_title"),
  customerNoticeMessage: text("customer_notice_message"),
  customerNoticeButtonText: text("customer_notice_button_text"),
  customerNoticeIcon: text("customer_notice_icon"),
  customerNoticeImageUrl: text("customer_notice_image_url"),
  customerNoticeType: customerNoticeTypeEnum("customer_notice_type"),
  customerNoticeTrigger: customerNoticeTriggerEnum("customer_notice_trigger"),
  customerNoticeStartAt: timestamp("customer_notice_start_at", { withTimezone: true }),
  customerNoticeEndAt: timestamp("customer_notice_end_at", { withTimezone: true }),
  customerNoticeDismissible: boolean("customer_notice_dismissible").notNull().default(false),

  sortOrder: integer("sort_order").notNull().default(0),
  salesCount: integer("sales_count").notNull().default(0),
  internalNotes: text("internal_notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, table => [
  index("products_status_created_idx").on(table.status, table.createdAt),
  index("products_category_status_idx").on(table.categoryId, table.status),
  index("products_publisher_status_idx").on(table.publisherId, table.status),
  index("products_grade_status_idx").on(table.gradeId, table.status),
  index("products_subject_status_idx").on(table.subjectId, table.status),
  index("products_stage_status_idx").on(table.stageId, table.status),
  index("products_status_sales_idx").on(table.status, table.salesCount),
  check("products_price_non_negative", sql`${table.price} >= 0`),
  check("products_old_price_non_negative", sql`${table.oldPrice} IS NULL OR ${table.oldPrice} >= 0`),
  check("products_purchase_price_non_negative", sql`${table.purchasePrice} IS NULL OR ${table.purchasePrice} >= 0`),
  check("products_stock_non_negative", sql`${table.stockQuantity} >= 0`),
  check("products_reserved_stock_non_negative", sql`${table.reservedQuantity} >= 0`),
  check("products_min_stock_non_negative", sql`${table.minStockLevel} >= 0`),
  check("products_customer_notice_dates_valid", sql`${table.customerNoticeEndAt} IS NULL OR ${table.customerNoticeStartAt} IS NULL OR ${table.customerNoticeEndAt} >= ${table.customerNoticeStartAt}`),
]);

export const productImagesTable = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  thumbnailUrl: text("thumbnail_url"),
  mediumUrl: text("medium_url"),
  largeUrl: text("large_url"),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("size_bytes"),
  mimeType: text("mime_type"),
  variants: jsonb("variants").$type<Record<string, { url: string; width: number; height: number; size: number }>>(),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("product_images_one_primary_per_product").on(table.productId).where(sql`${table.isPrimary} = true`),
  index("product_images_product_sort_idx").on(table.productId, table.sortOrder),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type ProductImage = typeof productImagesTable.$inferSelect;

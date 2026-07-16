import { pgTable, text, serial, timestamp, boolean, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stagesTable } from "./classifications";
import { gradesTable } from "./classifications";
import { subjectsTable } from "./classifications";
import { publishersTable } from "./classifications";
import { categoriesTable } from "./classifications";

export const productStatusEnum = pgEnum("product_status", ["active", "draft", "archived"]);

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

  sortOrder: integer("sort_order").notNull().default(0),
  salesCount: integer("sales_count").notNull().default(0),
  internalNotes: text("internal_notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const productImagesTable = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type ProductImage = typeof productImagesTable.$inferSelect;

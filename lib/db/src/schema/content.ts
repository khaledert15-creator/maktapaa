import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, serial, timestamp, boolean, integer, jsonb, check, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const siteSettingsTable = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const heroTextAlignmentEnum = pgEnum("hero_text_alignment", ["right", "center", "left"]);

export const bannersTable = pgTable("banners", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  imageStorageKey: text("image_storage_key"),
  imageWidth: integer("image_width"),
  imageHeight: integer("image_height"),
  imageVariants: jsonb("image_variants").$type<Record<string, { url: string; width: number; height: number; size: number }>>(),
  titleAr: text("title_ar"),
  subtitleAr: text("subtitle_ar"),
  badgeText: text("badge_text"),
  primaryButtonText: text("primary_button_text"),
  primaryButtonUrl: text("primary_button_url"),
  secondaryButtonText: text("secondary_button_text"),
  secondaryButtonUrl: text("secondary_button_url"),
  textAlignment: heroTextAlignmentEnum("text_alignment").notNull().default("right"),
  linkUrl: text("link_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  check("banners_dates_valid", sql`${table.endAt} IS NULL OR ${table.startAt} IS NULL OR ${table.endAt} >= ${table.startAt}`),
  index("banners_public_schedule_idx").on(table.isActive, table.sortOrder, table.startAt, table.endAt),
]);

export const faqsTable = pgTable("faqs", {
  id: serial("id").primaryKey(),
  questionAr: text("question_ar").notNull(),
  answerAr: text("answer_ar").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const helpDeviceVisibilityEnum = pgEnum("help_device_visibility", ["all", "desktop", "mobile"]);
export const helpLinkTargetEnum = pgEnum("help_link_target", ["same_tab", "new_tab"]);

export const helpSectionsTable = pgTable("help_sections", {
  id: serial("id").primaryKey(),
  titleAr: text("title_ar").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const helpLinksTable = pgTable("help_links", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull().references(() => helpSectionsTable.id, { onDelete: "cascade" }),
  textAr: text("text_ar").notNull(),
  textEn: text("text_en"),
  url: text("url").notNull(),
  target: helpLinkTargetEnum("target").notNull().default("same_tab"),
  icon: text("icon"),
  deviceVisibility: helpDeviceVisibilityEnum("device_visibility").notNull().default("all"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  check("help_links_dates_valid", sql`${table.endAt} IS NULL OR ${table.startAt} IS NULL OR ${table.endAt} >= ${table.startAt}`),
  check("help_links_sort_order_non_negative", sql`${table.sortOrder} >= 0`),
  index("help_links_public_idx").on(table.sectionId, table.isActive, table.sortOrder, table.startAt, table.endAt),
]);

export const brandAssetKindEnum = pgEnum("brand_asset_kind", ["main", "dark_background", "light_background", "mobile", "favicon", "admin", "social"]);

export const brandAssetsTable = pgTable("brand_assets", {
  id: serial("id").primaryKey(),
  kind: brandAssetKindEnum("kind").notNull().unique(),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("size_bytes"),
  variants: jsonb("variants").$type<Record<string, { url: string; width: number; height: number; size: number }>>(),
  altTextAr: text("alt_text_ar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [index("brand_assets_kind_idx").on(table.kind)]);

export const insertBannerSchema = createInsertSchema(bannersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof bannersTable.$inferSelect;
export type Faq = typeof faqsTable.$inferSelect;
export type HelpSection = typeof helpSectionsTable.$inferSelect;
export type HelpLink = typeof helpLinksTable.$inferSelect;
export type BrandAsset = typeof brandAssetsTable.$inferSelect;

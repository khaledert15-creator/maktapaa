import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const siteSettingsTable = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bannersTable = pgTable("banners", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  imageStorageKey: text("image_storage_key"),
  imageWidth: integer("image_width"),
  imageHeight: integer("image_height"),
  imageVariants: jsonb("image_variants").$type<Record<string, { url: string; width: number; height: number; size: number }>>(),
  titleAr: text("title_ar"),
  subtitleAr: text("subtitle_ar"),
  linkUrl: text("link_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const faqsTable = pgTable("faqs", {
  id: serial("id").primaryKey(),
  questionAr: text("question_ar").notNull(),
  answerAr: text("answer_ar").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBannerSchema = createInsertSchema(bannersTable).omit({ id: true, createdAt: true });
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof bannersTable.$inferSelect;
export type Faq = typeof faqsTable.$inferSelect;

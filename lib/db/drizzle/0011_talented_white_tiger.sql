CREATE TYPE "public"."hero_text_alignment" AS ENUM('right', 'center', 'left');--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "badge_text" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "primary_button_text" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "primary_button_url" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "secondary_button_text" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "secondary_button_url" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "text_alignment" "hero_text_alignment" DEFAULT 'right' NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "banners"
SET "badge_text" = COALESCE("badge_text", 'اختيارات ذكية لكل طالب'),
    "primary_button_text" = COALESCE("primary_button_text", 'ابدأ التصفح'),
    "primary_button_url" = COALESCE("primary_button_url", "link_url", '/catalog'),
    "secondary_button_text" = COALESCE("secondary_button_text", 'العروض الحالية'),
    "secondary_button_url" = COALESCE("secondary_button_url", '/offers');--> statement-breakpoint
INSERT INTO "site_settings" ("key", "value") VALUES ('announcementLink', '') ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "site_settings" ("key", "value") VALUES ('announcementStartAt', '') ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "site_settings" ("key", "value") VALUES ('announcementEndAt', '') ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
CREATE INDEX "banners_public_schedule_idx" ON "banners" USING btree ("is_active","sort_order","start_at","end_at");--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_dates_valid" CHECK ("banners"."end_at" IS NULL OR "banners"."start_at" IS NULL OR "banners"."end_at" >= "banners"."start_at");

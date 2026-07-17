CREATE TYPE "public"."brand_asset_kind" AS ENUM('main', 'dark_background', 'light_background', 'mobile', 'favicon', 'admin', 'social');--> statement-breakpoint
CREATE TYPE "public"."help_device_visibility" AS ENUM('all', 'desktop', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."help_link_target" AS ENUM('same_tab', 'new_tab');--> statement-breakpoint
CREATE TABLE "brand_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "brand_asset_kind" NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"variants" jsonb,
	"alt_text_ar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_assets_kind_unique" UNIQUE("kind"),
	CONSTRAINT "brand_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "help_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"text_ar" text NOT NULL,
	"url" text NOT NULL,
	"target" "help_link_target" DEFAULT 'same_tab' NOT NULL,
	"icon" text,
	"device_visibility" "help_device_visibility" DEFAULT 'all' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_links_dates_valid" CHECK ("help_links"."end_at" IS NULL OR "help_links"."start_at" IS NULL OR "help_links"."end_at" >= "help_links"."start_at"),
	CONSTRAINT "help_links_sort_order_non_negative" CHECK ("help_links"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "help_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"title_ar" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "brand_assets" ("kind", "url", "storage_key", "mime_type", "alt_text_ar")
SELECT 'main'::"brand_asset_kind", "value", 'legacy/site-settings-logo',
  CASE WHEN lower("value") LIKE '%.svg%' THEN 'image/svg+xml' ELSE 'image/webp' END,
  'شعار مكتبة دوت كوم'
FROM "site_settings"
WHERE "key" = 'logoUrl' AND nullif(trim("value"), '') IS NOT NULL
ON CONFLICT ("kind") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "customers" RENAME COLUMN "mobile" TO "primary_phone";--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_mobile_unique";--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "primary_phone" text;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "primary_phone_has_whatsapp" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "alternate_phone" text;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "alternate_phone_has_whatsapp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "preferred_whatsapp_phone" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "primary_phone_has_whatsapp" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "alternate_phone" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "alternate_phone_has_whatsapp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "preferred_whatsapp_phone" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_icon" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_image_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "primary_phone_has_whatsapp" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "alternate_phone_has_whatsapp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "preferred_whatsapp_phone" text;--> statement-breakpoint
UPDATE "customers" SET "preferred_whatsapp_phone" = "primary_phone" WHERE "preferred_whatsapp_phone" IS NULL;--> statement-breakpoint
UPDATE "addresses" AS a SET
  "primary_phone" = c."primary_phone",
  "primary_phone_has_whatsapp" = c."primary_phone_has_whatsapp",
  "alternate_phone" = c."alternate_phone",
  "alternate_phone_has_whatsapp" = c."alternate_phone_has_whatsapp",
  "preferred_whatsapp_phone" = c."preferred_whatsapp_phone"
FROM "customers" AS c WHERE a."customer_id" = c."id";--> statement-breakpoint
UPDATE "orders" SET "preferred_whatsapp_phone" = "mobile" WHERE "preferred_whatsapp_phone" IS NULL;--> statement-breakpoint
WITH section AS (
  INSERT INTO "help_sections" ("title_ar", "is_active") VALUES ('مساعدة وخدمة العملاء', true) RETURNING "id"
)
INSERT INTO "help_links" ("section_id", "text_ar", "url", "target", "icon", "device_visibility", "sort_order", "is_active")
SELECT section.id, item.text_ar, item.url, 'same_tab'::"help_link_target", item.icon, 'all'::"help_device_visibility", item.sort_order, true
FROM section CROSS JOIN (VALUES
  ('تتبع طلبك', '/track', 'package-search', 1),
  ('الأسئلة الشائعة', '/faq', 'help-circle', 2),
  ('سياسة الشحن', '/shipping-policy', 'truck', 3),
  ('الإلغاء والاسترجاع', '/return-policy', 'rotate-ccw', 4),
  ('سياسة الخصوصية', '/privacy', 'shield', 5),
  ('الشروط والأحكام', '/terms', 'file-text', 6)
) AS item(text_ar, url, icon, sort_order);--> statement-breakpoint
ALTER TABLE "help_links" ADD CONSTRAINT "help_links_section_id_help_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."help_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_assets_kind_idx" ON "brand_assets" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "help_links_public_idx" ON "help_links" USING btree ("section_id","is_active","sort_order","start_at","end_at");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_primary_phone_unique" UNIQUE("primary_phone");--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_preferred_whatsapp_valid" CHECK ("addresses"."preferred_whatsapp_phone" IS NULL OR ("addresses"."primary_phone_has_whatsapp" AND "addresses"."preferred_whatsapp_phone" = "addresses"."primary_phone") OR ("addresses"."alternate_phone_has_whatsapp" AND "addresses"."alternate_phone" IS NOT NULL AND "addresses"."preferred_whatsapp_phone" = "addresses"."alternate_phone"));--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_preferred_whatsapp_valid" CHECK ("customers"."preferred_whatsapp_phone" IS NULL OR ("customers"."primary_phone_has_whatsapp" AND "customers"."preferred_whatsapp_phone" = "customers"."primary_phone") OR ("customers"."alternate_phone_has_whatsapp" AND "customers"."alternate_phone" IS NOT NULL AND "customers"."preferred_whatsapp_phone" = "customers"."alternate_phone"));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_preferred_whatsapp_valid" CHECK ("orders"."preferred_whatsapp_phone" IS NULL OR ("orders"."primary_phone_has_whatsapp" AND "orders"."preferred_whatsapp_phone" = "orders"."mobile") OR ("orders"."alternate_phone_has_whatsapp" AND "orders"."alt_mobile" IS NOT NULL AND "orders"."preferred_whatsapp_phone" = "orders"."alt_mobile"));

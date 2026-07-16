CREATE TYPE "public"."classification_option_kind" AS ENUM('teacher', 'school_year', 'education_type');--> statement-breakpoint
CREATE TYPE "public"."customer_notice_trigger" AS ENUM('product_open', 'add_to_cart', 'buy_now', 'checkout', 'first_interaction');--> statement-breakpoint
CREATE TYPE "public"."customer_notice_type" AS ENUM('information', 'warning', 'preorder', 'delayed_delivery', 'custom');--> statement-breakpoint
CREATE TABLE "classification_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "classification_option_kind" NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "grades" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "publishers" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publishers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "min_delivery_days" integer;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "max_delivery_days" integer;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "governorates" ADD COLUMN "min_delivery_days" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "governorates" ADD COLUMN "max_delivery_days" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
UPDATE "governorates"
SET "min_delivery_days" = greatest(0, "estimated_days" - 1),
    "max_delivery_days" = greatest(0, "estimated_days");--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "subcategory_id" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_title" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_message" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_button_text" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_type" "customer_notice_type";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_trigger" "customer_notice_trigger";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customer_notice_dismissible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
INSERT INTO "classification_options" ("kind", "name_ar")
SELECT 'teacher', trim("author") FROM "products" WHERE nullif(trim("author"), '') IS NOT NULL GROUP BY trim("author");--> statement-breakpoint
INSERT INTO "classification_options" ("kind", "name_ar")
SELECT 'school_year', trim("school_year") FROM "products" WHERE nullif(trim("school_year"), '') IS NOT NULL GROUP BY trim("school_year");--> statement-breakpoint
INSERT INTO "classification_options" ("kind", "name_ar")
SELECT 'education_type', trim("education_type") FROM "products" WHERE nullif(trim("education_type"), '') IS NOT NULL GROUP BY trim("education_type");--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classification_options_kind_active_idx" ON "classification_options" USING btree ("kind","is_active");--> statement-breakpoint
CREATE INDEX "subcategories_category_active_idx" ON "subcategories" USING btree ("category_id","is_active");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_min_delivery_days_non_negative" CHECK ("cities"."min_delivery_days" IS NULL OR "cities"."min_delivery_days" >= 0);--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_delivery_days_valid" CHECK ("cities"."max_delivery_days" IS NULL OR ("cities"."min_delivery_days" IS NOT NULL AND "cities"."max_delivery_days" >= "cities"."min_delivery_days"));--> statement-breakpoint
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_min_delivery_days_non_negative" CHECK ("governorates"."min_delivery_days" >= 0);--> statement-breakpoint
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_delivery_days_valid" CHECK ("governorates"."max_delivery_days" >= "governorates"."min_delivery_days");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_customer_notice_dates_valid" CHECK ("products"."customer_notice_end_at" IS NULL OR "products"."customer_notice_start_at" IS NULL OR "products"."customer_notice_end_at" >= "products"."customer_notice_start_at");

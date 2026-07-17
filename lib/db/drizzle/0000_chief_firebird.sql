CREATE TYPE "public"."user_role" AS ENUM('owner', 'administrator', 'sales', 'customer_service', 'warehouse', 'shipping', 'accountant', 'content_manager');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('purchase', 'sale', 'return', 'damaged', 'manual_increase', 'manual_decrease', 'adjustment', 'reservation', 'reservation_release');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'awaiting_confirmation', 'confirmed', 'preparing', 'ready_for_shipping', 'shipped', 'out_for_delivery', 'delivered', 'delivery_failed', 'returned', 'partially_returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash_on_delivery', 'fawry');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'cash_on_delivery', 'paid', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."coupon_type" AS ENUM('percentage', 'fixed', 'free_shipping');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'sales' NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" serial NOT NULL,
	"governorate_id" serial NOT NULL,
	"governorate_name" text NOT NULL,
	"city" text NOT NULL,
	"detailed_address" text NOT NULL,
	"landmark" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"mobile" text NOT NULL,
	"password_hash" text,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_unique" UNIQUE("email"),
	CONSTRAINT "customers_mobile_unique" UNIQUE("mobile")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"slug" text NOT NULL,
	"image" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"stage_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"logo" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governorates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"shipping_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"free_shipping_threshold" numeric(10, 2),
	"estimated_days" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"slug" text NOT NULL,
	"description_short" text,
	"description_full" text,
	"cover_image" text,
	"images" text[] DEFAULT '{}' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"old_price" numeric(10, 2),
	"sku" text,
	"barcode" text,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"min_stock_level" integer DEFAULT 5 NOT NULL,
	"stage_id" integer,
	"grade_id" integer,
	"subject_id" integer,
	"publisher_id" integer,
	"education_type" text,
	"book_type" text,
	"edition" text,
	"school_year" text,
	"author" text,
	"is_best_seller" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"is_revision" boolean DEFAULT false NOT NULL,
	"is_bundle" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"movement_type" "stock_movement_type" NOT NULL,
	"quantity_before" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"quantity_changed" integer NOT NULL,
	"reason" text,
	"order_id" integer,
	"employee_id" integer,
	"employee_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cancellation_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"customer_id" integer,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"employee_decision" text,
	"employee_notes" text,
	"employee_id" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"name_ar" text NOT NULL,
	"cover_image" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" "order_status" NOT NULL,
	"notes" text,
	"employee_id" integer,
	"employee_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"mobile" text NOT NULL,
	"alt_mobile" text,
	"governorate_id" integer,
	"governorate_name" text NOT NULL,
	"city" text NOT NULL,
	"detailed_address" text NOT NULL,
	"landmark" text,
	"delivery_notes" text,
	"order_notes" text,
	"internal_notes" text,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cash_on_delivery' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"coupon_discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"coupon_code" text,
	"shipping_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"estimated_delivery_date" text,
	"tracking_number" text,
	"shipping_company" text,
	"assigned_to_id" integer,
	"assigned_to_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "coupon_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"coupon_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"customer_id" integer,
	"discount_amount" numeric(10, 2) NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" "coupon_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"min_order_amount" numeric(10, 2),
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"start_date" text,
	"end_date" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"title_ar" text,
	"subtitle_ar" text,
	"link_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_ar" text NOT NULL,
	"answer_ar" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"is_approved" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"sid" text PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_governorate_id_governorates_id_fk" FOREIGN KEY ("governorate_id") REFERENCES "public"."governorates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
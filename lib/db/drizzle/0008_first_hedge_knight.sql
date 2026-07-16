CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "medium_url" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "large_url" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "variants" jsonb;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "image_storage_key" text;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "image_width" integer;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "image_height" integer;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "image_variants" jsonb;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_customer_created_idx" ON "password_reset_tokens" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "grades_stage_active_idx" ON "grades" USING btree ("stage_id","is_active");--> statement-breakpoint
CREATE INDEX "cities_governorate_active_idx" ON "cities" USING btree ("governorate_id","is_active");--> statement-breakpoint
CREATE INDEX "product_images_product_sort_idx" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "products_status_created_idx" ON "products" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "products_category_status_idx" ON "products" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "products_publisher_status_idx" ON "products" USING btree ("publisher_id","status");--> statement-breakpoint
CREATE INDEX "products_grade_status_idx" ON "products" USING btree ("grade_id","status");--> statement-breakpoint
CREATE INDEX "products_subject_status_idx" ON "products" USING btree ("subject_id","status");--> statement-breakpoint
CREATE INDEX "products_stage_status_idx" ON "products" USING btree ("stage_id","status");--> statement-breakpoint
CREATE INDEX "products_status_sales_idx" ON "products" USING btree ("status","sales_count");--> statement-breakpoint
CREATE INDEX "stock_movements_product_created_idx" ON "stock_movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_order_idx" ON "stock_movements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "cancellation_requests_order_created_idx" ON "cancellation_requests" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_order_idx" ON "order_items" USING btree ("product_id","order_id");--> statement-breakpoint
CREATE INDEX "order_status_history_order_created_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_created_idx" ON "orders" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_mobile_created_idx" ON "orders" USING btree ("mobile","created_at");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "coupons_active_dates_idx" ON "coupons" USING btree ("is_active","start_date","end_date");--> statement-breakpoint
CREATE INDEX "reviews_product_moderation_created_idx" ON "reviews" USING btree ("product_id","moderation_status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_customer_idx" ON "reviews" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_employee_created_idx" ON "audit_logs" USING btree ("employee_id","created_at");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "products_name_ar_trgm_idx" ON "products" USING gin ("name_ar" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "products_author_trgm_idx" ON "products" USING gin ("author" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "publishers_name_ar_trgm_idx" ON "publishers" USING gin ("name_ar" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "subjects_name_ar_trgm_idx" ON "subjects" USING gin ("name_ar" gin_trgm_ops);

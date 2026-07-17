CREATE TYPE "public"."review_moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "reference_key" text;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "per_customer_limit" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "product_ids" integer[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "category_ids" integer[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "moderation_status" "review_moderation_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "verified_purchase" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "reviews" SET "moderation_status" = 'approved' WHERE "is_approved" = 1;--> statement-breakpoint
WITH ranked_primary_images AS (
	SELECT "id", row_number() OVER (PARTITION BY "product_id" ORDER BY "sort_order", "id") AS position
	FROM "product_images" WHERE "is_primary" = true
)
UPDATE "product_images" SET "is_primary" = false
WHERE "id" IN (SELECT "id" FROM ranked_primary_images WHERE position > 1);--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_one_primary_per_product" ON "product_images" USING btree ("product_id") WHERE "product_images"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_usage_coupon_order_unique" ON "coupon_usage" USING btree ("coupon_id","order_id");--> statement-breakpoint
CREATE INDEX "coupon_usage_coupon_customer_idx" ON "coupon_usage" USING btree ("coupon_id","customer_id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reference_key_unique" UNIQUE("reference_key");--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_shipping_override_non_negative" CHECK ("cities"."shipping_price_override" IS NULL OR "cities"."shipping_price_override" >= 0);--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_surcharge_non_negative" CHECK ("cities"."surcharge" >= 0);--> statement-breakpoint
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_shipping_non_negative" CHECK ("governorates"."shipping_cost" >= 0);--> statement-breakpoint
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_surcharge_non_negative" CHECK ("governorates"."remote_area_surcharge" >= 0);--> statement-breakpoint
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_threshold_non_negative" CHECK ("governorates"."free_shipping_threshold" IS NULL OR "governorates"."free_shipping_threshold" >= 0);--> statement-breakpoint
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_estimated_days_positive" CHECK ("governorates"."estimated_days" > 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_price_non_negative" CHECK ("products"."price" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_old_price_non_negative" CHECK ("products"."old_price" IS NULL OR "products"."old_price" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_purchase_price_non_negative" CHECK ("products"."purchase_price" IS NULL OR "products"."purchase_price" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_non_negative" CHECK ("products"."stock_quantity" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_reserved_stock_non_negative" CHECK ("products"."reserved_quantity" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_min_stock_non_negative" CHECK ("products"."min_stock_level" >= 0);--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_discount_non_negative" CHECK ("coupon_usage"."discount_amount" >= 0);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_value_non_negative" CHECK ("coupons"."value" >= 0);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_percentage_range" CHECK ("coupons"."type" <> 'percentage' OR "coupons"."value" <= 100);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_min_order_non_negative" CHECK ("coupons"."min_order_amount" IS NULL OR "coupons"."min_order_amount" >= 0);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_max_uses_non_negative" CHECK ("coupons"."max_uses" IS NULL OR "coupons"."max_uses" >= 0);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_used_count_non_negative" CHECK ("coupons"."used_count" >= 0);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_per_customer_limit_positive" CHECK ("coupons"."per_customer_limit" IS NULL OR "coupons"."per_customer_limit" > 0);--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 5);

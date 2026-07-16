ALTER TABLE "orders" ADD COLUMN "checkout_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_customer_product_unique" ON "favorites" USING btree ("customer_id","product_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_token_unique" UNIQUE("checkout_token");
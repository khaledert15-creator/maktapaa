CREATE INDEX "addresses_customer_default_idx" ON "addresses" USING btree ("customer_id","is_default");--> statement-breakpoint
CREATE INDEX "addresses_governorate_idx" ON "addresses" USING btree ("governorate_id");--> statement-breakpoint
CREATE INDEX "cancellation_requests_customer_created_idx" ON "cancellation_requests" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_governorate_created_idx" ON "orders" USING btree ("governorate_id","created_at");
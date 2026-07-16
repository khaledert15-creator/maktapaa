WITH ranked_pending_requests AS (
	SELECT "id", row_number() OVER (PARTITION BY "order_id" ORDER BY "created_at", "id") AS position
	FROM "cancellation_requests" WHERE "status" = 'pending'
)
UPDATE "cancellation_requests"
SET "status" = 'rejected', "employee_decision" = 'rejected', "employee_notes" = 'Superseded by security migration', "decided_at" = now()
WHERE "id" IN (SELECT "id" FROM ranked_pending_requests WHERE position > 1);--> statement-breakpoint
CREATE UNIQUE INDEX "cancellation_requests_one_pending_per_order" ON "cancellation_requests" USING btree ("order_id") WHERE "cancellation_requests"."status" = 'pending';

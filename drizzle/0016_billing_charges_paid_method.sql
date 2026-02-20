-- paid_method para método de pagamento (Stripe, Wise, etc.) e índice em line_item_id
ALTER TABLE "billing_charges" ADD COLUMN IF NOT EXISTS "paid_method" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_charges_line_item_id_idx" ON "billing_charges" ("line_item_id");

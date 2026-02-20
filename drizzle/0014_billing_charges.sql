-- Tabela de cobranças (itens Endereço Mensal/Anual)

CREATE TABLE IF NOT EXISTS "billing_charges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "line_item_id" uuid NOT NULL REFERENCES "client_line_items"("id") ON DELETE CASCADE,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "due_date" date NOT NULL,
  "paid_at" timestamp with time zone,
  "provider" varchar(20) DEFAULT 'manual',
  "provider_ref" varchar(255),
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_charges_line_item_period_unique" ON "billing_charges" ("line_item_id", "period_start", "period_end");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_charges_status_due_date_idx" ON "billing_charges" ("status", "due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_charges_client_id_idx" ON "billing_charges" ("client_id");

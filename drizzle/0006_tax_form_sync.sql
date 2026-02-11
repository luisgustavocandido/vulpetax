-- Add tax form source fields to clients
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "tax_form_source" varchar(50);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "tax_form_submitted_at" timestamp with time zone;

-- Index for filtering by tax form source
CREATE INDEX IF NOT EXISTS "idx_clients_tax_form_source"
  ON "clients" ("tax_form_source")
  WHERE "deleted_at" IS NULL;

-- sync_state table for tracking sync runs
CREATE TABLE IF NOT EXISTS "sync_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(100) NOT NULL UNIQUE,
  "last_synced_at" timestamp with time zone,
  "last_run_status" varchar(20),
  "last_run_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

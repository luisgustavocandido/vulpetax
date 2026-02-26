-- Metas mensais (LLCs + Receita) para dashboard executivo

CREATE TABLE IF NOT EXISTS "monthly_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "month" varchar(7) NOT NULL,
  "llc_target" integer NOT NULL DEFAULT 0,
  "revenue_target_cents" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_targets_month_unique" ON "monthly_targets" ("month");

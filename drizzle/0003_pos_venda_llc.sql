-- Refatoração: clients -> Pós Venda LLC (tabela clients vazia)
-- Remove colunas antigas, adiciona novas, cria client_line_items e client_partners

ALTER TABLE "clients" DROP COLUMN IF EXISTS "name";
ALTER TABLE "clients" DROP COLUMN IF EXISTS "email";
ALTER TABLE "clients" DROP COLUMN IF EXISTS "cpf_cnpj";
ALTER TABLE "clients" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "clients" DROP COLUMN IF EXISTS "status";
--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_email_unique";
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_cpf_cnpj_unique";
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "company_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "clients" ADD COLUMN "customer_code" varchar(100) NOT NULL DEFAULT '';
ALTER TABLE "clients" ADD COLUMN "payment_date" date;
ALTER TABLE "clients" ADD COLUMN "commercial" varchar(50);
ALTER TABLE "clients" ADD COLUMN "sdr" varchar(50);
ALTER TABLE "clients" ADD COLUMN "business_type" varchar(255);
ALTER TABLE "clients" ADD COLUMN "payment_method" varchar(100);
ALTER TABLE "clients" ADD COLUMN "anonymous" boolean NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN "holding" boolean NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN "affiliate" boolean NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN "express" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "company_name" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "customer_code" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_customer_code_unique" UNIQUE("customer_code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_line_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "kind" varchar(50) NOT NULL,
  "description" text NOT NULL,
  "value_cents" integer DEFAULT 0 NOT NULL,
  "meta" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_line_items_client_id" ON "client_line_items" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_client_line_items_kind" ON "client_line_items" ("kind");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_partners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "full_name" text NOT NULL,
  "role" varchar(30) NOT NULL,
  "percentage_basis_points" integer NOT NULL,
  "phone" varchar(50),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_partners_client_id" ON "client_partners" ("client_id");

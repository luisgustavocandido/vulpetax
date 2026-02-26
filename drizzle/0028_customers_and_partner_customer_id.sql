-- Criar tabela customers (clientes pagadores)
CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "given_name" text NOT NULL,
  "sur_name" text NOT NULL,
  "citizenship_country" text NOT NULL,
  "phone" text,
  "email" text NOT NULL,
  "address_line1" text NOT NULL,
  "address_line2" text,
  "city" text NOT NULL,
  "state_province" text NOT NULL,
  "postal_code" text NOT NULL,
  "country" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "customers_email_idx" ON "customers" ("email");
CREATE INDEX IF NOT EXISTS "customers_phone_idx" ON "customers" ("phone");
CREATE INDEX IF NOT EXISTS "customers_full_name_idx" ON "customers" (lower("full_name"));

-- Adicionar customer_id em client_partners (FK para customers.id, ON DELETE SET NULL)
ALTER TABLE "client_partners" ADD COLUMN IF NOT EXISTS "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "client_partners_customer_id_idx" ON "client_partners" ("customer_id");

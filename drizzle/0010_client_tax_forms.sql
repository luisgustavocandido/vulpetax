-- Nova tabela para suportar múltiplos TAX forms por cliente (1:N)
-- Mantém client_tax_profile para compatibilidade (1:1 antigo)

CREATE TABLE IF NOT EXISTS "client_tax_forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "tax_year" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "llc_name" text,
  "formation_date" date,
  "activities_description" text,
  "ein_number" text,
  "llc_us_address_line1" text,
  "llc_us_address_line2" text,
  "llc_us_city" text,
  "llc_us_state" text,
  "llc_us_zip" text,
  "owner_email" text,
  "owner_full_legal_name" text,
  "owner_residence_country" text,
  "owner_citizenship_country" text,
  "owner_home_address_different" boolean DEFAULT false,
  "owner_residential_address_line1" text,
  "owner_residential_address_line2" text,
  "owner_residential_city" text,
  "owner_residential_state" text,
  "owner_residential_postal_code" text,
  "owner_residential_country" text,
  "owner_us_tax_id" text,
  "owner_foreign_tax_id" text,
  "llc_formation_cost_usd_cents" integer,
  "has_additional_owners" boolean DEFAULT false,
  "total_assets_usd_cents" integer,
  "has_us_bank_accounts" boolean DEFAULT false,
  "aggregate_balance_over10k" boolean DEFAULT false,
  "total_withdrawals_usd_cents" integer,
  "total_transferred_to_llc_usd_cents" integer,
  "total_withdrawn_from_llc_usd_cents" integer,
  "personal_expenses_paid_by_company_usd_cents" integer,
  "business_expenses_paid_personally_usd_cents" integer,
  "fbar_withdrawals_total_usd_cents" integer,
  "fbar_personal_transfers_to_llc_usd_cents" integer,
  "fbar_personal_withdrawals_from_llc_usd_cents" integer,
  "fbar_personal_expenses_paid_by_company_usd_cents" integer,
  "fbar_business_expenses_paid_personally_usd_cents" integer,
  "passport_copies_provided" boolean DEFAULT false,
  "articles_of_organization_provided" boolean DEFAULT false,
  "ein_letter_provided" boolean DEFAULT false,
  "additional_documents_provided" boolean DEFAULT false,
  "additional_documents_notes" text,
  "declaration_accepted" boolean DEFAULT false,
  "declaration_accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "client_tax_forms_client_id_idx" ON "client_tax_forms"("client_id");
CREATE INDEX IF NOT EXISTS "client_tax_forms_tax_year_idx" ON "client_tax_forms"("tax_year");
CREATE UNIQUE INDEX IF NOT EXISTS "client_tax_forms_client_year_unique" ON "client_tax_forms"("client_id", "tax_year");

-- Adicionar tax_form_id em client_tax_owners (opcional, para vincular owners a um form específico)
-- Mantém client_id para compatibilidade
ALTER TABLE "client_tax_owners" ADD COLUMN IF NOT EXISTS "tax_form_id" uuid REFERENCES "client_tax_forms"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "client_tax_owners_tax_form_id_idx" ON "client_tax_owners"("tax_form_id");

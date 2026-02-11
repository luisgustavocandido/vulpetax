-- TAX (Não Residentes) - Formulário Form 5472 + 1120

CREATE TABLE IF NOT EXISTS "client_tax_profile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL UNIQUE REFERENCES "clients"("id") ON DELETE CASCADE,
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
  "passport_copies_provided" boolean DEFAULT false,
  "articles_of_organization_provided" boolean DEFAULT false,
  "ein_letter_provided" boolean DEFAULT false,
  "additional_documents_provided" boolean DEFAULT false,
  "additional_documents_notes" text,
  "declaration_accepted" boolean DEFAULT false,
  "declaration_accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_tax_owners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "owner_index" integer NOT NULL,
  "email" text,
  "full_legal_name" text,
  "residence_country" text,
  "citizenship_country" text,
  "home_address_different" boolean DEFAULT false,
  "us_tax_id" text,
  "foreign_tax_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "client_tax_owners_client_owner_unique" UNIQUE("client_id", "owner_index")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_tax_owners_client_id_idx" ON "client_tax_owners" ("client_id");

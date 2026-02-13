-- Endereço residencial do proprietário principal (quando diferente do endereço da LLC)

ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "owner_residential_address_line1" text;
ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "owner_residential_address_line2" text;
ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "owner_residential_city" text;
ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "owner_residential_state" text;
ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "owner_residential_postal_code" text;
ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "owner_residential_country" text;

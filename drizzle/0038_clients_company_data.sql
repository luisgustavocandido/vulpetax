-- Dados da Empresa (seção opcional do cadastro)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "ein_number" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "business_id" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "company_address_line1" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "company_address_line2" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "formation_date" date;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "annual_report_date" date;

-- FBAR (Form 114): 5 campos adicionais quando has_us_bank_accounts=true e aggregate_balance_over10k=true

ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "fbar_withdrawals_total_usd_cents" integer;
ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "fbar_personal_transfers_to_llc_usd_cents" integer;
ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "fbar_personal_withdrawals_from_llc_usd_cents" integer;
ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "fbar_personal_expenses_paid_by_company_usd_cents" integer;
ALTER TABLE "client_tax_profile" ADD COLUMN IF NOT EXISTS "fbar_business_expenses_paid_personally_usd_cents" integer;

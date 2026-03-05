-- Tipo de afiliado e texto livre quando tipo = Outros (seção EMPRESA > Afiliado)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "affiliate_type" varchar(50);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "affiliate_other_text" text;

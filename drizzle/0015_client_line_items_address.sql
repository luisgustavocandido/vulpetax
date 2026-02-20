-- Endereço do item (kind=Endereço): provedor, linhas de endereço e STE (New Mexico)
ALTER TABLE "client_line_items" ADD COLUMN IF NOT EXISTS "address_provider" varchar(50);
ALTER TABLE "client_line_items" ADD COLUMN IF NOT EXISTS "address_line1" text;
ALTER TABLE "client_line_items" ADD COLUMN IF NOT EXISTS "address_line2" text;
ALTER TABLE "client_line_items" ADD COLUMN IF NOT EXISTS "ste_number" varchar(20);

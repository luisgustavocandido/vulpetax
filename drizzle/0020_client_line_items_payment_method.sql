-- Migração: Adicionar payment_method e payment_method_custom em client_line_items
-- Move a forma de pagamento do nível do cliente para o nível de cada item

-- 1. Adicionar colunas
ALTER TABLE "client_line_items" ADD COLUMN "payment_method" varchar(100);
ALTER TABLE "client_line_items" ADD COLUMN "payment_method_custom" varchar(200);

-- 2. Backfill: copiar valor do cliente para todos os seus lineItems existentes
UPDATE "client_line_items" li
SET "payment_method" = c."payment_method"
FROM "clients" c
WHERE li."client_id" = c."id"
  AND c."payment_method" IS NOT NULL
  AND c."payment_method" != '';

-- Nota: A coluna clients.payment_method é mantida por compatibilidade temporária.
-- Pode ser removida em migração futura após confirmar que todos os clientes
-- já têm seus itens com forma de pagamento definida.

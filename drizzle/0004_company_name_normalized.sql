-- Deduplicação por nome da empresa: coluna company_name_normalized + índice parcial
-- Backfill: normalização simplificada (lower, trim, colapsar espaços, remover pontuação)
-- Nota: extensão unaccent é opcional; se não existir, acentos permanecem (script de dedupe pode refinar)

-- 1) Adicionar coluna (nullable inicialmente para backfill)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "company_name_normalized" varchar(255);
--> statement-breakpoint
-- 2) Backfill: normalização básica em SQL
-- lower, trim, colapsar múltiplos espaços, remover pontuação
UPDATE "clients"
SET "company_name_normalized" = lower(
  trim(
    regexp_replace(
      regexp_replace("company_name", '\s+', ' ', 'g'),
      '[.,\-/\(\)\''"\[\]]',
      '',
      'g'
    )
  )
)
WHERE "company_name_normalized" IS NULL;
--> statement-breakpoint
-- 3) Tornar NOT NULL
ALTER TABLE "clients" ALTER COLUMN "company_name_normalized" SET NOT NULL;
--> statement-breakpoint
-- 4) Índice parcial para busca por nome normalizado (apenas ativos)
CREATE INDEX IF NOT EXISTS "clients_company_name_normalized_idx"
ON "clients" ("company_name_normalized")
WHERE "deleted_at" IS NULL;

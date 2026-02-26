-- Índice UNIQUE em lower(email) para evitar duplicidade (case-insensitive).
-- A aplicação grava email já normalizado (trim + lower). Se existirem duplicados, a migração falha.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_lower_unique" ON "customers" (lower("email"));

-- Revisão de índices (base grande): removemos índices redundantes.
-- clients_not_deleted_idx: PK em clients(id) já cobre join por id; filtro deleted_at IS NULL não precisa de índice extra.
-- client_line_items_kind_sale_date_idx: redundante com (sale_date, kind); manter no máximo 2 índices em line_items (0032).
-- Se estes índices foram criados por versão anterior desta migration, removê-los:
DROP INDEX IF EXISTS "clients_not_deleted_idx";
DROP INDEX IF EXISTS "client_line_items_kind_sale_date_idx";
-- Em produção com tabela grande, para criar índices use CREATE INDEX CONCURRENTLY fora de transação (migration separada).

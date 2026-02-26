-- Backfill: garantir 1 processo LLC por cliente antes da constraint
-- Remove processos LLC duplicados (mantém o mais antigo por client_id)
DELETE FROM processes p1
USING processes p2
WHERE p1.kind = 'LLC_PROCESS'
  AND p2.kind = 'LLC_PROCESS'
  AND p1.client_id = p2.client_id
  AND p1.created_at > p2.created_at;

-- Opcional: desatrelar LLC do line_item; unicidade passa a ser por cliente
UPDATE processes SET line_item_id = NULL WHERE kind = 'LLC_PROCESS';

-- Constraint: 1 processo por (client_id, kind)
ALTER TABLE processes ADD CONSTRAINT processes_client_kind_unique UNIQUE (client_id, kind);

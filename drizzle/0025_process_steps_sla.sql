-- SLA por etapa: started_at (quando entrou em andamento) e expected_days (prazo em dias)
ALTER TABLE process_steps ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE process_steps ADD COLUMN IF NOT EXISTS expected_days integer NOT NULL DEFAULT 3;

-- Backfill: etapas já in_progress recebem started_at = updated_at
UPDATE process_steps SET started_at = updated_at WHERE status = 'in_progress' AND started_at IS NULL;

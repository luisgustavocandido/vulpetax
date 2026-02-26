-- Agrupamento leve por "pessoa": clientes da mesma pessoa compartilham person_group_id
ALTER TABLE clients ADD COLUMN IF NOT EXISTS person_group_id uuid;

-- Backfill: cada cliente existente recebe seu próprio grupo (1 cliente = 1 grupo)
UPDATE clients SET person_group_id = gen_random_uuid() WHERE person_group_id IS NULL;

CREATE INDEX IF NOT EXISTS clients_person_group_id_idx ON clients(person_group_id);

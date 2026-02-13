-- Adicionar colunas de endereço pessoal e e-mail ao cliente (nullable para compatibilidade)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS personal_address_line1 text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS personal_address_line2 text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS personal_city text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS personal_state text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS personal_postal_code text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS personal_country text;

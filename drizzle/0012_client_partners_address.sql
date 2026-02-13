-- Adicionar colunas de endereço pessoal e e-mail ao sócio (nullable para compatibilidade)
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS address_line2 text;
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS country text;

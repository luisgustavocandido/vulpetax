-- Adiciona campos LLC ao client_line_items
-- llc_category: categoria da LLC (Silver, Gold, Platinum, etc.)
-- llc_state: sigla do estado americano (2 caracteres, ex.: WY)
-- llc_custom_category: categoria personalizada (quando llc_category = 'Personalizado')

ALTER TABLE client_line_items
  ADD COLUMN IF NOT EXISTS llc_category TEXT NULL,
  ADD COLUMN IF NOT EXISTS llc_state VARCHAR(2) NULL,
  ADD COLUMN IF NOT EXISTS llc_custom_category TEXT NULL;

-- Comentários para documentação
COMMENT ON COLUMN client_line_items.llc_category IS 'Categoria da LLC (Silver, Gold, Platinum, Tradicional, Promo, Holding, Holding e Offshore, Personalizado)';
COMMENT ON COLUMN client_line_items.llc_state IS 'Sigla do estado americano da LLC (2 caracteres, ex.: WY para Wyoming)';
COMMENT ON COLUMN client_line_items.llc_custom_category IS 'Categoria personalizada da LLC (preenchido apenas quando llc_category = Personalizado)';

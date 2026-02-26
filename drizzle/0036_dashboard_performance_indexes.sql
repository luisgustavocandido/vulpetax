-- Índices para performance do dashboard (commercial performance + paid LLC)
-- clients: filtro por payment_date + group by commercial
CREATE INDEX IF NOT EXISTS "clients_payment_date_commercial_idx" ON "clients" ("payment_date", "commercial");

-- client_line_items: EXISTS por client_id + kind = 'LLC'
CREATE INDEX IF NOT EXISTS "client_line_items_client_id_kind_idx" ON "client_line_items" ("client_id", "kind");

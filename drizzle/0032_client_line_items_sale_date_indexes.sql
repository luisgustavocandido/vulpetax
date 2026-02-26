-- Índices para queries do dashboard executivo (KPIs por sale_date)

CREATE INDEX IF NOT EXISTS "client_line_items_sale_date_idx" ON "client_line_items" ("sale_date");
CREATE INDEX IF NOT EXISTS "client_line_items_sale_date_kind_idx" ON "client_line_items" ("sale_date", "kind");

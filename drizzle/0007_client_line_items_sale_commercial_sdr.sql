-- Adiciona colunas por item: data da venda, comercial e SDR (compatível com dados existentes)

ALTER TABLE "client_line_items" ADD COLUMN "sale_date" date;
--> statement-breakpoint
ALTER TABLE "client_line_items" ADD COLUMN "commercial" varchar(50);
--> statement-breakpoint
ALTER TABLE "client_line_items" ADD COLUMN "sdr" varchar(50);

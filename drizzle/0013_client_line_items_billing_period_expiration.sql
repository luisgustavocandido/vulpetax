-- Adiciona campos para cobrança de "Endereço": periodicidade e expiração

ALTER TABLE "client_line_items" ADD COLUMN "billing_period" varchar(10);
--> statement-breakpoint
ALTER TABLE "client_line_items" ADD COLUMN "expiration_date" date;


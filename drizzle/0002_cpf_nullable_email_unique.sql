ALTER TABLE "clients" ALTER COLUMN "cpf_cnpj" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_email_unique" UNIQUE("email");

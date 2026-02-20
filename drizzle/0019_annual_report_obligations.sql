-- Tabela para gestão de obrigações de Annual Report por estado
CREATE TABLE IF NOT EXISTS "annual_report_obligations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "llc_state" text NOT NULL,
  "frequency" varchar(10) NOT NULL,
  "period_year" integer NOT NULL,
  "due_date" date NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "done_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "annual_report_obligations_client_state_year_unique" UNIQUE("client_id", "llc_state", "period_year")
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS "annual_report_obligations_status_due_date_idx" ON "annual_report_obligations"("status", "due_date");
CREATE INDEX IF NOT EXISTS "annual_report_obligations_client_id_idx" ON "annual_report_obligations"("client_id");

-- Comentários para documentação
COMMENT ON TABLE "annual_report_obligations" IS 'Obrigações de Annual Report por estado (LLC)';
COMMENT ON COLUMN "annual_report_obligations"."llc_state" IS 'Sigla do estado americano (ex: WY, FL)';
COMMENT ON COLUMN "annual_report_obligations"."frequency" IS 'Frequência: Anual ou Bienal';
COMMENT ON COLUMN "annual_report_obligations"."period_year" IS 'Ano do período (ex: 2026)';
COMMENT ON COLUMN "annual_report_obligations"."status" IS 'Status: pending, overdue, done, canceled';

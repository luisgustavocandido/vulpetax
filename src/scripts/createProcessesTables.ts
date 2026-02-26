#!/usr/bin/env tsx
/**
 * Cria manualmente as tabelas processes e process_steps no banco apontado por DATABASE_URL.
 * Use isso quando a migração SQL ainda não foi aplicada nesse banco específico.
 *
 * Uso:
 *   npx tsx src/scripts/createProcessesTables.ts
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔧 Criando tabelas processes e process_steps (se ainda não existirem)...");

  const ddl = `
    -- Tabela principal de processos por cliente/serviço
    CREATE TABLE IF NOT EXISTS "processes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
      "line_item_id" uuid REFERENCES "client_line_items"("id") ON DELETE SET NULL,
      "kind" varchar(50) NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'open',
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "processes_client_id_idx" ON "processes"("client_id");
    CREATE INDEX IF NOT EXISTS "processes_line_item_id_idx" ON "processes"("line_item_id");
    CREATE INDEX IF NOT EXISTS "processes_status_idx" ON "processes"("status");

    -- Etapas (checklist) de cada processo
    CREATE TABLE IF NOT EXISTS "process_steps" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "process_id" uuid NOT NULL REFERENCES "processes"("id") ON DELETE CASCADE,
      "order" integer NOT NULL,
      "title" text NOT NULL,
      "assignee" varchar(100),
      "department" varchar(50),
      "status" varchar(20) NOT NULL DEFAULT 'pending',
      "done_at" timestamp with time zone,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT "process_steps_process_order_unique" UNIQUE("process_id", "order")
    );

    CREATE INDEX IF NOT EXISTS "process_steps_process_id_idx" ON "process_steps"("process_id");
  `;

  try {
    await db.execute(sql.raw(ddl));
    console.log("✅ Tabelas processes e process_steps criadas/verificadas com sucesso.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao criar tabelas processes/process_steps:");
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();


#!/usr/bin/env tsx
/**
 * Aplica a migração SLA em process_steps (started_at, expected_days + backfill).
 * Use se as colunas ainda não existirem.
 *
 * Uso:
 *   npx tsx src/scripts/applyProcessStepsSlaMigration.ts
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔧 Aplicando migração SLA em process_steps...");

  try {
    await db.execute(sql.raw(`ALTER TABLE process_steps ADD COLUMN IF NOT EXISTS started_at timestamp with time zone`));
    await db.execute(sql.raw(`ALTER TABLE process_steps ADD COLUMN IF NOT EXISTS expected_days integer NOT NULL DEFAULT 3`));
    await db.execute(
      sql.raw(`UPDATE process_steps SET started_at = updated_at WHERE status = 'in_progress' AND started_at IS NULL`)
    );
    console.log("✅ Colunas started_at e expected_days criadas; backfill aplicado.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao aplicar migração process_steps SLA:");
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();

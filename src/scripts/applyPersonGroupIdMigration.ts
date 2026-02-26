#!/usr/bin/env tsx
/**
 * Aplica a migração person_group_id na tabela clients.
 * Use se a coluna ainda não existir (ex.: drizzle-kit migrate não aplicou 0024).
 *
 * Uso:
 *   npx tsx src/scripts/applyPersonGroupIdMigration.ts
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔧 Aplicando migração person_group_id em clients...");

  try {
    await db.execute(sql.raw(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS person_group_id uuid`));
    await db.execute(
      sql.raw(`UPDATE clients SET person_group_id = gen_random_uuid() WHERE person_group_id IS NULL`)
    );
    await db.execute(
      sql.raw(`CREATE INDEX IF NOT EXISTS clients_person_group_id_idx ON clients(person_group_id)`)
    );
    console.log("✅ Coluna person_group_id e índice criados/backfill aplicado.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao aplicar migração person_group_id:");
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();

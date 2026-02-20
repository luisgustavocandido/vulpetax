/**
 * Aplica a migração 0014 (tabela billing_charges) no banco definido por DATABASE_URL.
 *
 * Uso: npx tsx scripts/apply-0014-billing-charges.ts
 */

import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não definida. Configure em .env ou .env.local");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
  });

  try {
    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'billing_charges'
      )
    `);
    if ((check.rows[0] as { exists: boolean }).exists) {
      console.log("✅ Tabela billing_charges já existe. Nada a fazer.");
      return;
    }

    console.log("📝 Criando tabela billing_charges...");
    await pool.query(`
      CREATE TABLE "billing_charges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "line_item_id" uuid NOT NULL REFERENCES "client_line_items"("id") ON DELETE CASCADE,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "amount_cents" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "due_date" date NOT NULL,
        "paid_at" timestamp with time zone,
        "provider" varchar(20),
        "provider_ref" varchar(255),
        "notes" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX "billing_charges_line_item_period_unique"
      ON "billing_charges" ("line_item_id", "period_start", "period_end")
    `);
    await pool.query(`
      CREATE INDEX "billing_charges_status_due_date_idx"
      ON "billing_charges" ("status", "due_date")
    `);
    await pool.query(`
      CREATE INDEX "billing_charges_client_id_idx"
      ON "billing_charges" ("client_id")
    `);
    console.log("✅ Migração 0014 aplicada.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

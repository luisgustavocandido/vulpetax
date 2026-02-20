/**
 * Aplica a migração 0013 (billing_period e expiration_date em client_line_items)
 * no banco definido por DATABASE_URL (.env / .env.local).
 *
 * Uso:
 *   npx tsx scripts/apply-0013-billing-expiration.ts
 *
 * Ou com URL explícita:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/apply-0013-billing-expiration.ts
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
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'client_line_items'
        AND column_name IN ('billing_period', 'expiration_date')
    `);
    const existing = (check.rows as { column_name: string }[]).map((r) => r.column_name);

    if (existing.includes("billing_period") && existing.includes("expiration_date")) {
      console.log("✅ Colunas billing_period e expiration_date já existem em client_line_items. Nada a fazer.");
      return;
    }

    if (!existing.includes("billing_period")) {
      console.log("📝 Adicionando coluna billing_period...");
      await pool.query(`ALTER TABLE "client_line_items" ADD COLUMN IF NOT EXISTS "billing_period" varchar(10)`);
      console.log("  ✓ billing_period");
    }
    if (!existing.includes("expiration_date")) {
      console.log("📝 Adicionando coluna expiration_date...");
      await pool.query(`ALTER TABLE "client_line_items" ADD COLUMN IF NOT EXISTS "expiration_date" date`);
      console.log("  ✓ expiration_date");
    }

    console.log("\n✅ Migração 0013 aplicada. Reinicie o servidor (npm run dev) se estiver rodando.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Aplica o SQL da migração 0030 (tabela customers + coluna client_partners.customer_id).
 * Use quando a tabela customers não existir e db:migrate não a criar (ex.: journal dessincronizado).
 *
 * Uso: npm run db:ensure-customers
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const migrationPath = join(process.cwd(), "drizzle", "0030_client_partners_customer_id_ensure.sql");

async function main() {
  const sqlContent = readFileSync(migrationPath, "utf-8");
  const pool = new Pool({ connectionString });
  try {
    await pool.query(sqlContent);
    console.log("Tabela customers e coluna customer_id garantidas.");
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

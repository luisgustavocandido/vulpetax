/**
 * Aplica o SQL da migração 0031 (tabela monthly_targets).
 * Use quando a tabela não existir e db:migrate não tiver sido executado.
 *
 * Uso: npm run db:ensure-monthly-targets
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

const migrationPath = join(process.cwd(), "drizzle", "0031_monthly_targets.sql");

async function main() {
  const sqlContent = readFileSync(migrationPath, "utf-8");
  const pool = new Pool({ connectionString });
  try {
    await pool.query(sqlContent);
    console.log("Tabela monthly_targets garantida.");
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

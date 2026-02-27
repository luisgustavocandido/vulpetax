/**
 * Aplica o SQL da migração 0026 (tabela person_groups).
 * Use quando a tabela não existir e db:migrate não tiver sido executado.
 *
 * Uso: npm run db:ensure-person-groups
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

const migrationPath = join(process.cwd(), "drizzle", "0026_person_groups.sql");

async function main() {
  const sqlContent = readFileSync(migrationPath, "utf-8");
  const pool = new Pool({ connectionString });
  try {
    await pool.query(sqlContent);
    console.log("Tabela person_groups garantida.");
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Aplica a migração 0016 (paid_method + índice line_item_id em billing_charges).
 * Execute: npx tsx scripts/run-0016-billing-paid-method.ts
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const sqlPath = join(process.cwd(), "drizzle", "0016_billing_charges_paid_method.sql");
const sql = readFileSync(sqlPath, "utf8");
const statements = sql
  .split("--> statement-breakpoint")
  .map((segment) =>
    segment
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim()
  )
  .filter((s) => s.length > 0);

async function main() {
  const pool = new Pool({ connectionString: url });
  try {
    for (const statement of statements) {
      await pool.query(statement);
      console.log("OK:", statement.slice(0, 60) + "...");
    }
    console.log("Migração 0016 aplicada com sucesso.");
  } catch (e) {
    console.error("Erro:", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

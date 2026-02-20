/**
 * Backfill due_date = period_end para cobranças pending/overdue.
 * Execute: npx tsx scripts/run-0017-billing-due-date-backfill.ts
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

const sqlPath = join(process.cwd(), "drizzle", "0017_billing_charges_due_date_backfill.sql");
const sql = readFileSync(sqlPath, "utf8").trim();

async function main() {
  const pool = new Pool({ connectionString: url });
  try {
    const r = await pool.query(sql);
    console.log("Backfill 0017 aplicado. Linhas afetadas:", r.rowCount ?? 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

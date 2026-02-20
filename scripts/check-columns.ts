/**
 * Verifica se as colunas de endereço existem em client_line_items no banco
 * usado por process.env.DATABASE_URL (mesma fonte que o Next em dev).
 * Uso: npx tsx scripts/check-columns.ts
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'client_line_items'
         AND column_name IN ('address_provider', 'address_line1', 'address_line2', 'ste_number')
       ORDER BY column_name`
    );
    const found = rows.map((r: { column_name: string }) => r.column_name);
    const expected = ["address_line1", "address_line2", "address_provider", "ste_number"];
    const missing = expected.filter((c) => !found.includes(c));
    if (missing.length === 0) {
      console.log("OK: colunas de endereço presentes:", found.join(", "));
    } else {
      console.log("FALTANDO colunas:", missing.join(", "));
      console.log("Presentes:", found.length ? found.join(", ") : "(nenhuma)");
      process.exit(1);
    }
  } catch (e) {
    console.error("Erro ao verificar colunas:", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

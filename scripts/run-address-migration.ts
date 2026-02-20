/**
 * Aplica a migração 0015 (colunas de endereço em client_line_items).
 * Ordem de .env: .env.local primeiro, depois .env (igual ao carregamento do Next).
 * Execute no mesmo diretório do projeto: npx tsx scripts/run-address-migration.ts
 * Compare [DB] host/port/db com o log do Next (npm run dev) para garantir mesmo banco.
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

// Mesma ordem do Next.js: .env primeiro, depois .env.local ( .env.local sobrepõe = mesmo DB que o app)
config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida. Coloque em .env ou .env.local.");
  process.exit(1);
}

const safe = url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
console.log("[DB] (script) DATABASE_URL =", safe);
try {
  const u = new URL(url);
  const dbName = u.pathname?.replace(/^\//, "") || "(default)";
  console.log("[DB] (script) host =", u.hostname, "| port =", u.port || "(default)", "| db =", dbName);
} catch {
  console.log("[DB] (script) URL inválida, host/port/db não parseados");
}

const sqlPath = join(process.cwd(), "drizzle", "0015_client_line_items_address.sql");
const sql = readFileSync(sqlPath, "utf8");
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

async function main() {
  const pool = new Pool({ connectionString: url });
  try {
    for (const statement of statements) {
      await pool.query(statement);
      console.log("OK:", statement.slice(0, 60) + "...");
    }
    console.log("Migração 0015 aplicada com sucesso.");
  } catch (e) {
    console.error("Erro ao aplicar migração:", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

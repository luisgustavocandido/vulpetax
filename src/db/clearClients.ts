/**
 * Remove todos os clientes (e itens/sócios em cascata).
 * Uso: npx tsx src/db/clearClients.ts
 */
import "dotenv/config";
import { db } from "./index";
import { clients } from "./schema";

async function main() {
  await db.delete(clients);
  console.log("Clientes removidos.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

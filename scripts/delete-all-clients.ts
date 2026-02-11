/**
 * Script para apagar todos os clientes da base de dados.
 * Uso: npx tsx scripts/delete-all-clients.ts
 */

import { db } from "../src/db";
import { clients } from "../src/db/schema";

async function main() {
  const result = await db.delete(clients);
  console.log(`Clientes apagados com sucesso.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

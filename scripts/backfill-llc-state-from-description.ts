/**
 * Backfill: infere llcState de description para itens LLC antigos.
 * Execute: npx tsx scripts/backfill-llc-state-from-description.ts
 */
import { config } from "dotenv";
import { db } from "@/db";
import { clientLineItems } from "@/db/schema";
import { eq, sql, isNull, and } from "drizzle-orm";
import { US_STATES, findStateByName } from "@/constants/usStates";

config({ path: ".env" });
config({ path: ".env.local" });

async function inferStateFromDescription(description: string | null): Promise<string | null> {
  if (!description) return null;
  const desc = String(description).trim();
  
  // Tentar encontrar estado por nome completo ou parcial
  for (const state of US_STATES) {
    // Buscar por nome completo (case-insensitive)
    if (desc.toLowerCase().includes(state.name.toLowerCase())) {
      return state.code;
    }
    // Buscar por código entre parênteses: "(WY)" ou "WY"
    if (desc.includes(`(${state.code})`) || desc.includes(` ${state.code} `) || desc.endsWith(` ${state.code}`)) {
      return state.code;
    }
  }
  
  // Tentar usar findStateByName para nomes parciais
  const parts = desc.split(/[·\-,]/).map((p) => p.trim());
  for (const part of parts) {
    const found = findStateByName(part);
    if (found) return found.code;
  }
  
  return null;
}

async function main() {
  console.log("Iniciando backfill de llcState a partir de description...\n");

  // Buscar itens LLC sem llcState
  const itemsWithoutState = await db
    .select({
      id: clientLineItems.id,
      clientId: clientLineItems.clientId,
      description: clientLineItems.description,
      llcState: clientLineItems.llcState,
    })
    .from(clientLineItems)
    .where(
      and(
        sql`${clientLineItems.kind} IN ('LLC', 'Llc', 'LLc', 'llc')`,
        isNull(clientLineItems.llcState)
      )
    );

  console.log(`Encontrados ${itemsWithoutState.length} itens LLC sem llcState.\n`);

  let updated = 0;
  let skipped = 0;
  const updates: Array<{ id: string; description: string; inferred: string }> = [];

  for (const item of itemsWithoutState) {
    const inferred = await inferStateFromDescription(item.description);
    if (!inferred) {
      skipped++;
      continue;
    }

    try {
      await db
        .update(clientLineItems)
        .set({ llcState: inferred })
        .where(eq(clientLineItems.id, item.id));
      
      updated++;
      updates.push({
        id: item.id,
        description: item.description || "",
        inferred,
      });
    } catch (err) {
      console.error(`Erro ao atualizar item ${item.id}:`, err);
    }
  }

  console.log(`\nResultado:`);
  console.log(`- Atualizados: ${updated}`);
  console.log(`- Ignorados (não foi possível inferir): ${skipped}`);
  
  if (updates.length > 0) {
    console.log(`\nExemplos de atualizações:`);
    updates.slice(0, 10).forEach((u) => {
      console.log(`  - "${u.description}" → ${u.inferred}`);
    });
  }

  console.log("\nBackfill concluído.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro:", err);
    process.exit(1);
  });

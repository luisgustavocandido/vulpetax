/**
 * Script de deduplicação manual: encontra grupos de clientes com mesmo
 * companyNameNormalized e mantém apenas 1 vencedor por grupo, soft-deletando os demais.
 *
 * Regras do vencedor: mais itens > mais sócios > updatedAt mais recente > createdAt mais antigo.
 *
 * Uso: npx tsx src/scripts/dedupeClientsByName.ts
 * Não roda automaticamente em produção.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { sql, eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, clientLineItems, clientPartners } from "@/db/schema";
import { logAudit, diffChangedFields } from "@/lib/audit";
import type { RequestMeta } from "@/lib/requestMeta";

const SCRIPT_META: RequestMeta = {
  actor: "dedupe-script",
  ip: null,
  userAgent: null,
};

async function main() {
  const groups = await db
    .select({
      companyNameNormalized: clients.companyNameNormalized,
      count: sql<number>`count(*)::int`,
    })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .groupBy(clients.companyNameNormalized)
    .having(sql`count(*) > 1`);

  console.log(`Grupos com duplicados: ${groups.length}`);

  let totalRemoved = 0;

  for (const g of groups) {
    const rows = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.companyNameNormalized, g.companyNameNormalized),
          isNull(clients.deletedAt)
        )
      );

    const withCounts = await Promise.all(
      rows.map(async (r) => {
        const [itemsRes] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(clientLineItems)
          .where(eq(clientLineItems.clientId, r.id));
        const [partnersRes] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(clientPartners)
          .where(eq(clientPartners.clientId, r.id));
        return {
          ...r,
          itemsCount: itemsRes?.count ?? 0,
          partnersCount: partnersRes?.count ?? 0,
        };
      })
    );

    const sorted = [...withCounts].sort((a, b) => {
      if (b.itemsCount !== a.itemsCount) return b.itemsCount - a.itemsCount;
      if (b.partnersCount !== a.partnersCount) return b.partnersCount - a.partnersCount;
      const au = a.updatedAt?.getTime() ?? 0;
      const bu = b.updatedAt?.getTime() ?? 0;
      if (bu !== au) return bu - au;
      const ac = a.createdAt?.getTime() ?? 0;
      const bc = b.createdAt?.getTime() ?? 0;
      return ac - bc;
    });

    const [winner, ...losers] = sorted;
    if (!winner || losers.length === 0) continue;

    await db.transaction(async (tx) => {
      const now = new Date();
      for (const loser of losers) {
        const loserRecord = loser as Record<string, unknown>;
        const { oldValues, newValues } = diffChangedFields(loserRecord, null);

        await tx
          .update(clients)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(clients.id, loser.id));

        await logAudit(tx, {
          action: "delete",
          entity: "clients",
          entityId: loser.id,
          oldValues,
          newValues,
          meta: SCRIPT_META,
        });
        totalRemoved++;
      }
    });

    console.log(
      `  [${g.companyNameNormalized}] vencedor=${winner.id} (${winner.itemsCount} itens, ${winner.partnersCount} sócios), removidos=${losers.length}`
    );
  }

  console.log(`Total de duplicados removidos: ${totalRemoved}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

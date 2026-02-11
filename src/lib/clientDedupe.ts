/**
 * Deduplicação de clientes por nome da empresa (companyName normalizado).
 */

import { sql, eq, and, isNull } from "drizzle-orm";
import { clients, clientLineItems, clientPartners } from "@/db/schema";
import { logAudit, diffChangedFields } from "@/lib/audit";
import type { RequestMeta } from "./requestMeta";

/** Remove acentos de uma string (NFD + remove combining marks) */
function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normaliza o nome da empresa para comparação:
 * - trim
 * - lower
 * - remover acentos
 * - colapsar múltiplos espaços
 * - remover pontuação básica
 */
export function normalizeCompanyName(name: string): string {
  let s = name.trim().toLowerCase();
  s = removeAccents(s);
  s = s.replace(/[.,\-/()\[\]'"]/g, "");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

export type ClientWithCounts = {
  id: string;
  companyName: string;
  companyNameNormalized: string;
  customerCode: string;
  itemsCount: number;
  partnersCount: number;
  updatedAt: Date | null;
  createdAt: Date | null;
  [key: string]: unknown;
};

/**
 * Retorna o cliente "vencedor" por nome normalizado, com contagens.
 * Critério de vencedor: mais itens > mais sócios > updatedAt mais recente > createdAt mais antigo.
 */
/** db ou tx do Drizzle (transaction) */
export async function findBestClientByName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  companyNameNormalized: string
): Promise<ClientWithCounts | null> {
  const rows = await db
    .select({
      id: clients.id,
      companyName: clients.companyName,
      companyNameNormalized: clients.companyNameNormalized,
      customerCode: clients.customerCode,
      updatedAt: clients.updatedAt,
      createdAt: clients.createdAt,
      itemsCount: sql<number>`(SELECT count(*)::int FROM client_line_items WHERE client_id = ${clients.id})`,
      partnersCount: sql<number>`(SELECT count(*)::int FROM client_partners WHERE client_id = ${clients.id})`,
    })
    .from(clients)
    .where(
      and(eq(clients.companyNameNormalized, companyNameNormalized), isNull(clients.deletedAt))
    );

  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0] as ClientWithCounts;

  // Ordenar: mais itens > mais sócios > updatedAt desc > createdAt asc
  const sorted = [...rows].sort((a, b) => {
    const ai = (a as { itemsCount: number }).itemsCount ?? 0;
    const bi = (b as { itemsCount: number }).itemsCount ?? 0;
    if (bi !== ai) return bi - ai; // mais itens vence
    const ap = (a as { partnersCount: number }).partnersCount ?? 0;
    const bp = (b as { partnersCount: number }).partnersCount ?? 0;
    if (bp !== ap) return bp - ap; // mais sócios vence
    const au = (a as { updatedAt: Date | null }).updatedAt?.getTime() ?? 0;
    const bu = (b as { updatedAt: Date | null }).updatedAt?.getTime() ?? 0;
    if (bu !== au) return bu - au; // updatedAt mais recente vence
    const ac = (a as { createdAt: Date | null }).createdAt?.getTime() ?? 0;
    const bc = (b as { createdAt: Date | null }).createdAt?.getTime() ?? 0;
    return ac - bc; // createdAt mais antigo vence
  });

  return sorted[0] as ClientWithCounts;
}

/**
 * Garante que existe apenas 1 vencedor por nome normalizado.
 * Soft-delete os demais e registra auditoria.
 * Retorna o ID do vencedor.
 */
/** db ou tx do Drizzle (transaction) */
export async function resolveNameDuplicates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  companyNameNormalized: string,
  meta: RequestMeta
): Promise<string | null> {
  const rows = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.companyNameNormalized, companyNameNormalized), isNull(clients.deletedAt))
    );

  if (rows.length <= 1) return rows[0]?.id ?? null;

  // Buscar contagens para ordenar
  const withCounts = await Promise.all(
    rows.map(async (r: (typeof rows)[number]) => {
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
  if (!winner) return null;

  const now = new Date();
  for (const loser of losers) {
    const loserRecord = loser as Record<string, unknown>;
    const { oldValues, newValues } = diffChangedFields(loserRecord, null);

    await db
      .update(clients)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(clients.id, loser.id));
    await logAudit(db, {
      action: "delete",
      entity: "clients",
      entityId: loser.id,
      oldValues,
      newValues,
      meta,
    });
  }

  return winner.id;
}

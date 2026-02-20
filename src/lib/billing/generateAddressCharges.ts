import { db } from "@/db";
import { clientLineItems, clients } from "@/db/schema";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { addOneMonth } from "@/lib/dates/addOneMonth";
import { addOneYear } from "@/lib/dates/addOneYear";
import { createChargeIfNotExists } from "./chargesRepo";

function dateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export type PeriodInfo = {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
};

/**
 * Calcula o período atual (e opcionalmente o próximo) para um item Endereço.
 * Mensal: períodos mensais a partir de saleDate; Anual: período de 1 ano a partir de saleDate.
 * Respeita expirationDate para Anual (não gera após expiração).
 */
export function computeCurrentPeriod(
  lineItem: {
    saleDate: string | null;
    billingPeriod: string | null;
    expirationDate: string | null;
  },
  today: Date
): PeriodInfo | null {
  const saleDate = lineItem.saleDate;
  if (!saleDate || !lineItem.billingPeriod) return null;
  const sale = parseIso(saleDate);
  if (Number.isNaN(sale.getTime())) return null;

  const todayStr = dateToIso(today);

  if (lineItem.billingPeriod === "Mensal") {
    let periodStart = new Date(Date.UTC(sale.getUTCFullYear(), sale.getUTCMonth(), sale.getUTCDate()));
    while (dateToIso(periodStart) <= todayStr) {
      const periodEnd = addOneMonth(periodStart);
      const periodEndStr = dateToIso(periodEnd);
      if (todayStr < periodEndStr) {
        return {
          periodStart: dateToIso(periodStart),
          periodEnd: periodEndStr,
          dueDate: periodEndStr,
        };
      }
      periodStart = periodEnd;
    }
    return {
      periodStart: dateToIso(periodStart),
      periodEnd: dateToIso(addOneMonth(periodStart)),
      dueDate: dateToIso(addOneMonth(periodStart)),
    };
  }

  if (lineItem.billingPeriod === "Anual") {
    let periodStart = new Date(Date.UTC(sale.getUTCFullYear(), sale.getUTCMonth(), sale.getUTCDate()));
    if (lineItem.expirationDate && todayStr >= lineItem.expirationDate) return null;
    while (true) {
      const periodEnd = addOneYear(periodStart);
      const periodEndStr = dateToIso(periodEnd);
      if (lineItem.expirationDate && periodEndStr > lineItem.expirationDate) return null;
      if (todayStr < periodEndStr) {
        const dueDate = lineItem.expirationDate ?? periodEndStr;
        return {
          periodStart: dateToIso(periodStart),
          periodEnd: periodEndStr,
          dueDate,
        };
      }
      periodStart = periodEnd;
    }
  }

  return null;
}

/**
 * Calcula o próximo período após o dado (para seed opcional).
 */
export function computeNextPeriod(
  lineItem: {
    saleDate: string | null;
    billingPeriod: string | null;
    expirationDate: string | null;
  },
  afterPeriodEnd: string
): PeriodInfo | null {
  const saleDate = lineItem.saleDate;
  if (!saleDate || !lineItem.billingPeriod) return null;
  const after = parseIso(afterPeriodEnd);
  if (Number.isNaN(after.getTime())) return null;
  if (lineItem.expirationDate && afterPeriodEnd >= lineItem.expirationDate) return null;

  if (lineItem.billingPeriod === "Mensal") {
    const periodEnd = addOneMonth(after);
    const periodEndStr = dateToIso(periodEnd);
    if (lineItem.expirationDate && periodEndStr > lineItem.expirationDate) return null;
    return {
      periodStart: afterPeriodEnd,
      periodEnd: periodEndStr,
      dueDate: periodEndStr,
    };
  }
  if (lineItem.billingPeriod === "Anual") {
    const periodEnd = addOneYear(after);
    const periodEndStr = dateToIso(periodEnd);
    if (lineItem.expirationDate && periodEndStr > lineItem.expirationDate) return null;
    const dueDate = lineItem.expirationDate ?? periodEndStr;
    return {
      periodStart: afterPeriodEnd,
      periodEnd: periodEndStr,
      dueDate,
    };
  }
  return null;
}

export type EnsureChargesOptions = {
  windowDays?: number;
};

/**
 * Garante que existem cobranças para os itens Endereço (Mensal/Anual).
 * Cria sob demanda para o período atual e, se windowDays > 0, para o próximo período
 * quando o vencimento estiver dentro da janela.
 */
export async function ensureChargesForAddressLineItems(
  options: EnsureChargesOptions = {}
): Promise<{ created: number }> {
  const { windowDays = 0 } = options;
  const today = new Date();
  const windowEnd = new Date(today);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + (windowDays ?? 0));
  const windowEndStr = dateToIso(windowEnd);

  const items = await db
    .select()
    .from(clientLineItems)
    .innerJoin(clients, eq(clientLineItems.clientId, clients.id))
    .where(
      and(
        eq(clientLineItems.kind, "Endereco"),
        isNotNull(clientLineItems.billingPeriod),
        isNull(clients.deletedAt),
        sql`${clientLineItems.valueCents} > 0`,
        sql`${clientLineItems.saleDate} is not null`
      )
    );

  let created = 0;
  for (const row of items) {
    const item =
      (row as Record<string, unknown>).clientLineItems ??
      (row as Record<string, unknown>).client_line_items;
    if (!item || typeof item !== "object" || !("billingPeriod" in item)) continue;
    const lineItem = item as typeof clientLineItems.$inferSelect;
    if (!lineItem.billingPeriod) continue;
    const current = computeCurrentPeriod(
      {
        saleDate: lineItem.saleDate,
        billingPeriod: lineItem.billingPeriod,
        expirationDate: lineItem.expirationDate,
      },
      today
    );
    if (current) {
      const r = await createChargeIfNotExists({
        clientId: lineItem.clientId,
        lineItemId: lineItem.id,
        periodStart: current.periodStart,
        periodEnd: current.periodEnd,
        amountCents: lineItem.valueCents,
        dueDate: current.dueDate,
      });
      if (r.created) created++;
    }

    if (windowDays > 0 && current) {
      const next = computeNextPeriod(
        {
          saleDate: lineItem.saleDate,
          billingPeriod: lineItem.billingPeriod,
          expirationDate: lineItem.expirationDate,
        },
        current.periodEnd
      );
      if (next && next.dueDate <= windowEndStr) {
        const r = await createChargeIfNotExists({
          clientId: lineItem.clientId,
          lineItemId: lineItem.id,
          periodStart: next.periodStart,
          periodEnd: next.periodEnd,
          amountCents: lineItem.valueCents,
          dueDate: next.dueDate,
        });
        if (r.created) created++;
      }
    }
  }
  return { created };
}

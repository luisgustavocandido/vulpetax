/**
 * Queries para a Dashboard Financeira (CEO). Dados globais (todas as cobranças/clientes).
 * Receita = cobranças pagas (status='paid'). AR = pending + overdue. MRR = estimativa (ver comentários).
 */

import { sql, eq, and, isNull, gte, lte, desc } from "drizzle-orm";
import { db } from "@/db";
import { clients, billingCharges, clientLineItems } from "@/db/schema";

// --- Helpers de período (exportados para testes) --------------------------------------------

/** Retorna { from, to } para MTD do mês indicado (YYYY-MM). to = último dia do mês ou hoje se mês atual. */
export function getMTDRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y!, m! - 1, 1));
  const now = new Date();
  const isCurrentMonth =
    now.getUTCFullYear() === y && now.getUTCMonth() === m! - 1;
  const to = isCurrentMonth
    ? new Date(now)
    : new Date(Date.UTC(y!, m!, 0)); // último dia do mês
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  return { from: fromStr, to: toStr };
}

/**
 * Retorna { from, to } para o mês anterior, alinhado ao "dia do mês" do MTD atual.
 * Ex.: se month é 2025-03 e hoje é dia 15, prevTo = dia 15 de fev (ou último dia de fev se fev tem menos dias).
 */
export function getPrevMonthMTDRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const prev = new Date(Date.UTC(y!, m! - 2, 1)); // primeiro dia do mês anterior
  const prevY = prev.getUTCFullYear();
  const prevM = prev.getUTCMonth() + 1;
  const from = new Date(Date.UTC(prevY, prev.getUTCMonth(), 1));
  const now = new Date();
  const isCurrentMonth =
    now.getUTCFullYear() === y && now.getUTCMonth() === m! - 1;
  const dayOfMonth = isCurrentMonth ? now.getUTCDate() : new Date(y!, m!, 0).getUTCDate();
  const lastDayPrev = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  const toDay = Math.min(dayOfMonth, lastDayPrev);
  const to = new Date(Date.UTC(prevY, prev.getUTCMonth(), toDay));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** (MTD - PrevMTD) / PrevMTD * 100. Se PrevMTD = 0, retorna null (evita divisão por zero). */
export function computeMoMPercent(
  revenueMTDCents: number,
  revenuePrevMonthCents: number
): number | null {
  if (revenuePrevMonthCents === 0) return null;
  return ((revenueMTDCents - revenuePrevMonthCents) / revenuePrevMonthCents) * 100;
}

// --- Summary ---------------------------------------------------------------------------------

export type FinanceSummaryResult = {
  revenueMTDCents: number;
  revenuePrevMonthCents: number;
  revenueMoMPercent: number | null;
  mrrCents: number;
  arPendingCents: number;
  arOverdueCents: number;
  delinquencyPercent: number;
};

/**
 * MRR é estimativa: soma das cobranças pagas nos últimos 30 dias cujo item tem billing_period = 'Mensal'.
 * Não considera cancelamentos nem contratos futuros; uso como proxy de receita recorrente mensal.
 */
export async function getFinanceSummary(month: string): Promise<FinanceSummaryResult> {
  const { from, to } = getMTDRange(month);
  const { from: prevFrom, to: prevTo } = getPrevMonthMTDRange(month);

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toEnd = new Date(`${to}T23:59:59.999Z`);
  const prevFromDate = new Date(`${prevFrom}T00:00:00.000Z`);
  const prevToEnd = new Date(`${prevTo}T23:59:59.999Z`);

  const todayStr = new Date().toISOString().slice(0, 10);

  const [
    mtdRow,
    prevRow,
    mrrRow,
    arPendingRow,
    arOverdueRow,
  ] = await Promise.all([
    db
      .select({
        revenueCents: sql<number>`COALESCE(SUM(${billingCharges.amountCents}), 0)::bigint`,
      })
      .from(billingCharges)
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .where(
        and(
          isNull(clients.deletedAt),
          eq(billingCharges.status, "paid"),
          gte(billingCharges.paidAt, fromDate),
          lte(billingCharges.paidAt, toEnd)
        )
      ),
    db
      .select({
        revenueCents: sql<number>`COALESCE(SUM(${billingCharges.amountCents}), 0)::bigint`,
      })
      .from(billingCharges)
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .where(
        and(
          isNull(clients.deletedAt),
          eq(billingCharges.status, "paid"),
          gte(billingCharges.paidAt, prevFromDate),
          lte(billingCharges.paidAt, prevToEnd)
        )
      ),
    // MRR: cobranças pagas nos últimos 30 dias com line_item.billing_period = 'Mensal'
    db
      .select({
        mrrCents: sql<number>`COALESCE(SUM(${billingCharges.amountCents}), 0)::bigint`,
      })
      .from(billingCharges)
      .innerJoin(clientLineItems, eq(billingCharges.lineItemId, clientLineItems.id))
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .where(
        and(
          isNull(clients.deletedAt),
          eq(billingCharges.status, "paid"),
          eq(clientLineItems.billingPeriod, "Mensal"),
          gte(billingCharges.paidAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
          lte(billingCharges.paidAt, new Date())
        )
      ),
    db
      .select({
        totalCents: sql<number>`COALESCE(SUM(${billingCharges.amountCents}), 0)::bigint`,
      })
      .from(billingCharges)
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .where(
        and(
          isNull(clients.deletedAt),
          eq(billingCharges.status, "pending"),
          gte(billingCharges.dueDate, todayStr)
        )
      ),
    db
      .select({
        totalCents: sql<number>`COALESCE(SUM(${billingCharges.amountCents}), 0)::bigint`,
      })
      .from(billingCharges)
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .where(
        and(
          isNull(clients.deletedAt),
          eq(billingCharges.status, "overdue")
        )
      ),
  ]);

  const revenueMTDCents = Number(mtdRow[0]?.revenueCents ?? 0);
  const revenuePrevMonthCents = Number(prevRow[0]?.revenueCents ?? 0);
  const revenueMoMPercent = computeMoMPercent(revenueMTDCents, revenuePrevMonthCents);
  const mrrCents = Number(mrrRow[0]?.mrrCents ?? 0);
  const arPendingCents = Number(arPendingRow[0]?.totalCents ?? 0);
  const arOverdueCents = Number(arOverdueRow[0]?.totalCents ?? 0);

  const arTotal = arPendingCents + arOverdueCents;
  const delinquencyPercent = arTotal === 0 ? 0 : (arOverdueCents / arTotal) * 100;

  return {
    revenueMTDCents,
    revenuePrevMonthCents,
    revenueMoMPercent,
    mrrCents,
    arPendingCents,
    arOverdueCents,
    delinquencyPercent,
  };
}

// --- Série de receita (últimos N meses) ------------------------------------------------------

export type FinanceRevenueSeriesPoint = {
  month: string;
  revenueCents: number;
  paidCount: number;
};

export async function getFinanceRevenueSeries(
  months: number = 12
): Promise<FinanceRevenueSeriesPoint[]> {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months + 1, 1));
  const keys: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    keys.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }

  const trunc = sql`date_trunc('month', ${billingCharges.paidAt}::timestamptz)::date`;
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const startDate = new Date(`${startStr}T00:00:00.000Z`);
  const endDate = new Date(`${endStr}T23:59:59.999Z`);

  const rows = await db
    .select({
      bucket: trunc,
      revenueCents: sql<number>`COALESCE(SUM(${billingCharges.amountCents}), 0)::bigint`,
      paidCount: sql<number>`COUNT(*)::int`,
    })
    .from(billingCharges)
    .innerJoin(clients, eq(billingCharges.clientId, clients.id))
    .where(
      and(
        isNull(clients.deletedAt),
        eq(billingCharges.status, "paid"),
        gte(billingCharges.paidAt, startDate),
        lte(billingCharges.paidAt, endDate)
      )
    )
    .groupBy(trunc)
    .orderBy(sql`1`);

  const dataMap = new Map<string, { revenueCents: number; paidCount: number }>();
  for (const r of rows) {
    const b = r.bucket instanceof Date ? r.bucket : new Date(r.bucket as string);
    const key = `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, "0")}`;
    dataMap.set(key, {
      revenueCents: Number(r.revenueCents),
      paidCount: r.paidCount ?? 0,
    });
  }

  return keys.map((month) => {
    const v = dataMap.get(month) ?? { revenueCents: 0, paidCount: 0 };
    return { month, revenueCents: v.revenueCents, paidCount: v.paidCount };
  });
}

// --- Top cobranças em atraso ------------------------------------------------------------------

export type FinanceTopOverdueItem = {
  clientId: string;
  clientName: string;
  chargeId: string;
  amountCents: number;
  dueDate: string;
  daysOverdue: number;
};

export async function getTopOverdueCharges(
  limit: number = 10
): Promise<FinanceTopOverdueItem[]> {
  const todayStr = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      chargeId: billingCharges.id,
      clientId: clients.id,
      companyName: clients.companyName,
      amountCents: billingCharges.amountCents,
      dueDate: billingCharges.dueDate,
    })
    .from(billingCharges)
    .innerJoin(clients, eq(billingCharges.clientId, clients.id))
    .where(
      and(
        isNull(clients.deletedAt),
        eq(billingCharges.status, "overdue")
      )
    )
    .orderBy(desc(billingCharges.amountCents))
    .limit(limit);

  const today = new Date(todayStr);

  return rows.map((r) => {
    const due = typeof r.dueDate === "string" ? r.dueDate : (r.dueDate as Date).toISOString().slice(0, 10);
    const dueDate = new Date(due + "T00:00:00.000Z");
    const daysOverdue = Math.max(
      0,
      Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))
    );
    return {
      clientId: r.clientId,
      clientName: r.companyName ?? "",
      chargeId: r.chargeId,
      amountCents: r.amountCents,
      dueDate: due,
      daysOverdue,
    };
  });
}

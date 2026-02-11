/**
 * Queries e helpers para o Dashboard Pós-Venda LLC.
 */

import { sql, and, eq, desc, isNull, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { clients, clientLineItems, importHistory } from "@/db/schema";
import {
  parseDashboardFilters,
  type DashboardFilters,
  COMMERCIAL_OPTIONS,
} from "@/lib/dashboardFilters";
import type { CommercialSdr } from "@/db/schema";

export { COMMERCIAL_OPTIONS, parseDashboardFilters, type DashboardFilters };
export const PAYMENT_METHOD_OPTIONS = ["Stripe", "PIX", "Outro"] as const;

function buildWhereConditions(filters: DashboardFilters) {
  const conditions = [isNull(clients.deletedAt)];

  if (filters.dateFrom) {
    conditions.push(gte(clients.paymentDate, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(clients.paymentDate, filters.dateTo));
  }
  if (filters.commercial) {
    conditions.push(eq(clients.commercial, filters.commercial as CommercialSdr));
  }
  if (filters.sdr) {
    conditions.push(eq(clients.sdr, filters.sdr as CommercialSdr));
  }
  if (filters.paymentMethod) {
    conditions.push(eq(clients.paymentMethod, filters.paymentMethod));
  }

  return and(...conditions);
}

export type DashboardKPIs = {
  totalClients: number;
  totalValueCents: number;
  averageTicketCents: number;
  expressCount: number;
  holdingCount: number;
  anonymousCount: number;
  expressPct: number;
  holdingPct: number;
  anonymousPct: number;
};

export async function fetchDashboardKPIs(
  filters: DashboardFilters
): Promise<DashboardKPIs> {
  const where = buildWhereConditions(filters);

  const [row] = await db
    .select({
      totalClients: sql<number>`count(distinct ${clients.id})::int`,
      totalValueCents: sql<number>`COALESCE(sum(${clientLineItems.valueCents}), 0)::bigint`,
      expressCount: sql<number>`count(distinct case when ${clients.express} = true then ${clients.id} end)::int`,
      holdingCount: sql<number>`count(distinct case when ${clients.holding} = true then ${clients.id} end)::int`,
      anonymousCount: sql<number>`count(distinct case when ${clients.anonymous} = true then ${clients.id} end)::int`,
    })
    .from(clients)
    .leftJoin(clientLineItems, eq(clientLineItems.clientId, clients.id))
    .where(where);

  const totalClients = row?.totalClients ?? 0;
  const totalValueCents = Number(row?.totalValueCents ?? 0);
  const expressCount = row?.expressCount ?? 0;
  const holdingCount = row?.holdingCount ?? 0;
  const anonymousCount = row?.anonymousCount ?? 0;

  const averageTicketCents = totalClients > 0 ? Math.round(totalValueCents / totalClients) : 0;
  const expressPct = totalClients > 0 ? (expressCount / totalClients) * 100 : 0;
  const holdingPct = totalClients > 0 ? (holdingCount / totalClients) * 100 : 0;
  const anonymousPct = totalClients > 0 ? (anonymousCount / totalClients) * 100 : 0;

  return {
    totalClients,
    totalValueCents,
    averageTicketCents,
    expressCount,
    holdingCount,
    anonymousCount,
    expressPct,
    holdingPct,
    anonymousPct,
  };
}

export type VolumeByCommercial = {
  commercial: string | null;
  count: number;
  totalCents: number;
};

export async function fetchVolumeByCommercial(
  filters: DashboardFilters
): Promise<VolumeByCommercial[]> {
  const where = buildWhereConditions(filters);

  const rows = await db
    .select({
      commercial: clients.commercial,
      count: sql<number>`count(distinct ${clients.id})::int`,
      totalCents: sql<number>`COALESCE(sum(${clientLineItems.valueCents}), 0)::bigint`,
    })
    .from(clients)
    .leftJoin(clientLineItems, eq(clientLineItems.clientId, clients.id))
    .where(where)
    .groupBy(clients.commercial)
    .orderBy(desc(sql`count(distinct ${clients.id})`));

  return rows.map((r) => ({
    commercial: r.commercial ?? "(sem comercial)",
    count: r.count,
    totalCents: Number(r.totalCents),
  }));
}

export type VolumeByPaymentMethod = {
  paymentMethod: string | null;
  count: number;
  totalCents: number;
};

export async function fetchVolumeByPaymentMethod(
  filters: DashboardFilters
): Promise<VolumeByPaymentMethod[]> {
  const where = buildWhereConditions(filters);

  const rows = await db
    .select({
      paymentMethod: clients.paymentMethod,
      count: sql<number>`count(distinct ${clients.id})::int`,
      totalCents: sql<number>`COALESCE(sum(${clientLineItems.valueCents}), 0)::bigint`,
    })
    .from(clients)
    .leftJoin(clientLineItems, eq(clientLineItems.clientId, clients.id))
    .where(where)
    .groupBy(clients.paymentMethod)
    .orderBy(desc(sql`count(distinct ${clients.id})`));

  return rows.map((r) => ({
    paymentMethod: r.paymentMethod ?? "(não definido)",
    count: r.count,
    totalCents: Number(r.totalCents),
  }));
}

export type TopCompany = {
  companyName: string;
  customerCode: string;
  totalCents: number;
};

export async function fetchTopCompanies(
  filters: DashboardFilters,
  limit = 10
): Promise<TopCompany[]> {
  const where = buildWhereConditions(filters);

  const rows = await db
    .select({
      companyName: clients.companyName,
      customerCode: clients.customerCode,
      totalCents: sql<number>`COALESCE(sum(${clientLineItems.valueCents}), 0)::bigint`,
    })
    .from(clients)
    .leftJoin(clientLineItems, eq(clientLineItems.clientId, clients.id))
    .where(where)
    .groupBy(clients.id, clients.companyName, clients.customerCode)
    .orderBy(desc(sql`COALESCE(sum(${clientLineItems.valueCents}), 0)`))
    .limit(limit);

  return rows.map((r) => ({
    companyName: r.companyName,
    customerCode: r.customerCode,
    totalCents: Number(r.totalCents),
  }));
}

export type ImportHistoryRow = {
  id: string;
  createdAt: Date;
  filename: string;
  rowsImported: number;
  rowsErrors: number;
  rowsTotal: number;
};

export async function fetchLastImports(limit = 10): Promise<ImportHistoryRow[]> {
  const rows = await db
    .select({
      id: importHistory.id,
      createdAt: importHistory.createdAt,
      filename: importHistory.filename,
      rowsImported: importHistory.rowsImported,
      rowsErrors: importHistory.rowsErrors,
      rowsTotal: importHistory.rowsTotal,
    })
    .from(importHistory)
    .orderBy(desc(importHistory.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt!,
    filename: r.filename,
    rowsImported: r.rowsImported,
    rowsErrors: r.rowsErrors,
    rowsTotal: r.rowsTotal,
  }));
}

export { formatUSD } from "@/lib/dashboardFilters";

/** Ponto da série temporal (gráfico de evolução) */
export type TimeSeriesPoint = {
  dateKey: string;
  label: string;
  valueCents: number;
};

/**
 * Retorna série temporal de totalValueCents por paymentDate.
 * - Granularidade: DIA se range <= 45 dias, MÊS se > 45.
 * - Se sem dateFrom/dateTo: últimos 90 dias, granularidade automática.
 * - Buckets vazios preenchidos com 0.
 * - Exclui clients com payment_date IS NULL do gráfico.
 */
export async function getTimeSeries(
  filters: DashboardFilters
): Promise<{ points: TimeSeriesPoint[]; granularity: "day" | "month" }> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const dateTo = filters.dateTo ?? todayStr;
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 90);
  const dateFrom = filters.dateFrom ?? defaultFrom.toISOString().slice(0, 10);

  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const granularity: "day" | "month" = daysDiff <= 45 ? "day" : "month";

  const baseConditions = [
    isNull(clients.deletedAt),
    sql`${clients.paymentDate} IS NOT NULL`,
    gte(clients.paymentDate, dateFrom),
    lte(clients.paymentDate, dateTo),
  ];
  if (filters.commercial) {
    baseConditions.push(eq(clients.commercial, filters.commercial as CommercialSdr));
  }
  if (filters.sdr) {
    baseConditions.push(eq(clients.sdr, filters.sdr as CommercialSdr));
  }
  if (filters.paymentMethod) {
    baseConditions.push(eq(clients.paymentMethod, filters.paymentMethod));
  }
  const where = and(...baseConditions);

  const trunc = granularity === "day" ? sql`date_trunc('day', ${clients.paymentDate})::date` : sql`date_trunc('month', ${clients.paymentDate})::date`;

  const rows = await db
    .select({
      bucket: trunc,
      totalCents: sql<number>`COALESCE(sum(${clientLineItems.valueCents}), 0)::bigint`,
    })
    .from(clients)
    .leftJoin(clientLineItems, eq(clientLineItems.clientId, clients.id))
    .where(where)
    .groupBy(trunc)
    .orderBy(sql`1`);

  const dataMap = new Map<string, number>();
  for (const r of rows) {
    const b = r.bucket instanceof Date ? r.bucket : new Date(r.bucket as string);
    const key = granularity === "day"
      ? b.toISOString().slice(0, 10)
      : `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, "0")}`;
    dataMap.set(key, Number(r.totalCents));
  }

  const allKeys = generateDateKeys(dateFrom, dateTo, granularity);
  const points: TimeSeriesPoint[] = allKeys.map((dateKey) => ({
    dateKey,
    label: formatTimeSeriesLabel(dateKey, granularity),
    valueCents: dataMap.get(dateKey) ?? 0,
  }));

  return { points, granularity };
}

function generateDateKeys(dateFrom: string, dateTo: string, granularity: "day" | "month"): string[] {
  const keys: string[] = [];
  const start = new Date(dateFrom + "T00:00:00");
  const end = new Date(dateTo + "T23:59:59");

  if (granularity === "day") {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      keys.push(d.toISOString().slice(0, 10));
    }
  } else {
    const s = new Date(start.getFullYear(), start.getMonth(), 1);
    const e = new Date(end.getFullYear(), end.getMonth(), 1);
    for (let m = new Date(s); m <= e; m.setMonth(m.getMonth() + 1)) {
      keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
    }
  }
  return keys;
}

function formatTimeSeriesLabel(dateKey: string, granularity: "day" | "month"): string {
  if (granularity === "day") {
    const [, m, d] = dateKey.split("-");
    return `${d}/${m}`;
  }
  const [y, m] = dateKey.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m!, 10) - 1]}/${y}`;
}

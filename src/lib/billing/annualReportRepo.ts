/**
 * Repositório para operações CRUD de Annual Report obligations.
 */
import { db } from "@/db";
import { annualReportObligations, clients } from "@/db/schema";
import { and, eq, sql, desc, asc, gte, lte, ilike, isNull } from "drizzle-orm";

import type { SortOrder } from "@/types/billingFilters";

export type ListAnnualReportsParams = {
  status?: "all" | "pending" | "overdue" | "done" | "canceled" | "pending,overdue";
  frequency?: "all" | "Anual" | "Bienal";
  state?: string; // "all" | sigla do estado (ex: "WY")
  year?: string; // "all" | "2024" | "2025" ...
  q?: string;
  from?: string;
  to?: string;
  sort?: SortOrder;
  page: number;
  limit: number;
};

export type AnnualReportRow = {
  id: string;
  clientId: string;
  llcState: string;
  frequency: string;
  periodYear: number;
  dueDate: string;
  status: string;
  doneAt: string | null;
  notes: string | null;
  companyName: string | null;
};

export async function listAnnualReports(
  params: ListAnnualReportsParams
): Promise<{ data: AnnualReportRow[]; total: number }> {
  const {
    status = "pending,overdue",
    frequency,
    state,
    year,
    q,
    from,
    to,
    sort,
    page,
    limit,
  } = params;
  const offset = (page - 1) * limit;

  const conditions = [isNull(clients.deletedAt)];

  if (status === "all") {
    // Mostrar tudo (sem filtro de status)
  } else if (status === "pending,overdue") {
    conditions.push(
      sql`${annualReportObligations.status} IN ('pending', 'overdue')`
    );
  } else if (status === "done") {
    conditions.push(eq(annualReportObligations.status, "done"));
  } else if (status === "canceled") {
    conditions.push(eq(annualReportObligations.status, "canceled"));
  } else if (status === "pending") {
    conditions.push(eq(annualReportObligations.status, "pending"));
  } else if (status === "overdue") {
    conditions.push(eq(annualReportObligations.status, "overdue"));
  }

  if (frequency && frequency !== "all") {
    conditions.push(eq(annualReportObligations.frequency, frequency));
  }

  if (state && state !== "all") {
    conditions.push(eq(annualReportObligations.llcState, state.toUpperCase()));
  }

  if (year && year !== "all") {
    const yearNum = Number(year);
    if (!isNaN(yearNum)) {
      conditions.push(eq(annualReportObligations.periodYear, yearNum));
    }
  }

  if (q) {
    conditions.push(ilike(clients.companyName, `%${q}%`));
  }

  if (from) {
    conditions.push(gte(annualReportObligations.dueDate, from));
  }

  if (to) {
    conditions.push(lte(annualReportObligations.dueDate, to));
  }

  const whereClause = and(...conditions);

  // Aplicar ordenação
  let orderByClause;
  switch (sort) {
    case "dueDateAsc":
      orderByClause = [asc(annualReportObligations.dueDate), desc(annualReportObligations.createdAt)];
      break;
    case "dueDateDesc":
      orderByClause = [desc(annualReportObligations.dueDate), desc(annualReportObligations.createdAt)];
      break;
    case "companyAsc":
      orderByClause = [asc(clients.companyName), desc(annualReportObligations.dueDate)];
      break;
    case "companyDesc":
      orderByClause = [desc(clients.companyName), desc(annualReportObligations.dueDate)];
      break;
    default:
      // Default: overdue primeiro, depois por dueDate asc
      orderByClause = [
        sql`CASE WHEN ${annualReportObligations.status} = 'overdue' THEN 0 ELSE 1 END`,
        asc(annualReportObligations.dueDate),
        desc(annualReportObligations.createdAt),
      ];
  }

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: annualReportObligations.id,
        clientId: annualReportObligations.clientId,
        llcState: annualReportObligations.llcState,
        frequency: annualReportObligations.frequency,
        periodYear: annualReportObligations.periodYear,
        dueDate: annualReportObligations.dueDate,
        status: annualReportObligations.status,
        doneAt: annualReportObligations.doneAt,
        notes: annualReportObligations.notes,
        companyName: clients.companyName,
      })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(whereClause),
  ]);

  return {
    data: data.map((row) => ({
      ...row,
      doneAt: row.doneAt ? row.doneAt.toISOString() : null,
    })),
    total: totalResult[0]?.count ?? 0,
  };
}

export type AnnualReportSummary = {
  pending: { count: number };
  overdue: { count: number };
  done: { count: number };
};

export async function getAnnualReportSummary(
  filters: Partial<ListAnnualReportsParams> = {}
): Promise<AnnualReportSummary> {
  const conditions: ReturnType<typeof and>[] = [isNull(clients.deletedAt)];

  // Aplicar filtros comuns (exceto status que é específico de cada query)
  if (filters.frequency && filters.frequency !== "all") {
    conditions.push(eq(annualReportObligations.frequency, filters.frequency));
  }
  if (filters.state && filters.state !== "all") {
    conditions.push(eq(annualReportObligations.llcState, filters.state.toUpperCase()));
  }
  if (filters.year && filters.year !== "all") {
    const yearNum = Number(filters.year);
    if (!isNaN(yearNum)) {
      conditions.push(eq(annualReportObligations.periodYear, yearNum));
    }
  }
  if (filters.from) {
    conditions.push(gte(annualReportObligations.dueDate, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(annualReportObligations.dueDate, filters.to));
  }
  if (filters.q) {
    conditions.push(ilike(clients.companyName, `%${filters.q}%`));
  }

  const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;

  const [pendingResult, overdueResult, doneResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(
        baseWhere
          ? and(baseWhere, eq(annualReportObligations.status, "pending"))
          : and(isNull(clients.deletedAt), eq(annualReportObligations.status, "pending"))
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(
        baseWhere
          ? and(baseWhere, eq(annualReportObligations.status, "overdue"))
          : and(isNull(clients.deletedAt), eq(annualReportObligations.status, "overdue"))
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(
        baseWhere
          ? and(baseWhere, eq(annualReportObligations.status, "done"))
          : and(isNull(clients.deletedAt), eq(annualReportObligations.status, "done"))
      ),
  ]);

  return {
    pending: { count: pendingResult[0]?.count ?? 0 },
    overdue: { count: overdueResult[0]?.count ?? 0 },
    done: { count: doneResult[0]?.count ?? 0 },
  };
}

export async function markAnnualReportDone(
  obligationId: string,
  doneAt?: string
): Promise<boolean> {
  const res = await db
    .update(annualReportObligations)
    .set({
      status: "done",
      doneAt: doneAt ? new Date(doneAt) : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(annualReportObligations.id, obligationId));
  return (res.rowCount ?? 0) > 0;
}

export async function markAnnualReportCanceled(
  obligationId: string,
  notes?: string | null
): Promise<boolean> {
  const res = await db
    .update(annualReportObligations)
    .set({
      status: "canceled",
      notes: notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(annualReportObligations.id, obligationId));
  return (res.rowCount ?? 0) > 0;
}

export async function reopenAnnualReport(
  obligationId: string
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const obligation = await db
    .select({ dueDate: annualReportObligations.dueDate })
    .from(annualReportObligations)
    .where(eq(annualReportObligations.id, obligationId))
    .limit(1);

  if (obligation.length === 0) return false;

  const newStatus = obligation[0].dueDate < today ? "overdue" : "pending";

  const res = await db
    .update(annualReportObligations)
    .set({
      status: newStatus,
      doneAt: null,
      updatedAt: new Date(),
    })
    .where(eq(annualReportObligations.id, obligationId));
  return (res.rowCount ?? 0) > 0;
}

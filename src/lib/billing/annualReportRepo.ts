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

// ============================================================================
// AGREGAÇÃO POR EMPRESA (COMPANY)
// ============================================================================

type CompanyAggregateDbRow = {
  client_id: string;
  company_name: string | null;
  states: string[] | null;
  pending_count: number;
  overdue_count: number;
  done_count: number;
  canceled_count: number;
  next_due_date: string | null;
};

type CountDbRow = {
  total: number;
};

type SummaryDbRow = {
  pending: number;
  overdue: number;
  done: number;
};

type ObligationDbRow = {
  id: string;
  llc_state: string;
  frequency: string;
  period_year: number;
  due_date: string;
  status: string;
  done_at: Date | null;
  notes: string | null;
  company_name: string | null;
};

export type ListCompaniesParams = {
  status?: "all" | "pending" | "overdue" | "done" | "canceled" | "pending,overdue";
  frequency?: "all" | "Anual" | "Bienal";
  state?: string;
  year?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: SortOrder;
  page: number;
  limit: number;
};

export type CompanyAggregateRow = {
  clientId: string;
  companyName: string | null;
  states: string[];
  counts: {
    pending: number;
    overdue: number;
    done: number;
    canceled: number;
  };
  nextDueDate: string | null;
};

/**
 * Lista empresas agregadas com contagem de obrigações por status.
 * Aplica filtros server-side e retorna paginado.
 */
export async function listAnnualReportCompanies(
  params: ListCompaniesParams
): Promise<{ data: CompanyAggregateRow[]; total: number }> {
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

  // Construir condições WHERE para as obrigações
  const conditions: ReturnType<typeof sql>[] = [];
  conditions.push(sql`${clients.deletedAt} IS NULL`);

  // Filtro de status nas obrigações (para HAVING)
  let statusHavingClause = "";
  if (status === "pending,overdue") {
    statusHavingClause = `HAVING SUM(CASE WHEN aro.status IN ('pending', 'overdue') THEN 1 ELSE 0 END) > 0`;
  } else if (status === "pending") {
    statusHavingClause = `HAVING SUM(CASE WHEN aro.status = 'pending' THEN 1 ELSE 0 END) > 0`;
  } else if (status === "overdue") {
    statusHavingClause = `HAVING SUM(CASE WHEN aro.status = 'overdue' THEN 1 ELSE 0 END) > 0`;
  } else if (status === "done") {
    statusHavingClause = `HAVING SUM(CASE WHEN aro.status = 'done' THEN 1 ELSE 0 END) > 0`;
  } else if (status === "canceled") {
    statusHavingClause = `HAVING SUM(CASE WHEN aro.status = 'canceled' THEN 1 ELSE 0 END) > 0`;
  }
  // "all" não tem HAVING

  // Filtros adicionais nas obrigações
  const whereFragments: string[] = ["c.deleted_at IS NULL"];

  if (frequency && frequency !== "all") {
    whereFragments.push(`aro.frequency = '${frequency}'`);
  }
  if (state && state !== "all") {
    whereFragments.push(`aro.llc_state = '${state.toUpperCase()}'`);
  }
  if (year && year !== "all") {
    const yearNum = Number(year);
    if (!isNaN(yearNum)) {
      whereFragments.push(`aro.period_year = ${yearNum}`);
    }
  }
  if (from) {
    whereFragments.push(`aro.due_date >= '${from}'`);
  }
  if (to) {
    whereFragments.push(`aro.due_date <= '${to}'`);
  }
  if (q) {
    whereFragments.push(`c.company_name ILIKE '%${q.replace(/'/g, "''")}%'`);
  }

  const whereClause = whereFragments.join(" AND ");

  // Ordenação
  let orderByClause = "ORDER BY next_due_date ASC NULLS LAST, c.company_name ASC";
  switch (sort) {
    case "dueDateAsc":
      orderByClause = "ORDER BY next_due_date ASC NULLS LAST";
      break;
    case "dueDateDesc":
      orderByClause = "ORDER BY next_due_date DESC NULLS LAST";
      break;
    case "companyAsc":
      orderByClause = "ORDER BY c.company_name ASC NULLS LAST";
      break;
    case "companyDesc":
      orderByClause = "ORDER BY c.company_name DESC NULLS LAST";
      break;
    default:
      // Default: empresas com overdue primeiro, depois por próximo vencimento
      orderByClause = `ORDER BY 
        CASE WHEN SUM(CASE WHEN aro.status = 'overdue' THEN 1 ELSE 0 END) > 0 THEN 0 ELSE 1 END,
        next_due_date ASC NULLS LAST`;
  }

  // Query principal agregada
  const queryText = `
    SELECT 
      c.id as client_id,
      c.company_name,
      ARRAY_AGG(DISTINCT aro.llc_state) FILTER (WHERE aro.llc_state IS NOT NULL) as states,
      SUM(CASE WHEN aro.status = 'pending' THEN 1 ELSE 0 END)::int as pending_count,
      SUM(CASE WHEN aro.status = 'overdue' THEN 1 ELSE 0 END)::int as overdue_count,
      SUM(CASE WHEN aro.status = 'done' THEN 1 ELSE 0 END)::int as done_count,
      SUM(CASE WHEN aro.status = 'canceled' THEN 1 ELSE 0 END)::int as canceled_count,
      MIN(CASE WHEN aro.status IN ('pending', 'overdue') THEN aro.due_date ELSE NULL END) as next_due_date
    FROM clients c
    INNER JOIN annual_report_obligations aro ON aro.client_id = c.id
    WHERE ${whereClause}
    GROUP BY c.id, c.company_name
    ${statusHavingClause}
    ${orderByClause}
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  // Query de contagem total
  const countQueryText = `
    SELECT COUNT(*)::int as total FROM (
      SELECT c.id
      FROM clients c
      INNER JOIN annual_report_obligations aro ON aro.client_id = c.id
      WHERE ${whereClause}
      GROUP BY c.id
      ${statusHavingClause}
    ) sub
  `;

  const [dataResult, countResult] = await Promise.all([
    db.execute(sql.raw(queryText)),
    db.execute(sql.raw(countQueryText)),
  ]);

  const rows = dataResult.rows as CompanyAggregateDbRow[];
  const data: CompanyAggregateRow[] = rows.map((row) => ({
    clientId: row.client_id,
    companyName: row.company_name,
    states: row.states ?? [],
    counts: {
      pending: row.pending_count ?? 0,
      overdue: row.overdue_count ?? 0,
      done: row.done_count ?? 0,
      canceled: row.canceled_count ?? 0,
    },
    nextDueDate: row.next_due_date ?? null,
  }));

  const countRows = countResult.rows as CountDbRow[];
  const total = countRows[0]?.total ?? 0;

  return { data, total };
}

/**
 * Retorna summary agregado por empresas (count de empresas por status).
 */
export async function getCompanySummary(
  filters: Partial<ListCompaniesParams> = {}
): Promise<{ pending: number; overdue: number; done: number }> {
  const whereFragments: string[] = ["c.deleted_at IS NULL"];

  if (filters.frequency && filters.frequency !== "all") {
    whereFragments.push(`aro.frequency = '${filters.frequency}'`);
  }
  if (filters.state && filters.state !== "all") {
    whereFragments.push(`aro.llc_state = '${filters.state.toUpperCase()}'`);
  }
  if (filters.year && filters.year !== "all") {
    const yearNum = Number(filters.year);
    if (!isNaN(yearNum)) {
      whereFragments.push(`aro.period_year = ${yearNum}`);
    }
  }
  if (filters.from) {
    whereFragments.push(`aro.due_date >= '${filters.from}'`);
  }
  if (filters.to) {
    whereFragments.push(`aro.due_date <= '${filters.to}'`);
  }
  if (filters.q) {
    whereFragments.push(`c.company_name ILIKE '%${filters.q.replace(/'/g, "''")}%'`);
  }

  const whereClause = whereFragments.join(" AND ");

  // Conta obrigações totais por status (não empresas, mas obrigações)
  const queryText = `
    SELECT 
      SUM(CASE WHEN aro.status = 'pending' THEN 1 ELSE 0 END)::int as pending,
      SUM(CASE WHEN aro.status = 'overdue' THEN 1 ELSE 0 END)::int as overdue,
      SUM(CASE WHEN aro.status = 'done' THEN 1 ELSE 0 END)::int as done
    FROM clients c
    INNER JOIN annual_report_obligations aro ON aro.client_id = c.id
    WHERE ${whereClause}
  `;

  const result = await db.execute(sql.raw(queryText));
  const summaryRows = result.rows as SummaryDbRow[];
  const row = summaryRows[0];

  return {
    pending: row?.pending ?? 0,
    overdue: row?.overdue ?? 0,
    done: row?.done ?? 0,
  };
}

/**
 * Lista obrigações detalhadas de uma empresa específica.
 */
export type CompanyObligationRow = {
  id: string;
  llcState: string;
  frequency: string;
  periodYear: number;
  dueDate: string;
  status: string;
  doneAt: string | null;
  notes: string | null;
};

export async function listCompanyObligations(
  clientId: string,
  filters: { state?: string; year?: string; status?: string } = {}
): Promise<{ companyName: string | null; obligations: CompanyObligationRow[] }> {
  const whereFragments: string[] = [`aro.client_id = '${clientId}'`];

  if (filters.state) {
    whereFragments.push(`aro.llc_state = '${filters.state.toUpperCase()}'`);
  }
  if (filters.year) {
    const yearNum = Number(filters.year);
    if (!isNaN(yearNum)) {
      whereFragments.push(`aro.period_year = ${yearNum}`);
    }
  }
  if (filters.status && filters.status !== "all") {
    if (filters.status === "pending,overdue") {
      whereFragments.push(`aro.status IN ('pending', 'overdue')`);
    } else {
      whereFragments.push(`aro.status = '${filters.status}'`);
    }
  }

  const whereClause = whereFragments.join(" AND ");

  const queryText = `
    SELECT 
      aro.id,
      aro.llc_state,
      aro.frequency,
      aro.period_year,
      aro.due_date,
      aro.status,
      aro.done_at,
      aro.notes,
      c.company_name
    FROM annual_report_obligations aro
    INNER JOIN clients c ON c.id = aro.client_id
    WHERE ${whereClause}
    ORDER BY aro.llc_state ASC, aro.period_year DESC, aro.due_date ASC
  `;

  const result = await db.execute(sql.raw(queryText));
  const rows = result.rows as ObligationDbRow[];

  const companyName = rows.length > 0 ? rows[0].company_name : null;

  const obligations: CompanyObligationRow[] = rows.map((row) => ({
    id: row.id,
    llcState: row.llc_state,
    frequency: row.frequency,
    periodYear: row.period_year,
    dueDate: row.due_date,
    status: row.status,
    doneAt: row.done_at ? new Date(row.done_at).toISOString() : null,
    notes: row.notes,
  }));

  return { companyName, obligations };
}

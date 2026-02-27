/**
 * Repositório para dados agregados por pessoa (personGroupId).
 * Usa subquery WHERE client_id IN (SELECT id FROM clients WHERE person_group_id = ?) para evitar N+1.
 */
import { db } from "@/db";
import {
  clients,
  annualReportObligations,
  billingCharges,
  clientLineItems,
  personGroups,
} from "@/db/schema";
import { and, eq, inArray, isNull, sql, asc } from "drizzle-orm";
import type {
  PersonDashboardPayload,
  PersonDashboardCompanies,
  PersonDashboardProcesses,
  PersonDashboardAnnualReports,
  PersonDashboardAddressCharges,
} from "./schemas";

const PERSON_SUBQUERY = (param: string) =>
  `(SELECT id FROM clients WHERE person_group_id = '${param.replace(/'/g, "''")}' AND deleted_at IS NULL)`;

/**
 * Retorna os clientIds do grupo da pessoa (não deletados).
 */
export async function getPersonClientIds(personGroupId: string): Promise<string[]> {
  const rows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.personGroupId, personGroupId), isNull(clients.deletedAt)));
  return rows.map((r) => r.id);
}

/**
 * Total de empresas e até `limit` itens (nome, código, link).
 */
export async function getPersonCompanies(
  personGroupId: string,
  limit: number
): Promise<PersonDashboardCompanies> {
  const baseWhere = and(
    eq(clients.personGroupId, personGroupId),
    isNull(clients.deletedAt)
  );

  const [items, countRow] = await Promise.all([
    db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        customerCode: clients.customerCode,
      })
      .from(clients)
      .where(baseWhere)
      .orderBy(asc(clients.companyName))
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(baseWhere),
  ]);

  const total = countRow[0]?.count ?? 0;
  return {
    total,
    items: items.map((r) => ({
      clientId: r.id,
      companyName: r.companyName,
      customerCode: r.customerCode,
    })),
  };
}

function toIsoDate(val: Date | string | null): string | null {
  if (val == null) return null;
  if (typeof val === "string") return val.slice(0, 10);
  return val instanceof Date ? val.toISOString().slice(0, 10) : null;
}

/**
 * Processos LLC do grupo: totais por status + top 5 (in_progress primeiro, depois por updatedAt).
 * currentStageTitle: primeira step in_progress ou pending (order mínimo).
 */
export async function getPersonProcesses(
  personGroupId: string,
  limit: number
): Promise<PersonDashboardProcesses> {
  const subq = PERSON_SUBQUERY(personGroupId);

  const summarySql = `
    WITH per_process AS (
      SELECT
        p.id,
        COUNT(s.id)::int AS total_steps,
        COALESCE(SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END), 0)::int AS done_steps,
        COALESCE(SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END), 0)::int AS in_progress_steps
      FROM processes p
      LEFT JOIN process_steps s ON s.process_id = p.id
      WHERE p.client_id IN ${subq} AND p.kind = 'LLC_PROCESS'
      GROUP BY p.id
    ),
    classified AS (
      SELECT
        CASE
          WHEN total_steps = 0 THEN 'open'
          WHEN done_steps = total_steps THEN 'done'
          WHEN done_steps = 0 AND in_progress_steps = 0 THEN 'open'
          ELSE 'in_progress'
        END AS derived_status
      FROM per_process
    )
    SELECT derived_status, COUNT(*)::int AS cnt FROM classified GROUP BY derived_status
  `;

  const listSql = `
    WITH per_process AS (
      SELECT
        p.id,
        p.client_id,
        p.updated_at,
        c.company_name,
        COUNT(s.id)::int AS total_steps,
        COALESCE(SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END), 0)::int AS done_steps,
        COALESCE(SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END), 0)::int AS in_progress_steps
      FROM processes p
      INNER JOIN clients c ON c.id = p.client_id
      LEFT JOIN process_steps s ON s.process_id = p.id
      WHERE p.client_id IN ${subq} AND p.kind = 'LLC_PROCESS'
      GROUP BY p.id, p.client_id, p.updated_at, c.company_name
    ),
    current_step AS (
      SELECT DISTINCT ON (st.process_id) st.process_id, st.title
      FROM process_steps st
      INNER JOIN per_process pp ON pp.id = st.process_id
      WHERE st.status IN ('in_progress', 'pending')
      ORDER BY st.process_id, CASE WHEN st.status = 'in_progress' THEN 0 ELSE 1 END, st."order" ASC
    )
    SELECT
      pp.id AS process_id,
      pp.client_id,
      pp.company_name,
      pp.updated_at,
      pp.total_steps,
      pp.done_steps,
      pp.in_progress_steps,
      cs.title AS current_stage_title
    FROM per_process pp
    LEFT JOIN current_step cs ON cs.process_id = pp.id
    ORDER BY
      CASE WHEN pp.total_steps > 0 AND pp.done_steps < pp.total_steps AND (pp.in_progress_steps > 0 OR pp.done_steps > 0) THEN 0 ELSE 1 END,
      pp.updated_at DESC
    LIMIT ${limit}
  `;

  type SummaryRow = { derived_status: string; cnt: number };
  type ListRow = {
    process_id: string;
    client_id: string;
    company_name: string | null;
    updated_at: Date | string;
    total_steps: number;
    done_steps: number;
    in_progress_steps: number;
    current_stage_title: string | null;
  };

  const [summaryResult, listResult] = await Promise.all([
    db.execute<SummaryRow>(sql.raw(summarySql)),
    db.execute<ListRow>(sql.raw(listSql)),
  ]);

  const totals = { open: 0, in_progress: 0, done: 0 };
  for (const row of summaryResult.rows) {
    const s = row.derived_status as keyof Pick<PersonDashboardProcesses["totals"], "open" | "in_progress" | "done">;
    if (s in totals) (totals as Record<string, number>)[s] = row.cnt ?? 0;
  }

  const items: PersonDashboardProcesses["items"] = listResult.rows.map((row: ListRow) => {
    const totalSteps = row.total_steps ?? 0;
    const doneSteps = row.done_steps ?? 0;
    const progressPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
    let status: "open" | "in_progress" | "done" = "open";
    if (totalSteps > 0 && doneSteps === totalSteps) status = "done";
    else if (row.in_progress_steps > 0 || (doneSteps > 0 && doneSteps < totalSteps)) status = "in_progress";

    return {
      processId: row.process_id,
      clientId: row.client_id,
      companyName: row.company_name,
      status,
      progressPct,
      currentStageTitle: row.current_stage_title ?? null,
      updatedAt:
        typeof row.updated_at === "string"
          ? row.updated_at
          : (row.updated_at as Date).toISOString(),
    };
  });

  return { totals, items };
}

/**
 * Annual reports do grupo: totais por status + top 5 pending/overdue por dueDate asc.
 */
export async function getPersonAnnualReports(
  clientIds: string[],
  limit: number
): Promise<PersonDashboardAnnualReports> {
  if (clientIds.length === 0) {
    return {
      totals: { pending: 0, overdue: 0, done: 0, canceled: 0 },
      items: [],
    };
  }

  const baseCond = and(
    inArray(annualReportObligations.clientId, clientIds),
    isNull(clients.deletedAt)
  );

  const [pendingR, overdueR, doneR, canceledR, itemsRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(and(baseCond, eq(annualReportObligations.status, "pending"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(and(baseCond, eq(annualReportObligations.status, "overdue"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(and(baseCond, eq(annualReportObligations.status, "done"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(and(baseCond, eq(annualReportObligations.status, "canceled"))),
    db
      .select({
        id: annualReportObligations.id,
        clientId: annualReportObligations.clientId,
        companyName: clients.companyName,
        llcState: annualReportObligations.llcState,
        periodYear: annualReportObligations.periodYear,
        dueDate: annualReportObligations.dueDate,
        status: annualReportObligations.status,
        frequency: annualReportObligations.frequency,
      })
      .from(annualReportObligations)
      .innerJoin(clients, eq(annualReportObligations.clientId, clients.id))
      .where(
        and(
          baseCond,
          sql`${annualReportObligations.status} IN ('pending', 'overdue')`
        )
      )
      .orderBy(asc(annualReportObligations.dueDate))
      .limit(limit),
  ]);

  const totals = {
    pending: pendingR[0]?.count ?? 0,
    overdue: overdueR[0]?.count ?? 0,
    done: doneR[0]?.count ?? 0,
    canceled: canceledR[0]?.count ?? 0,
  };

  const items: PersonDashboardAnnualReports["items"] = itemsRows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    companyName: r.companyName,
    llcState: r.llcState,
    periodYear: r.periodYear,
    dueDate: toIsoDate(r.dueDate) ?? "",
    status: r.status,
    frequency: r.frequency,
  }));

  return { totals, items };
}

/**
 * Cobranças de endereço do grupo: totais por status + top 5 pending/overdue por dueDate asc.
 */
export async function getPersonAddressCharges(
  clientIds: string[],
  limit: number
): Promise<PersonDashboardAddressCharges> {
  if (clientIds.length === 0) {
    return {
      totals: { pending: 0, overdue: 0, paid: 0, canceled: 0 },
      items: [],
    };
  }

  const baseCond = and(
    inArray(billingCharges.clientId, clientIds),
    isNull(clients.deletedAt)
  );

  const [pendingR, overdueR, paidR, canceledR, itemsRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(billingCharges)
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .where(and(baseCond, eq(billingCharges.status, "pending"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(billingCharges)
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .where(and(baseCond, eq(billingCharges.status, "overdue"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(billingCharges)
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .where(and(baseCond, eq(billingCharges.status, "paid"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(billingCharges)
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .where(and(baseCond, eq(billingCharges.status, "canceled"))),
    db
      .select({
        id: billingCharges.id,
        clientId: billingCharges.clientId,
        companyName: clients.companyName,
        dueDate: billingCharges.dueDate,
        status: billingCharges.status,
        billingPeriod: clientLineItems.billingPeriod,
        addressProvider: clientLineItems.addressProvider,
        addressLine1: clientLineItems.addressLine1,
      })
      .from(billingCharges)
      .innerJoin(clients, eq(billingCharges.clientId, clients.id))
      .innerJoin(clientLineItems, eq(billingCharges.lineItemId, clientLineItems.id))
      .where(
        and(
          baseCond,
          sql`${billingCharges.status} IN ('pending', 'overdue')`
        )
      )
      .orderBy(asc(billingCharges.dueDate))
      .limit(limit),
  ]);

  const totals = {
    pending: pendingR[0]?.count ?? 0,
    overdue: overdueR[0]?.count ?? 0,
    paid: paidR[0]?.count ?? 0,
    canceled: canceledR[0]?.count ?? 0,
  };

  const items: PersonDashboardAddressCharges["items"] = itemsRows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    companyName: r.companyName,
    dueDate: toIsoDate(r.dueDate),
    status: r.status,
    period: r.billingPeriod ?? null,
    addressProvider: r.addressProvider ?? null,
    addressLine1: r.addressLine1 ?? null,
  }));

  return { totals, items };
}

/**
 * Verifica se existe um registro em person_groups com o id dado (pessoa cadastrada, mesmo sem empresas).
 */
export async function personGroupExists(personGroupId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: personGroups.id })
    .from(personGroups)
    .where(eq(personGroups.id, personGroupId))
    .limit(1);
  return !!row;
}

/**
 * Payload vazio do dashboard (pessoa sem empresas ainda).
 */
export function getEmptyPersonDashboardPayload(personGroupId: string): PersonDashboardPayload {
  return {
    personGroupId,
    companies: { total: 0, items: [] },
    processes: {
      totals: { open: 0, in_progress: 0, done: 0 },
      items: [],
    },
    annualReports: {
      totals: { pending: 0, overdue: 0, done: 0, canceled: 0 },
      items: [],
    },
    addressCharges: {
      totals: { pending: 0, overdue: 0, paid: 0, canceled: 0 },
      items: [],
    },
  };
}

/**
 * Agrega todo o painel da pessoa: empresas, processos, annual reports, cobranças.
 * Chama ensure engines uma vez (annual report + address charges) e ensure LLC process por cliente do grupo.
 */
export async function getPersonDashboard(
  personGroupId: string
): Promise<PersonDashboardPayload | null> {
  const clientIds = await getPersonClientIds(personGroupId);
  if (clientIds.length === 0) return null;

  const [
    ensureAnnualReportObligations,
    ensureCharges,
  ] = await Promise.all([
    import("@/lib/billing/annualReportEngine").then((m) => m.ensureAnnualReportObligations({ windowMonths: 6 })),
    import("@/lib/billing/chargesEngine").then((m) => m.ensureCharges(60)),
  ]);
  void ensureAnnualReportObligations;
  void ensureCharges;

  const { ensureLlcProcessForClient } = await import("@/lib/processes/engine");
  for (const id of clientIds) {
    await ensureLlcProcessForClient(id);
  }

  const LIMIT_COMPANIES = 5;
  const LIMIT_PROCESSES = 5;
  const LIMIT_ANNUAL = 5;
  const LIMIT_CHARGES = 5;

  const [companies, processesData, annualReports, addressCharges] = await Promise.all([
    getPersonCompanies(personGroupId, LIMIT_COMPANIES),
    getPersonProcesses(personGroupId, LIMIT_PROCESSES),
    getPersonAnnualReports(clientIds, LIMIT_ANNUAL),
    getPersonAddressCharges(clientIds, LIMIT_CHARGES),
  ]);

  return {
    personGroupId,
    companies,
    processes: processesData,
    annualReports,
    addressCharges,
  };
}

import { db } from "@/db";
import { clients, clientLineItems, processes, processSteps } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { ListProcessesQuery, CreateProcessInput, UpdateStepStatusInput } from "./schemas";
import { LLC_STEPS_TEMPLATE } from "./templates/llc";

export type ProcessListItem = {
  id: string;
  clientId: string;
  companyName: string | null;
  kind: string;
  status: "open" | "in_progress" | "done";
  totalSteps: number;
  doneSteps: number;
  inProgressSteps: number;
  pendingSteps: number;
  progressPct: number;
  paymentDate: string | null;
  updatedAt: string;
  createdAt: string;
};

export type ProcessSummary = {
  all: number;
  open: number;
  in_progress: number;
  done: number;
};

export type ListProcessesResult = {
  items: ProcessListItem[];
  total: number;
  summary: ProcessSummary;
};

export type StepsSummaryItem = {
  order: number;
  title: string;
  doneCount: number;
};

export type StageSummaryItem = {
  order: number;
  title: string;
  count: number;
};

export type StageSummaryResult = {
  stageSummary: StageSummaryItem[];
  doneCount: number;
};

function toISOString(val: Date | string): string {
  if (typeof val === "string") return val;
  return val.toISOString();
}

function computeProcessStatusFromCounts(counts: {
  total: number;
  done: number;
  inProgress: number;
}): "open" | "in_progress" | "done" {
  const { total, done, inProgress } = counts;
  if (total === 0) return "open";
  if (done === total) return "done";
  if (done === 0 && inProgress === 0) return "open";
  return "in_progress";
}

export async function listProcesses(
  params: ListProcessesQuery
): Promise<ListProcessesResult> {
  const { q, status, assignee, department, kind, paymentDateFrom, paymentDateTo, sort, page, limit } = params;
  const offset = (page - 1) * limit;

  const whereFragments: string[] = ["c.deleted_at IS NULL"];

  if (q) {
    const escaped = q.replace(/'/g, "''");
    whereFragments.push(`c.company_name ILIKE '%${escaped}%'`);
  }
  if (kind) {
    const escaped = kind.replace(/'/g, "''");
    whereFragments.push(`p.kind = '${escaped}'`);
  }
  if (paymentDateFrom) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(paymentDateFrom)) {
      whereFragments.push(`c.payment_date >= '${paymentDateFrom}'::date`);
    }
  }
  if (paymentDateTo) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(paymentDateTo)) {
      whereFragments.push(`c.payment_date <= '${paymentDateTo}'::date`);
    }
  }

  const filterByStep: string[] = [];
  if (assignee) {
    const escaped = assignee.replace(/'/g, "''");
    filterByStep.push(`s.assignee ILIKE '%${escaped}%'`);
  }
  if (department) {
    const escaped = department.replace(/'/g, "''");
    filterByStep.push(`s.department ILIKE '%${escaped}%'`);
  }

  // status baseado em agregados das steps
  let statusHavingClause = "";
  if (status === "done") {
    statusHavingClause = `HAVING COUNT(s.id) > 0 AND SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END) = COUNT(s.id)`;
  } else if (status === "open") {
    statusHavingClause =
      "HAVING COUNT(s.id) > 0 AND SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END) = 0 AND SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END) = 0";
  } else if (status === "in_progress") {
    statusHavingClause =
      "HAVING COUNT(s.id) > 0 AND (SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END) > 0 OR SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END) > 0) AND NOT (SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END) = COUNT(s.id))";
  }

  const baseWhere = whereFragments.join(" AND ");
  const stepFilter =
    filterByStep.length > 0 ? ` AND (${filterByStep.join(" AND ")})` : "";

  let orderByClause = "ORDER BY p.updated_at DESC";
  switch (sort) {
    case "progress_asc":
      orderByClause =
        "ORDER BY CASE WHEN COUNT(s.id) = 0 THEN 0 ELSE (SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END)::decimal / COUNT(s.id)) END ASC, p.updated_at DESC";
      break;
    case "progress_desc":
      orderByClause =
        "ORDER BY CASE WHEN COUNT(s.id) = 0 THEN 0 ELSE (SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END)::decimal / COUNT(s.id)) END DESC, p.updated_at DESC";
      break;
    case "company_asc":
      orderByClause = "ORDER BY c.company_name ASC NULLS LAST, p.updated_at DESC";
      break;
    case "paymentDate_asc":
      orderByClause = "ORDER BY c.payment_date ASC NULLS LAST, p.updated_at DESC";
      break;
    case "paymentDate_desc":
      orderByClause = "ORDER BY c.payment_date DESC NULLS LAST, p.updated_at DESC";
      break;
    default:
      orderByClause = "ORDER BY p.updated_at DESC";
  }

  const queryText = `
    SELECT
      p.id,
      p.client_id,
      p.kind,
      p.status,
      p.created_at,
      p.updated_at,
      c.company_name,
      c.payment_date,
      COUNT(s.id)::int AS total_steps,
      SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END)::int AS done_steps,
      SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END)::int AS in_progress_steps,
      SUM(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END)::int AS pending_steps
    FROM processes p
    INNER JOIN clients c ON c.id = p.client_id
    LEFT JOIN process_steps s ON s.process_id = p.id
    WHERE ${baseWhere}${stepFilter}
    GROUP BY p.id, c.company_name, c.payment_date
    ${statusHavingClause}
    ${orderByClause}
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const countQueryText = `
    SELECT COUNT(*)::int AS total FROM (
      SELECT p.id
      FROM processes p
      INNER JOIN clients c ON c.id = p.client_id
      LEFT JOIN process_steps s ON s.process_id = p.id
      WHERE ${baseWhere}${stepFilter}
      GROUP BY p.id, c.company_name
      ${statusHavingClause}
    ) sub
  `;

  // Summary: mesmos filtros base (q, kind, assignee, department, date) SEM filtro de status e SEM paginação
  const summaryQueryText = `
    WITH per_process AS (
      SELECT
        p.id,
        COUNT(s.id)::int AS total_steps,
        COALESCE(SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END), 0)::int AS done_steps,
        COALESCE(SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END), 0)::int AS in_progress_steps
      FROM processes p
      INNER JOIN clients c ON c.id = p.client_id
      LEFT JOIN process_steps s ON s.process_id = p.id
      WHERE ${baseWhere}${stepFilter}
      GROUP BY p.id
    ),
    classified AS (
      SELECT
        id,
        CASE
          WHEN total_steps = 0 THEN 'open'
          WHEN done_steps = total_steps THEN 'done'
          WHEN done_steps = 0 AND in_progress_steps = 0 THEN 'open'
          ELSE 'in_progress'
        END AS derived_status
      FROM per_process
    )
    SELECT derived_status, COUNT(*)::int AS cnt
    FROM classified
    GROUP BY derived_status
  `;

  type Row = {
    id: string;
    client_id: string;
    company_name: string | null;
    kind: string;
    status: "open" | "in_progress" | "done";
    created_at: Date | string;
    updated_at: Date | string;
    payment_date: Date | string | null;
    total_steps: number | null;
    done_steps: number | null;
    in_progress_steps: number | null;
    pending_steps: number | null;
  };

  const [dataResult, countResult, summaryResult] = await Promise.all([
    db.execute<Row>(sql.raw(queryText)),
    db.execute<{ total: number }>(sql.raw(countQueryText)),
    db.execute<{ derived_status: string; cnt: number }>(sql.raw(summaryQueryText)),
  ]);

  const rows = dataResult.rows;
  const total = countResult.rows[0]?.total ?? 0;

  const summary: ProcessSummary = { all: 0, open: 0, in_progress: 0, done: 0 };
  for (const row of summaryResult.rows) {
    const status = row.derived_status as keyof Omit<ProcessSummary, "all">;
    if (status === "open" || status === "in_progress" || status === "done") {
      summary[status] = row.cnt ?? 0;
    }
  }
  summary.all = summary.open + summary.in_progress + summary.done;

  const items: ProcessListItem[] = rows.map((row: Row) => {
    const totalSteps = row.total_steps ?? 0;
    const doneSteps = row.done_steps ?? 0;
    const inProgressSteps = row.in_progress_steps ?? 0;
    const pendingSteps = row.pending_steps ?? 0;

    const progressPct =
      totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

    const derivedStatus = computeProcessStatusFromCounts({
      total: totalSteps,
      done: doneSteps,
      inProgress: inProgressSteps,
    });

    return {
      id: row.id,
      clientId: row.client_id,
      companyName: row.company_name,
      kind: row.kind,
      status: derivedStatus,
      totalSteps,
      doneSteps,
      inProgressSteps,
      pendingSteps,
      progressPct,
      paymentDate:
        row.payment_date != null
          ? typeof row.payment_date === "string"
            ? row.payment_date.slice(0, 10)
            : (row.payment_date as Date).toISOString().slice(0, 10)
          : null,
      createdAt: toISOString(row.created_at),
      updatedAt: toISOString(row.updated_at),
    };
  });

  return { items, total, summary };
}

/**
 * Contagem de processos por etapa (step) com status=done.
 * Apenas para kind=LLC_PROCESS; respeita filtros base (q, assignee, department, paymentDate); ignora status e paginação.
 */
export async function getStepsSummary(
  params: ListProcessesQuery
): Promise<StepsSummaryItem[]> {
  const { q, assignee, department, kind, paymentDateFrom, paymentDateTo } = params;

  if (kind && kind !== "LLC_PROCESS") {
    return [];
  }

  const whereFragments: string[] = ["c.deleted_at IS NULL", "p.kind = 'LLC_PROCESS'"];
  if (q) {
    const escaped = q.replace(/'/g, "''");
    whereFragments.push(`c.company_name ILIKE '%${escaped}%'`);
  }
  if (paymentDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(paymentDateFrom)) {
    whereFragments.push(`c.payment_date >= '${paymentDateFrom}'::date`);
  }
  if (paymentDateTo && /^\d{4}-\d{2}-\d{2}$/.test(paymentDateTo)) {
    whereFragments.push(`c.payment_date <= '${paymentDateTo}'::date`);
  }

  const filterByStep: string[] = [];
  if (assignee) {
    const escaped = assignee.replace(/'/g, "''");
    filterByStep.push(`s.assignee ILIKE '%${escaped}%'`);
  }
  if (department) {
    const escaped = department.replace(/'/g, "''");
    filterByStep.push(`s.department ILIKE '%${escaped}%'`);
  }

  const baseWhere = whereFragments.join(" AND ");
  const stepFilter =
    filterByStep.length > 0 ? ` AND (${filterByStep.join(" AND ")})` : "";

  const queryText = `
    WITH filtered AS (
      SELECT DISTINCT p.id AS pid
      FROM processes p
      INNER JOIN clients c ON c.id = p.client_id
      LEFT JOIN process_steps s ON s.process_id = p.id
      WHERE ${baseWhere}${stepFilter}
    )
    SELECT st.order AS "order", MIN(st.title) AS title, COUNT(*)::int AS done_count
    FROM process_steps st
    INNER JOIN filtered f ON f.pid = st.process_id
    WHERE st.status = 'done'
    GROUP BY st.order
    ORDER BY st.order ASC
  `;

  const result = await db.execute<{ order: number; title: string; done_count: number }>(
    sql.raw(queryText)
  );

  const byOrder = new Map<number, StepsSummaryItem>();
  for (const row of result.rows) {
    byOrder.set(row.order, {
      order: row.order,
      title: row.title ?? "",
      doneCount: row.done_count ?? 0,
    });
  }

  return LLC_STEPS_TEMPLATE.map((step) => ({
    order: step.order,
    title: step.title,
    doneCount: byOrder.get(step.order)?.doneCount ?? 0,
  }));
}

/**
 * Contagem de processos por "etapa atual" (funil).
 * Etapa atual = primeira step in_progress (menor order), senão primeira pending; se todas done → bucket Concluídos.
 * Apenas LLC_PROCESS; respeita filtros base; ignora status e paginação.
 */
export async function getStageSummary(
  params: ListProcessesQuery
): Promise<StageSummaryResult> {
  const { q, assignee, department, kind, paymentDateFrom, paymentDateTo } = params;

  if (kind && kind !== "LLC_PROCESS") {
    return { stageSummary: [], doneCount: 0 };
  }

  const whereFragments: string[] = ["c.deleted_at IS NULL", "p.kind = 'LLC_PROCESS'"];
  if (q) {
    const escaped = q.replace(/'/g, "''");
    whereFragments.push(`c.company_name ILIKE '%${escaped}%'`);
  }
  if (paymentDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(paymentDateFrom)) {
    whereFragments.push(`c.payment_date >= '${paymentDateFrom}'::date`);
  }
  if (paymentDateTo && /^\d{4}-\d{2}-\d{2}$/.test(paymentDateTo)) {
    whereFragments.push(`c.payment_date <= '${paymentDateTo}'::date`);
  }

  const filterByStep: string[] = [];
  if (assignee) {
    const escaped = assignee.replace(/'/g, "''");
    filterByStep.push(`s.assignee ILIKE '%${escaped}%'`);
  }
  if (department) {
    const escaped = department.replace(/'/g, "''");
    filterByStep.push(`s.department ILIKE '%${escaped}%'`);
  }

  const baseWhere = whereFragments.join(" AND ");
  const stepFilter =
    filterByStep.length > 0 ? ` AND (${filterByStep.join(" AND ")})` : "";

  const stageQueryText = `
    WITH filtered AS (
      SELECT DISTINCT p.id AS pid
      FROM processes p
      INNER JOIN clients c ON c.id = p.client_id
      LEFT JOIN process_steps s ON s.process_id = p.id
      WHERE ${baseWhere}${stepFilter}
    ),
    ranked AS (
      SELECT
        s.process_id,
        s."order",
        s.title,
        row_number() OVER (
          PARTITION BY s.process_id
          ORDER BY
            CASE WHEN s.status = 'in_progress' THEN 0 WHEN s.status = 'pending' THEN 1 ELSE 2 END,
            s."order" ASC
        ) AS rn
      FROM process_steps s
      INNER JOIN filtered f ON f.pid = s.process_id
      WHERE s.status IN ('in_progress', 'pending')
    ),
    current_steps AS (
      SELECT process_id, "order", title FROM ranked WHERE rn = 1
    )
    SELECT "order", MIN(title) AS title, COUNT(*)::int AS count
    FROM current_steps
    GROUP BY "order"
    ORDER BY "order" ASC
  `;

  const doneCountQueryText = `
    WITH filtered AS (
      SELECT DISTINCT p.id AS pid
      FROM processes p
      INNER JOIN clients c ON c.id = p.client_id
      LEFT JOIN process_steps s ON s.process_id = p.id
      WHERE ${baseWhere}${stepFilter}
    )
    SELECT COUNT(*)::int AS cnt
    FROM filtered f
    WHERE NOT EXISTS (
      SELECT 1 FROM process_steps s
      WHERE s.process_id = f.pid AND s.status IN ('in_progress', 'pending')
    )
  `;

  const [stageResult, doneResult] = await Promise.all([
    db.execute<{ order: number; title: string; count: number }>(sql.raw(stageQueryText)),
    db.execute<{ cnt: number }>(sql.raw(doneCountQueryText)),
  ]);

  const byOrder = new Map<number, StageSummaryItem>();
  for (const row of stageResult.rows) {
    byOrder.set(row.order, {
      order: row.order,
      title: row.title ?? "",
      count: row.count ?? 0,
    });
  }

  const stageSummary = LLC_STEPS_TEMPLATE.map((step) => ({
    order: step.order,
    title: step.title,
    count: byOrder.get(step.order)?.count ?? 0,
  }));

  const doneCount = doneResult.rows[0]?.cnt ?? 0;

  return { stageSummary, doneCount };
}

export async function getProcessById(id: string): Promise<{
  process: ProcessListItem | null;
  steps: {
    id: string;
    order: number;
    title: string;
    assignee: string | null;
    department: string | null;
    status: "pending" | "in_progress" | "done";
    doneAt: string | null;
    updatedAt: string;
  }[];
}> {
  const [row] = await db
    .select({
      id: processes.id,
      clientId: processes.clientId,
      kind: processes.kind,
      status: processes.status,
      createdAt: processes.createdAt,
      updatedAt: processes.updatedAt,
      companyName: clients.companyName,
      paymentDate: clients.paymentDate,
    })
    .from(processes)
    .innerJoin(clients, eq(processes.clientId, clients.id))
    .where(eq(processes.id, id))
    .limit(1);

  if (!row) {
    return { process: null, steps: [] };
  }

  const stepRows = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.processId, id))
    .orderBy(processSteps.order);

  const totalSteps = stepRows.length;
  const doneSteps = stepRows.filter((s) => s.status === "done").length;
  const inProgressSteps = stepRows.filter((s) => s.status === "in_progress").length;
  const pendingSteps = stepRows.filter((s) => s.status === "pending").length;

  const progressPct =
    totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  const derivedStatus = computeProcessStatusFromCounts({
    total: totalSteps,
    done: doneSteps,
    inProgress: inProgressSteps,
  });

  const process: ProcessListItem = {
    id: row.id,
    clientId: row.clientId,
    companyName: row.companyName,
    kind: row.kind,
    status: derivedStatus,
    totalSteps,
    doneSteps,
    inProgressSteps,
    pendingSteps,
    progressPct,
    paymentDate:
      row.paymentDate != null
        ? typeof row.paymentDate === "string"
          ? row.paymentDate.slice(0, 10)
          : (row.paymentDate as Date).toISOString().slice(0, 10)
        : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  const steps = stepRows.map((s) => ({
    id: s.id,
    order: s.order,
    title: s.title,
    assignee: s.assignee,
    department: s.department,
    status: s.status,
    doneAt: s.doneAt ? s.doneAt.toISOString() : null,
    updatedAt: s.updatedAt.toISOString(),
  }));

  return { process, steps };
}

export async function createProcessWithTemplate(
  input: CreateProcessInput
): Promise<{ id: string }> {
  const { clientId, lineItemId, kind } = input;

  // Unicidade: 1 processo por (clientId, kind) — regra de negócio + constraint DB
  const existingByClientKind = await db
    .select({ id: processes.id })
    .from(processes)
    .where(
      and(eq(processes.clientId, clientId), eq(processes.kind, kind))
    )
    .limit(1);

  if (existingByClientKind.length > 0) {
    const err: Error & { code?: string; existingProcessId?: string } =
      new Error("Já existe um processo para este cliente e tipo");
    err.code = "PROCESS_DUPLICATE";
    err.existingProcessId = existingByClientKind[0]!.id;
    throw err;
  }

  // Se lineItemId for fornecido, validar que pertence ao cliente (e para LLC_PROCESS, que é LLC)
  const resolvedLineItemId: string | null = lineItemId ?? null;
  if (lineItemId) {
    const [item] = await db
      .select({
        id: clientLineItems.id,
        clientId: clientLineItems.clientId,
        kind: clientLineItems.kind,
      })
      .from(clientLineItems)
      .where(eq(clientLineItems.id, lineItemId))
      .limit(1);

    if (!item) {
      const err: Error & { code?: string } = new Error("Line item não encontrado para este cliente");
      err.code = "LINE_ITEM_NOT_FOUND";
      throw err;
    }
    if (item.clientId !== clientId) {
      const err: Error & { code?: string } = new Error("Line item não pertence ao cliente informado");
      err.code = "LINE_ITEM_CLIENT_MISMATCH";
      throw err;
    }
    if (kind === "LLC_PROCESS" && item.kind !== "LLC") {
      const err: Error & { code?: string } = new Error("LLC_PROCESS só pode ser criado para line items do tipo LLC");
      err.code = "INVALID_LINE_ITEM_KIND";
      throw err;
    }
  }

  const [created] = await db
    .insert(processes)
    .values({
      clientId,
      lineItemId: resolvedLineItemId,
      kind,
      status: "open",
    })
    .returning({ id: processes.id });

  const processId = created.id;

  if (kind === "LLC_PROCESS") {
    await db.insert(processSteps).values(
      LLC_STEPS_TEMPLATE.map((step) => ({
        processId,
        order: step.order,
        title: step.title,
        assignee: step.assignee,
        department: step.department,
        status: "pending" as const,
        expectedDays: step.expectedDays,
      }))
    );
  }

  return { id: processId };
}

export async function updateStepStatus({
  processId,
  stepId,
  status,
}: {
  processId: string;
  stepId: string;
  status: UpdateStepStatusInput["status"];
}): Promise<{
  ok: boolean;
  process: ProcessListItem | null;
}> {
  return db.transaction(async (tx) => {
    const [step] = await tx
      .select()
      .from(processSteps)
      .where(and(eq(processSteps.id, stepId), eq(processSteps.processId, processId)))
      .limit(1);

    if (!step) {
      return { ok: false, process: null };
    }

    const now = new Date();
    const setDoneAt =
      status === "done"
        ? now
        : step.status === "done"
          ? null
          : step.doneAt;

    const setStartedAt =
      status === "in_progress" && step.startedAt == null ? now : step.startedAt;

    await tx
      .update(processSteps)
      .set({
        status,
        doneAt: setDoneAt,
        startedAt: setStartedAt,
        updatedAt: now,
      })
      .where(eq(processSteps.id, stepId));

    const updatedSteps = await tx
      .select()
      .from(processSteps)
      .where(eq(processSteps.processId, processId));

    const totalSteps = updatedSteps.length;
    const doneSteps = updatedSteps.filter((s) => s.status === "done").length;
    const inProgressSteps = updatedSteps.filter(
      (s) => s.status === "in_progress"
    ).length;
    const pendingSteps = updatedSteps.filter(
      (s) => s.status === "pending"
    ).length;

    const processStatus = computeProcessStatusFromCounts({
      total: totalSteps,
      done: doneSteps,
      inProgress: inProgressSteps,
    });

    const [proc] = await tx
      .update(processes)
      .set({
        status: processStatus,
        updatedAt: now,
      })
      .where(eq(processes.id, processId))
      .returning();

    const [clientRow] = await tx
      .select({ companyName: clients.companyName, paymentDate: clients.paymentDate })
      .from(clients)
      .where(eq(clients.id, proc.clientId))
      .limit(1);

    const progressPct =
      totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

    const process: ProcessListItem = {
      id: proc.id,
      clientId: proc.clientId,
      companyName: clientRow?.companyName ?? null,
      kind: proc.kind,
      status: processStatus,
      totalSteps,
      doneSteps,
      inProgressSteps,
      pendingSteps,
      progressPct,
      paymentDate:
        clientRow?.paymentDate != null
          ? typeof clientRow.paymentDate === "string"
            ? clientRow.paymentDate.slice(0, 10)
            : (clientRow.paymentDate as Date).toISOString().slice(0, 10)
          : null,
      createdAt: proc.createdAt.toISOString(),
      updatedAt: proc.updatedAt.toISOString(),
    };

    return { ok: true, process };
  });
}


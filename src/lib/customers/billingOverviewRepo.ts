import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getCustomerById } from "@/lib/customers/repo";

/** Empresas vinculadas ao customer (is_payer=true, customer_id=customerId). */
const PAYER_CLIENTS_CTE = (customerId: string) => sql`
  payer_clients AS (
    SELECT DISTINCT cl.id AS client_id
    FROM client_partners p
    INNER JOIN clients cl ON cl.id = p.client_id AND cl.deleted_at IS NULL
    WHERE p.is_payer = true AND p.customer_id = ${customerId}
  )
`;

export type CustomerBillingOverviewTotals = {
  billedCents: number;
  paidCents: number;
  openCents: number;
  paidPct: number;
  overdueCents: number;
  overdueCount: number;
  nextDueAt: string | null;
  nextDueCents: number | null;
};

export type CustomerBillingOverviewBreakdown = {
  byStatus: Array<{
    status: string;
    count: number;
    totalCents: number;
    paidCents: number;
  }>;
};

export type CustomerBillingOverviewFilters = {
  dueFrom?: string;
  dueTo?: string;
  createdFrom?: string;
  createdTo?: string;
};

export type CustomerBillingOverview = {
  totals: CustomerBillingOverviewTotals;
  breakdown: CustomerBillingOverviewBreakdown;
};

/**
 * Retorna métricas de cobrança do cliente pagador (charges das empresas onde é payer).
 * paidCents: quando status = 'paid' considera amount_cents (modelo não tem paid_cents parcial).
 * overdue: due_date < hoje E status NOT IN ('paid','canceled').
 * nextDueAt/nextDueCents: próxima charge com due_date >= hoje e status pendente/overdue.
 */
export async function getCustomerBillingOverview(
  customerId: string,
  filters?: CustomerBillingOverviewFilters
): Promise<CustomerBillingOverview | null> {
  const customer = await getCustomerById(customerId);
  if (!customer) return null;

  const dueFrom = filters?.dueFrom?.trim();
  const dueTo = filters?.dueTo?.trim();
  const createdFrom = filters?.createdFrom?.trim();
  const createdTo = filters?.createdTo?.trim();

  const conditions: ReturnType<typeof sql>[] = [];
  if (dueFrom) conditions.push(sql`bc.due_date >= ${dueFrom}::date`);
  if (dueTo) conditions.push(sql`bc.due_date <= ${dueTo}::date`);
  if (createdFrom) conditions.push(sql`bc.created_at >= ${createdFrom}::timestamp`);
  if (createdTo) conditions.push(sql`bc.created_at <= ${createdTo}::timestamp`);
  const filterClause =
    conditions.length > 0 ? sql` AND ${sql.join(conditions, sql` AND `)}` : sql``;

  const nextDueConditions: ReturnType<typeof sql>[] = [];
  if (dueFrom) nextDueConditions.push(sql`bc2.due_date >= ${dueFrom}::date`);
  if (dueTo) nextDueConditions.push(sql`bc2.due_date <= ${dueTo}::date`);
  if (createdFrom) nextDueConditions.push(sql`bc2.created_at >= ${createdFrom}::timestamp`);
  if (createdTo) nextDueConditions.push(sql`bc2.created_at <= ${createdTo}::timestamp`);
  const nextDueFilter =
    nextDueConditions.length > 0 ? sql` AND ${sql.join(nextDueConditions, sql` AND `)}` : sql``;

  type TotalsRow = {
    billed_cents: string;
    paid_cents: string;
    open_cents: string;
    overdue_cents: string;
    overdue_count: string;
    next_due_at: string | null;
    next_due_cents: string | null;
  };
  type ByStatusRow = { status: string; cnt: string; total_cents: string; paid_cents: string };

  const [totalsResult, byStatusResult] = await Promise.all([
    db.execute<TotalsRow>(sql`
      WITH ${PAYER_CLIENTS_CTE(customerId)}
      SELECT
        COALESCE(SUM(bc.amount_cents), 0)::bigint AS billed_cents,
        COALESCE(SUM(CASE WHEN bc.status = 'paid' THEN bc.amount_cents ELSE 0 END), 0)::bigint AS paid_cents,
        COALESCE(SUM(CASE WHEN bc.status NOT IN ('paid', 'canceled') THEN bc.amount_cents ELSE 0 END), 0)::bigint AS open_cents,
        COALESCE(SUM(CASE WHEN bc.due_date < CURRENT_DATE AND bc.status NOT IN ('paid', 'canceled') THEN bc.amount_cents ELSE 0 END), 0)::bigint AS overdue_cents,
        COUNT(CASE WHEN bc.due_date < CURRENT_DATE AND bc.status NOT IN ('paid', 'canceled') THEN 1 END)::int AS overdue_count,
        (SELECT bc2.due_date::text FROM billing_charges bc2
         INNER JOIN payer_clients pc ON pc.client_id = bc2.client_id
         WHERE bc2.due_date >= CURRENT_DATE AND bc2.status NOT IN ('paid', 'canceled')
         ${nextDueFilter}
         ORDER BY bc2.due_date ASC
         LIMIT 1) AS next_due_at,
        (SELECT bc2.amount_cents FROM billing_charges bc2
         INNER JOIN payer_clients pc ON pc.client_id = bc2.client_id
         WHERE bc2.due_date >= CURRENT_DATE AND bc2.status NOT IN ('paid', 'canceled')
         ${nextDueFilter}
         ORDER BY bc2.due_date ASC
         LIMIT 1) AS next_due_cents
      FROM payer_clients pc
      INNER JOIN billing_charges bc ON bc.client_id = pc.client_id
      WHERE 1=1
      ${filterClause}
    `),
    db.execute<ByStatusRow>(sql`
      WITH ${PAYER_CLIENTS_CTE(customerId)}
      SELECT bc.status,
             COUNT(bc.id)::int AS cnt,
             COALESCE(SUM(bc.amount_cents), 0)::bigint AS total_cents,
             COALESCE(SUM(CASE WHEN bc.status = 'paid' THEN bc.amount_cents ELSE 0 END), 0)::bigint AS paid_cents
      FROM payer_clients pc
      INNER JOIN billing_charges bc ON bc.client_id = pc.client_id
      WHERE 1=1
      ${filterClause}
      GROUP BY bc.status
      ORDER BY total_cents DESC
    `),
  ]);

  const tr = (totalsResult.rows?.[0] ?? null) as TotalsRow | null;
  const billedCents = tr ? Number(tr.billed_cents) : 0;
  const paidCents = tr ? Number(tr.paid_cents) : 0;
  const openCents = tr ? Number(tr.open_cents) : 0;
  const paidPct = billedCents > 0 ? paidCents / billedCents : 0;
  const overdueCents = tr ? Number(tr.overdue_cents) : 0;
  const overdueCount = tr ? Number(tr.overdue_count) : 0;
  const nextDueAt = tr?.next_due_at ?? null;
  const nextDueCents = tr?.next_due_cents != null ? Number(tr.next_due_cents) : null;

  const byStatus = ((byStatusResult.rows ?? []) as ByStatusRow[]).map((r) => ({
    status: r.status,
    count: Number(r.cnt),
    totalCents: Number(r.total_cents),
    paidCents: Number(r.paid_cents),
  }));

  return {
    totals: {
      billedCents,
      paidCents,
      openCents,
      paidPct,
      overdueCents,
      overdueCount,
      nextDueAt,
      nextDueCents,
    },
    breakdown: { byStatus },
  };
}

export type CustomerChargeItem = {
  chargeId: string;
  companyId: string;
  companyName: string;
  companyCode: string | null;
  status: string;
  amountCents: number;
  paidCents: number | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  gateway: string | null;
  method: string | null;
};

export type ListCustomerChargesParams = {
  customerId: string;
  page: number;
  limit: number;
  q?: string;
  status?: string;
  dueFrom?: string;
  dueTo?: string;
  paidFrom?: string;
  paidTo?: string;
  minValue?: number;
  maxValue?: number;
  companyId?: string;
  sort?: "dueDate_desc" | "dueDate_asc" | "value_desc" | "value_asc" | "createdAt_desc" | "createdAt_asc";
};

const CHARGES_SORT_MAP = {
  dueDate_desc: sql`bc.due_date DESC NULLS LAST, bc.created_at DESC`,
  dueDate_asc: sql`bc.due_date ASC NULLS LAST, bc.created_at ASC`,
  value_desc: sql`bc.amount_cents DESC, bc.due_date DESC NULLS LAST`,
  value_asc: sql`bc.amount_cents ASC, bc.due_date ASC NULLS LAST`,
  createdAt_desc: sql`bc.created_at DESC, bc.id DESC`,
  createdAt_asc: sql`bc.created_at ASC, bc.id ASC`,
} as const;

/**
 * Lista cobranças das empresas do customer (pagador) com filtros e paginação server-side.
 * paidCents: amount_cents quando status='paid', senão 0 (sem pagamento parcial no modelo).
 */
export async function listCustomerCharges(
  params: ListCustomerChargesParams
): Promise<{
  items: CustomerChargeItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    customerId,
    page,
    limit,
    q,
    status,
    dueFrom,
    dueTo,
    paidFrom,
    paidTo,
    minValue,
    maxValue,
    companyId,
    sort = "dueDate_desc",
  } = params;
  const offset = (page - 1) * limit;

  const baseFrom = sql`
    FROM payer_clients pc
    INNER JOIN billing_charges bc ON bc.client_id = pc.client_id
    INNER JOIN clients cl ON cl.id = pc.client_id AND cl.deleted_at IS NULL
    WHERE 1=1
  `;

  const conditions: ReturnType<typeof sql>[] = [];
  if (q && q.trim()) {
    const pattern = `%${q.trim().replace(/%/g, "\\%")}%`;
    conditions.push(
      sql`(cl.company_name ILIKE ${pattern} OR cl.customer_code ILIKE ${pattern} OR bc.id::text ILIKE ${pattern})`
    );
  }
  if (status && status.trim()) {
    conditions.push(sql`bc.status = ${status.trim()}`);
  }
  if (dueFrom) conditions.push(sql`bc.due_date >= ${dueFrom}::date`);
  if (dueTo) conditions.push(sql`bc.due_date <= ${dueTo}::date`);
  if (paidFrom) conditions.push(sql`bc.paid_at >= ${paidFrom}::timestamp`);
  if (paidTo) conditions.push(sql`bc.paid_at <= ${paidTo}::timestamp`);
  if (minValue != null && Number.isFinite(minValue)) {
    conditions.push(sql`bc.amount_cents >= ${Math.round(minValue)}`);
  }
  if (maxValue != null && Number.isFinite(maxValue)) {
    conditions.push(sql`bc.amount_cents <= ${Math.round(maxValue)}`);
  }
  if (companyId && companyId.trim()) {
    conditions.push(sql`cl.id = ${companyId.trim()}`);
  }

  const whereClause =
    conditions.length > 0 ? sql` AND ${sql.join(conditions, sql` AND `)}` : sql``;
  const orderBy = CHARGES_SORT_MAP[sort] ?? CHARGES_SORT_MAP.dueDate_desc;

  type Row = {
    charge_id: string;
    company_id: string;
    company_name: string;
    customer_code: string | null;
    status: string;
    amount_cents: number;
    due_date: string | null;
    paid_at: string | null;
    created_at: string;
    provider: string | null;
    paid_method: string | null;
  };

  const [countResult, listResult] = await Promise.all([
    db.execute<{ total: string }>(sql`
      WITH ${PAYER_CLIENTS_CTE(customerId)}
      SELECT COUNT(*)::int AS total
      ${baseFrom}
      ${whereClause}
    `),
    db.execute<Row>(sql`
      WITH ${PAYER_CLIENTS_CTE(customerId)}
      SELECT bc.id AS charge_id, cl.id AS company_id, cl.company_name, cl.customer_code,
             bc.status, bc.amount_cents, bc.due_date::text, bc.paid_at::text,
             bc.created_at::text, bc.provider, bc.paid_method
      ${baseFrom}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `),
  ]);

  const total = Number((countResult.rows?.[0] as { total: number })?.total ?? 0);
  const rows = (listResult.rows ?? []) as Row[];
  const items: CustomerChargeItem[] = rows.map((r) => ({
    chargeId: r.charge_id,
    companyId: r.company_id,
    companyName: r.company_name,
    companyCode: r.customer_code ?? null,
    status: r.status,
    amountCents: Number(r.amount_cents),
    paidCents: r.status === "paid" ? Number(r.amount_cents) : null,
    dueDate: r.due_date ?? null,
    paidAt: r.paid_at ?? null,
    createdAt: r.created_at,
    gateway: r.provider ?? null,
    method: r.paid_method ?? null,
  }));

  return { items, total, page, limit };
}

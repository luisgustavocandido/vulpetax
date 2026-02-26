import { sql } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Empresas vinculadas ao customer (is_payer=true, customer_id=customerId). */
const PAYER_CLIENTS_CTE = (customerId: string) => sql`
  payer_clients AS (
    SELECT DISTINCT cl.id AS client_id
    FROM client_partners p
    INNER JOIN clients cl ON cl.id = p.client_id AND cl.deleted_at IS NULL
    WHERE p.is_payer = true AND p.customer_id = ${customerId}
  )
`;

export type CustomerOverviewCustomer = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
};

export type CustomerOverviewTotals = {
  companies: number;
  services: number;
  totalSpentCents: number;
  avgTicketCents: number;
  lastServiceAt: string | null;
  lastServiceDescription: string | null;
};

export type CustomerOverviewBreakdown = {
  byKind: Array<{ kind: string; count: number; totalCents: number }>;
  byCompany: Array<{
    companyId: string;
    companyName: string;
    count: number;
    totalCents: number;
  }>;
};

export type CustomerOverview = {
  customer: CustomerOverviewCustomer;
  totals: CustomerOverviewTotals;
  breakdown: CustomerOverviewBreakdown;
};

/**
 * Retorna visão completa do cliente pagador: dados, totais e breakdown.
 * Totais e breakdown consideram apenas line_items das empresas onde o customer é pagador.
 */
export async function getCustomerOverview(
  customerId: string
): Promise<CustomerOverview | null> {
  const [customerRow] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customerRow) return null;

  type TotalsRow = {
    companies: string;
    services: string;
    total_spent_cents: string;
    last_sale_date: string | null;
    last_description: string | null;
  };
  type ByKindRow = { kind: string; cnt: string; total_cents: string };
  type ByCompanyRow = {
    company_id: string;
    company_name: string;
    cnt: string;
    total_cents: string;
  };

  const [totalsResult, byKindResult, byCompanyResult] = await Promise.all([
    db.execute<TotalsRow>(sql`
      WITH ${PAYER_CLIENTS_CTE(customerId)}
      SELECT
        (SELECT COUNT(*)::int FROM payer_clients) AS companies,
        (SELECT COALESCE(COUNT(li.id), 0)::bigint FROM payer_clients pc
         INNER JOIN client_line_items li ON li.client_id = pc.client_id) AS services,
        (SELECT COALESCE(SUM(li.value_cents), 0)::bigint FROM payer_clients pc
         INNER JOIN client_line_items li ON li.client_id = pc.client_id) AS total_spent_cents,
        (SELECT MAX(li.sale_date)::text FROM payer_clients pc
         INNER JOIN client_line_items li ON li.client_id = pc.client_id) AS last_sale_date,
        (SELECT li2.description FROM client_line_items li2
         INNER JOIN payer_clients pc ON pc.client_id = li2.client_id
         ORDER BY li2.sale_date DESC NULLS LAST, li2.created_at DESC
         LIMIT 1) AS last_description
    `),
    db.execute<ByKindRow>(sql`
      WITH ${PAYER_CLIENTS_CTE(customerId)}
      SELECT li.kind, COUNT(li.id)::int AS cnt, COALESCE(SUM(li.value_cents), 0)::int AS total_cents
      FROM payer_clients pc
      INNER JOIN client_line_items li ON li.client_id = pc.client_id
      GROUP BY li.kind
      ORDER BY total_cents DESC
    `),
    db.execute<ByCompanyRow>(sql`
      WITH ${PAYER_CLIENTS_CTE(customerId)}
      SELECT cl.id AS company_id, cl.company_name AS company_name,
             COUNT(li.id)::int AS cnt, COALESCE(SUM(li.value_cents), 0)::int AS total_cents
      FROM payer_clients pc
      INNER JOIN clients cl ON cl.id = pc.client_id
      LEFT JOIN client_line_items li ON li.client_id = cl.id
      GROUP BY cl.id, cl.company_name
      ORDER BY total_cents DESC
    `),
  ]);

  const tr = (totalsResult.rows?.[0] ?? null) as TotalsRow | null;
  const companiesCount = tr ? Number(tr.companies) : 0;
  const services = tr ? Number(tr.services) : 0;
  const totalSpentCents = tr ? Number(tr.total_spent_cents) : 0;
  const avgTicketCents = services > 0 ? Math.round(totalSpentCents / services) : 0;
  const lastServiceAt = tr?.last_sale_date ?? null;
  const lastServiceDescription = tr?.last_description ?? null;

  const byKind = ((byKindResult.rows ?? []) as ByKindRow[]).map((r) => ({
    kind: r.kind,
    count: Number(r.cnt),
    totalCents: Number(r.total_cents),
  }));
  const byCompany = ((byCompanyResult.rows ?? []) as ByCompanyRow[]).map((r) => ({
    companyId: r.company_id,
    companyName: r.company_name,
    count: Number(r.cnt),
    totalCents: Number(r.total_cents),
  }));

  return {
    customer: {
      id: customerRow.id,
      fullName: customerRow.fullName,
      email: customerRow.email,
      phone: customerRow.phone ?? null,
      addressLine1: customerRow.addressLine1,
      addressLine2: customerRow.addressLine2 ?? null,
      city: customerRow.city,
      stateProvince: customerRow.stateProvince,
      postalCode: customerRow.postalCode,
      country: customerRow.country,
    },
    totals: {
      companies: companiesCount,
      services,
      totalSpentCents,
      avgTicketCents,
      lastServiceAt,
      lastServiceDescription,
    },
    breakdown: { byKind, byCompany },
  };
}

export type CustomerCompanyItem = {
  id: string;
  companyName: string;
  code: string;
  paymentDate: string | null;
  updatedAt: string | null;
};

export type ListCustomerCompaniesParams = {
  customerId: string;
  page: number;
  limit: number;
  q?: string;
  sort?: "name_asc" | "name_desc" | "recent";
};

/**
 * Lista empresas vinculadas ao customer (pagador) com paginação e busca server-side.
 */
export async function listCustomerCompanies(
  params: ListCustomerCompaniesParams
): Promise<{
  items: CustomerCompanyItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const { customerId, page, limit, q, sort = "name_asc" } = params;
  const offset = (page - 1) * limit;
  const term = (q ?? "").trim();
  const pattern = term ? `%${term.replace(/%/g, "\\%")}%` : null;

  const baseFrom = sql`
    FROM client_partners p
    INNER JOIN clients cl ON cl.id = p.client_id AND cl.deleted_at IS NULL
    WHERE p.is_payer = true AND p.customer_id = ${customerId}
  `;
  const qFilter = pattern
    ? sql` AND (cl.company_name ILIKE ${pattern} OR cl.customer_code ILIKE ${pattern})`
    : sql``;

  const orderBy =
    sort === "name_desc"
      ? sql`cl.company_name DESC NULLS LAST`
      : sort === "recent"
        ? sql`cl.updated_at DESC NULLS LAST`
        : sql`cl.company_name ASC NULLS LAST`;

  type Row = {
    id: string;
    company_name: string;
    customer_code: string;
    payment_date: string | null;
    updated_at: string | null;
  };

  const [countResult, listResult] = await Promise.all([
    db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::int AS count ${baseFrom} ${qFilter}`
    ),
    db.execute<Row>(sql`
      SELECT cl.id, cl.company_name, cl.customer_code, cl.payment_date::text, cl.updated_at::text
      ${baseFrom}
      ${qFilter}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `),
  ]);

  const total = Number((countResult.rows?.[0] as { count: number })?.count ?? 0);
  const rows = (listResult.rows ?? []) as Row[];
  const items: CustomerCompanyItem[] = rows.map((r) => ({
    id: r.id,
    companyName: r.company_name,
    code: r.customer_code,
    paymentDate: r.payment_date ?? null,
    updatedAt: r.updated_at ?? null,
  }));

  return { items, total, page, limit };
}

export type CustomerServiceItem = {
  lineItemId: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  kind: string;
  llcCategory: string | null;
  llcState: string | null;
  billingPeriod: string | null;
  addressProvider: string | null;
  valueCents: number;
  saleDate: string | null;
  commercial: string | null;
  sdr: string | null;
  description: string;
};

export type ListCustomerServicesParams = {
  customerId: string;
  page: number;
  limit: number;
  q?: string;
  kind?: string;
  state?: string;
  saleFrom?: string;
  saleTo?: string;
  minValue?: number;
  maxValue?: number;
  companyId?: string;
  sort?: "saleDate_desc" | "saleDate_asc" | "value_desc" | "value_asc";
};

const SERVICES_SORT_MAP = {
  saleDate_desc: sql`li.sale_date DESC NULLS LAST, li.created_at DESC`,
  saleDate_asc: sql`li.sale_date ASC NULLS LAST, li.created_at ASC`,
  value_desc: sql`li.value_cents DESC, li.sale_date DESC NULLS LAST`,
  value_asc: sql`li.value_cents ASC, li.sale_date ASC NULLS LAST`,
} as const;

/**
 * Lista todos os serviços (line_items) das empresas vinculadas ao customer, com filtros e paginação server-side.
 */
export async function listCustomerServices(
  params: ListCustomerServicesParams
): Promise<{
  items: CustomerServiceItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    customerId,
    page,
    limit,
    q,
    kind,
    state,
    saleFrom,
    saleTo,
    minValue,
    maxValue,
    companyId,
    sort = "saleDate_desc",
  } = params;
  const offset = (page - 1) * limit;

  const baseFrom = sql`
    FROM payer_clients pc
    INNER JOIN client_line_items li ON li.client_id = pc.client_id
    INNER JOIN clients cl ON cl.id = pc.client_id AND cl.deleted_at IS NULL
    WHERE 1=1
  `;

  const conditions: ReturnType<typeof sql>[] = [];
  if (q && q.trim()) {
    const pattern = `%${q.trim().replace(/%/g, "\\%")}%`;
    conditions.push(
      sql`(cl.company_name ILIKE ${pattern} OR cl.customer_code ILIKE ${pattern} OR li.kind ILIKE ${pattern} OR li.description ILIKE ${pattern})`
    );
  }
  if (kind && kind.trim()) {
    conditions.push(sql`li.kind = ${kind.trim()}`);
  }
  if (state && state.trim()) {
    conditions.push(sql`li.llc_state = ${state.trim().toUpperCase().slice(0, 2)}`);
  }
  if (saleFrom) {
    conditions.push(sql`li.sale_date >= ${saleFrom}::date`);
  }
  if (saleTo) {
    conditions.push(sql`li.sale_date <= ${saleTo}::date`);
  }
  if (minValue != null && Number.isFinite(minValue)) {
    conditions.push(sql`li.value_cents >= ${Math.round(minValue)}`);
  }
  if (maxValue != null && Number.isFinite(maxValue)) {
    conditions.push(sql`li.value_cents <= ${Math.round(maxValue)}`);
  }
  if (companyId && companyId.trim()) {
    conditions.push(sql`cl.id = ${companyId.trim()}`);
  }

  const whereClause =
    conditions.length > 0 ? sql` AND ${sql.join(conditions, sql` AND `)}` : sql``;

  const orderBy = SERVICES_SORT_MAP[sort] ?? SERVICES_SORT_MAP.saleDate_desc;

  type Row = {
    line_item_id: string;
    company_id: string;
    company_name: string;
    customer_code: string;
    kind: string;
    llc_category: string | null;
    llc_state: string | null;
    billing_period: string | null;
    address_provider: string | null;
    value_cents: number;
    sale_date: string | null;
    commercial: string | null;
    sdr: string | null;
    description: string;
  };

  const fromWithCte = sql`
    WITH ${PAYER_CLIENTS_CTE(customerId)}
    SELECT li.id AS line_item_id, cl.id AS company_id, cl.company_name, cl.customer_code,
           li.kind, li.llc_category, li.llc_state, li.billing_period, li.address_provider,
           li.value_cents, li.sale_date::text, li.commercial, li.sdr, li.description
    ${baseFrom}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countQuery = sql`
    WITH ${PAYER_CLIENTS_CTE(customerId)}
    SELECT COUNT(*)::int AS total
    ${baseFrom}
    ${whereClause}
  `;

  const [countResult, listResult] = await Promise.all([
    db.execute<{ total: string }>(countQuery),
    db.execute<Row>(fromWithCte),
  ]);

  const total = Number((countResult.rows?.[0] as { total: number })?.total ?? 0);
  const rows = (listResult.rows ?? []) as Row[];
  const items: CustomerServiceItem[] = rows.map((r) => ({
    lineItemId: r.line_item_id,
    companyId: r.company_id,
    companyName: r.company_name,
    companyCode: r.customer_code,
    kind: r.kind,
    llcCategory: r.llc_category ?? null,
    llcState: r.llc_state ?? null,
    billingPeriod: r.billing_period ?? null,
    addressProvider: r.address_provider ?? null,
    valueCents: Number(r.value_cents),
    saleDate: r.sale_date ?? null,
    commercial: r.commercial ?? null,
    sdr: r.sdr ?? null,
    description: r.description ?? "",
  }));

  return { items, total, page, limit };
}

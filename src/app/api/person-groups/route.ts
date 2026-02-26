import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { createPersonGroupSchema } from "@/lib/personGroups/validators";
import { createPersonGroup } from "@/lib/personGroups/repo";

export type PersonGroupItem = {
  personGroupId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  companiesCount: number;
};

const GROUPS_CTE = sql`WITH payer_groups AS (
  SELECT DISTINCT c.person_group_id
  FROM clients c
  INNER JOIN client_partners cp ON cp.client_id = c.id AND cp.is_payer = true
  WHERE c.person_group_id IS NOT NULL AND c.deleted_at IS NULL
),
groups AS (
  SELECT
    c.person_group_id,
    COUNT(*)::int AS companies_count,
    (array_agg(c.id ORDER BY c.updated_at DESC))[1] AS rep_client_id
  FROM clients c
  INNER JOIN payer_groups pg ON pg.person_group_id = c.person_group_id
  WHERE c.deleted_at IS NULL
  GROUP BY c.person_group_id
)`;

const REP_PARTNER_CTE = sql`, rep_client AS (
  SELECT g.person_group_id, g.companies_count, g.rep_client_id,
    c.company_name AS rep_company_name,
    c.email AS client_email
  FROM groups g
  JOIN clients c ON c.id = g.rep_client_id
),
with_partner AS (
  SELECT r.person_group_id, r.companies_count,
    COALESCE(cp.full_name, r.rep_company_name) AS display_name,
    COALESCE(cp.email, r.client_email) AS email,
    cp.phone AS phone
  FROM rep_client r
  LEFT JOIN client_partners cp ON cp.client_id = r.rep_client_id AND cp.role = 'SocioPrincipal'
),
with_pg AS (
  SELECT
    wp.person_group_id,
    wp.companies_count,
    COALESCE(pg.full_name, wp.display_name) AS display_name,
    COALESCE(pg.email, wp.email) AS email,
    COALESCE(pg.phone, wp.phone) AS phone
  FROM with_partner wp
  LEFT JOIN person_groups pg ON pg.id = wp.person_group_id
)`;

/** Query sem person_groups (fallback quando a tabela ainda não existe). */
const REP_PARTNER_CTE_LEGACY = sql`, rep_client AS (
  SELECT g.person_group_id, g.companies_count, g.rep_client_id,
    c.company_name AS rep_company_name,
    c.email AS client_email
  FROM groups g
  JOIN clients c ON c.id = g.rep_client_id
),
with_partner AS (
  SELECT r.person_group_id, r.companies_count,
    COALESCE(cp.full_name, r.rep_company_name) AS display_name,
    COALESCE(cp.email, r.client_email) AS email,
    cp.phone AS phone
  FROM rep_client r
  LEFT JOIN client_partners cp ON cp.client_id = r.rep_client_id AND cp.role = 'SocioPrincipal'
)`;

/**
 * GET /api/person-groups
 * Lista agrupamentos por personGroupId (pessoas) com contagem de empresas.
 * displayName: sócio principal (SocioPrincipal) ou nome da empresa do cliente mais recente.
 * Query: q (busca por nome/email/empresa), page, limit, sort (displayName|companiesCount, asc|desc).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;
    const q = searchParams.get("q")?.trim() || null;
    const sort = (searchParams.get("sort") || "displayName").toLowerCase();
    const orderAsc = (searchParams.get("order") || "asc").toLowerCase() === "asc";

    const sortColumn =
      sort === "companiescount" || sort === "companies_count"
        ? sql`with_pg.companies_count`
        : sql`with_pg.display_name`;
    const orderDir = orderAsc ? sql`ASC` : sql`DESC`;

    const pattern = q ? `%${q}%` : null;
    const filterFragmentCount =
      pattern !== null
        ? sql`AND wpg.person_group_id IN (
          SELECT c.person_group_id FROM clients c
  LEFT JOIN client_partners cp ON cp.client_id = c.id
  LEFT JOIN person_groups pg2 ON pg2.id = c.person_group_id
  WHERE c.deleted_at IS NULL AND c.person_group_id IS NOT NULL
  AND (c.company_name ILIKE ${pattern} OR c.email ILIKE ${pattern}
    OR cp.full_name ILIKE ${pattern} OR cp.email ILIKE ${pattern}
    OR pg2.full_name ILIKE ${pattern} OR pg2.email ILIKE ${pattern})
        )`
        : sql``;
    const filterFragmentList =
      pattern !== null
        ? sql`AND with_pg.person_group_id IN (
          SELECT c.person_group_id FROM clients c
  LEFT JOIN client_partners cp ON cp.client_id = c.id
  LEFT JOIN person_groups pg2 ON pg2.id = c.person_group_id
  WHERE c.deleted_at IS NULL AND c.person_group_id IS NOT NULL
  AND (c.company_name ILIKE ${pattern} OR c.email ILIKE ${pattern}
    OR cp.full_name ILIKE ${pattern} OR cp.email ILIKE ${pattern}
    OR pg2.full_name ILIKE ${pattern} OR pg2.email ILIKE ${pattern})
        )`
        : sql``;

    const filterFragmentCountLegacy =
      pattern !== null
        ? sql`AND wp.person_group_id IN (
          SELECT c.person_group_id FROM clients c
  LEFT JOIN client_partners cp ON cp.client_id = c.id
  WHERE c.deleted_at IS NULL AND c.person_group_id IS NOT NULL
  AND (c.company_name ILIKE ${pattern} OR c.email ILIKE ${pattern}
    OR cp.full_name ILIKE ${pattern} OR cp.email ILIKE ${pattern})
        )`
        : sql``;
    const filterFragmentListLegacy =
      pattern !== null
        ? sql`AND with_partner.person_group_id IN (
          SELECT c.person_group_id FROM clients c
  LEFT JOIN client_partners cp ON cp.client_id = c.id
  WHERE c.deleted_at IS NULL AND c.person_group_id IS NOT NULL
  AND (c.company_name ILIKE ${pattern} OR c.email ILIKE ${pattern}
    OR cp.full_name ILIKE ${pattern} OR cp.email ILIKE ${pattern})
        )`
        : sql``;

    const sortColumnLegacy =
      sort === "companiescount" || sort === "companies_count"
        ? sql`with_partner.companies_count`
        : sql`with_partner.display_name`;

    type Row = { personGroupId: string; displayName: string | null; email: string | null; phone: string | null; companiesCount: number };

    let total: number;
    let listRows: Row[];

    try {
      const countResult = await db.execute<{ total: number }>(sql`
        ${GROUPS_CTE}
        ${REP_PARTNER_CTE}
        SELECT COUNT(*)::int AS total FROM with_pg wpg WHERE 1=1 ${filterFragmentCount}
      `);
      total = Number(countResult.rows[0]?.total ?? 0);

      const listResult = await db.execute<Row>(sql`
        ${GROUPS_CTE}
        ${REP_PARTNER_CTE}
        SELECT
          with_pg.person_group_id AS "personGroupId",
          with_pg.display_name AS "displayName",
          with_pg.email,
          with_pg.phone,
          with_pg.companies_count AS "companiesCount"
        FROM with_pg
        WHERE 1=1 ${filterFragmentList}
        ORDER BY ${sortColumn} ${orderDir} NULLS LAST, with_pg.person_group_id ASC
        LIMIT ${limit} OFFSET ${offset}
      `);
      listRows = listResult.rows ?? [];
    } catch (err: unknown) {
      const e = err as { code?: string; cause?: { code?: string; message?: string }; message?: string };
      const code = e?.cause?.code ?? e?.code;
      const msg = String(e?.cause?.message ?? e?.message ?? "");
      if (code === "42P01" || msg.includes("person_groups") && msg.includes("does not exist")) {
        const countResult = await db.execute<{ total: number }>(sql`
          ${GROUPS_CTE}
          ${REP_PARTNER_CTE_LEGACY}
          SELECT COUNT(*)::int AS total FROM with_partner wp WHERE 1=1 ${filterFragmentCountLegacy}
        `);
        total = Number(countResult.rows[0]?.total ?? 0);
        const listResult = await db.execute<Row>(sql`
          ${GROUPS_CTE}
          ${REP_PARTNER_CTE_LEGACY}
          SELECT
            with_partner.person_group_id AS "personGroupId",
            with_partner.display_name AS "displayName",
            with_partner.email,
            with_partner.phone,
            with_partner.companies_count AS "companiesCount"
          FROM with_partner
          WHERE 1=1 ${filterFragmentListLegacy}
          ORDER BY ${sortColumnLegacy} ${orderDir} NULLS LAST, with_partner.person_group_id ASC
          LIMIT ${limit} OFFSET ${offset}
        `);
        listRows = listResult.rows ?? [];
      } else {
        throw err;
      }
    }

    const items: PersonGroupItem[] = listRows.map((row: Row) => ({
      personGroupId: row.personGroupId,
      displayName: row.displayName ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      companiesCount: Number(row.companiesCount ?? 0),
    }));

    return NextResponse.json({
      items,
      pagination: { page, limit, total },
    });
  } catch (err) {
    console.error("[GET /api/person-groups]", err);
    return NextResponse.json(
      { error: "Erro ao listar grupos de pessoas" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/person-groups
 * Cadastra uma pessoa (person_group) apenas com dados pessoais. Vínculo com empresa é feito em outro fluxo.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido (JSON esperado)" },
      { status: 400 }
    );
  }

  const parsed = createPersonGroupSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const message = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? "Payload inválido";
    return NextResponse.json(
      { error: typeof message === "string" ? message : "Payload inválido", details: flat },
      { status: 400 }
    );
  }

  try {
    const result = await createPersonGroup(parsed.data);
    return NextResponse.json({ personGroupId: result.personGroupId }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/person-groups]", err);
    return NextResponse.json(
      { error: "Erro ao cadastrar pessoa" },
      { status: 500 }
    );
  }
}

import { ilike, or, eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, customers, personGroups } from "@/db/schema";
import { normalizeEmail } from "./normalize";
import type { CreateCustomerInput, UpdateCustomerInput } from "./validators";

export type CustomerLookupItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
};

export type CustomerLookupItemWithSource = CustomerLookupItem & {
  source: "customer" | "person_group";
};

/**
 * Busca clientes pagadores por termo (fullName, email, phone).
 * Garante um único registro por pessoa: dedupe por email (lower/trim), fallback phone (só dígitos), fallback id.
 * Escolhe o registro mais recente (updated_at desc) dentro do mesmo person_key.
 */
export async function lookupCustomers(
  q: string,
  limit: number = 10
): Promise<CustomerLookupItem[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const pattern = `%${term.replace(/%/g, "\\%")}%`;
  const digitsOnly = term.replace(/\D/g, "");
  const hasPhone = digitsOnly.length >= 2;
  const phonePattern = hasPhone ? `%${digitsOnly}%` : null;

  type Row = { id: string; full_name: string; email: string | null; phone: string | null };
  const result = await db.execute<Row>(sql`
    SELECT DISTINCT ON (t.person_key) t.id, t.full_name, t.email, t.phone
    FROM (
      SELECT
        c.id,
        c.full_name,
        c.email,
        c.phone,
        c.updated_at,
        CASE
          WHEN c.email IS NOT NULL AND btrim(c.email) <> '' THEN lower(btrim(c.email))
          WHEN c.phone IS NOT NULL AND btrim(c.phone) <> '' THEN regexp_replace(c.phone, '\D', '', 'g')
          ELSE c.id::text
        END AS person_key
      FROM customers c
      WHERE (c.full_name ILIKE ${pattern}
         OR c.email ILIKE ${pattern}
         OR ${hasPhone ? sql`c.phone ILIKE ${phonePattern}` : sql`false`})
    ) t
    ORDER BY t.person_key, t.updated_at DESC NULLS LAST, t.full_name ASC
    LIMIT ${limit}
  `);

  const rows = (result.rows ?? []) as Row[];
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email ?? null,
    phone: r.phone ?? null,
  }));
}

export type CustomerListItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  country: string | null;
  companiesCount: number;
};

/** Item da lista unificada: clientes pagadores (customer) ou pessoas cadastradas (person_group) sem vínculo. */
export type CustomerListItemWithSource = CustomerListItem & {
  source: "customer" | "person_group";
};

/**
 * Listagem de customers que têm pelo menos uma empresa vinculada como pagador.
 * Uma linha por customer; companiesCount = número de empresas onde é pagador.
 */
export async function listCustomers(params: {
  q?: string;
  page?: number;
  limit?: number;
  sort?: "name_asc" | "name_desc" | "recent";
}): Promise<{ items: CustomerListItem[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = (page - 1) * limit;
  const sort = params.sort ?? "name_asc";
  const term = (params.q ?? "").trim();
  const digitsOnly = term.replace(/\D/g, "");
  const hasPhone = digitsOnly.length >= 2;

  const baseFrom = sql`
    FROM client_partners p
    INNER JOIN customers c ON c.id = p.customer_id
    INNER JOIN clients cl ON cl.id = p.client_id AND cl.deleted_at IS NULL
    WHERE p.is_payer = true
  `;
  const qFilter =
    term.length >= 1
      ? hasPhone
        ? sql` AND (c.full_name ILIKE ${`%${term.replace(/%/g, "\\%")}%`}
          OR c.email ILIKE ${`%${term}%`}
          OR c.phone ILIKE ${`%${digitsOnly}%`})`
        : sql` AND (c.full_name ILIKE ${`%${term.replace(/%/g, "\\%")}%`}
          OR c.email ILIKE ${`%${term}%`})`
      : sql``;

  const orderBy =
    sort === "name_desc"
      ? sql`c.full_name DESC NULLS LAST`
      : sort === "recent"
        ? sql`MAX(cl.updated_at) DESC NULLS LAST`
        : sql`c.full_name ASC NULLS LAST`;

  type Row = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    country: string | null;
    companies_count: string;
  };
  const [countResult, listResult] = await Promise.all([
    db.execute<{ count: string }>(
      sql`SELECT COUNT(DISTINCT c.id)::int AS count ${baseFrom} ${qFilter}`
    ),
    db.execute<Row>(
      sql`
        SELECT c.id, c.full_name, c.email, c.phone, c.address_line1, c.city, c.country,
               COUNT(DISTINCT cl.id)::int AS companies_count
        ${baseFrom}
        ${qFilter}
        GROUP BY c.id, c.full_name, c.email, c.phone, c.address_line1, c.city, c.country
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `
    ),
  ]);

  const total = Number((countResult.rows?.[0] as { count: number } | undefined)?.count ?? 0);
  const rows = (listResult.rows ?? []) as Row[];
  const items: CustomerListItem[] = rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email ?? null,
    phone: r.phone ?? null,
    addressLine1: r.address_line1 ?? null,
    city: r.city ?? null,
    country: r.country ?? null,
    companiesCount: Number(r.companies_count) || 0,
  }));

  return { items, total, page, limit };
}

/**
 * Listagem unificada: clientes pagadores (customers com is_payer) + pessoas cadastradas (person_groups)
 * que ainda não são pagadoras de nenhuma empresa. Assim o cadastro em /clientes/new aparece na lista.
 */
export async function listCustomersWithPersonGroups(params: {
  q?: string;
  page?: number;
  limit?: number;
  sort?: "name_asc" | "name_desc" | "recent";
}): Promise<{
  items: CustomerListItemWithSource[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const offset = (page - 1) * limit;
  const sort = params.sort ?? "name_asc";
  const term = (params.q ?? "").trim();
  const digitsOnly = term.replace(/\D/g, "");
  const hasPhone = digitsOnly.length >= 2;
  const pattern = term.length >= 1 ? `%${term.replace(/%/g, "\\%")}%` : null;
  const phonePattern = hasPhone && term.length >= 1 ? `%${digitsOnly}%` : null;

  const orderDir = sort === "name_desc" || sort === "recent" ? sql`DESC` : sql`ASC`;

  type Row = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    country: string | null;
    companies_count: number;
    source: "customer" | "person_group";
  };

  try {
    const qFilterCustomers =
      pattern !== null
        ? hasPhone
          ? sql` AND (c.full_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone ILIKE ${phonePattern})`
          : sql` AND (c.full_name ILIKE ${pattern} OR c.email ILIKE ${pattern})`
        : sql``;
    const qFilterPg =
      pattern !== null
        ? hasPhone
          ? sql` AND (pg.full_name ILIKE ${pattern} OR pg.email ILIKE ${pattern} OR pg.phone ILIKE ${phonePattern})`
          : sql` AND (pg.full_name ILIKE ${pattern} OR pg.email ILIKE ${pattern})`
        : sql``;

    const countResult = await db.execute<{ total: string }>(sql`
      WITH payer_groups AS (
        SELECT DISTINCT c.person_group_id
        FROM clients c
        INNER JOIN client_partners cp ON cp.client_id = c.id AND cp.is_payer = true
        WHERE c.person_group_id IS NOT NULL AND c.deleted_at IS NULL
      ),
      customers_list AS (
        SELECT c.id FROM client_partners p
        INNER JOIN customers c ON c.id = p.customer_id
        INNER JOIN clients cl ON cl.id = p.client_id AND cl.deleted_at IS NULL
        WHERE p.is_payer = true
        ${qFilterCustomers}
      ),
      pg_orphans AS (
        SELECT pg.id FROM person_groups pg
        WHERE pg.id NOT IN (SELECT person_group_id FROM payer_groups WHERE person_group_id IS NOT NULL)
        ${qFilterPg}
      )
      SELECT (SELECT COUNT(*)::int FROM customers_list) + (SELECT COUNT(*)::int FROM pg_orphans) AS total
    `);
    const total = Number(countResult.rows?.[0]?.total ?? 0);

    const listResult = await db.execute<Row>(sql`
      WITH payer_groups AS (
        SELECT DISTINCT c.person_group_id
        FROM clients c
        INNER JOIN client_partners cp ON cp.client_id = c.id AND cp.is_payer = true
        WHERE c.person_group_id IS NOT NULL AND c.deleted_at IS NULL
      ),
      customers_list AS (
        SELECT c.id, c.full_name, c.email, c.phone, c.address_line1, c.city, c.country,
          COUNT(DISTINCT cl.id)::int AS companies_count
        FROM client_partners p
        INNER JOIN customers c ON c.id = p.customer_id
        INNER JOIN clients cl ON cl.id = p.client_id AND cl.deleted_at IS NULL
        WHERE p.is_payer = true
        ${qFilterCustomers}
        GROUP BY c.id, c.full_name, c.email, c.phone, c.address_line1, c.city, c.country
      ),
      pg_orphans AS (
        SELECT pg.id, pg.full_name, pg.email, pg.phone, pg.address_line1, pg.city, pg.country, 0 AS companies_count
        FROM person_groups pg
        WHERE pg.id NOT IN (SELECT person_group_id FROM payer_groups WHERE person_group_id IS NOT NULL)
        ${qFilterPg}
      ),
      combined AS (
        SELECT id, full_name, email, phone, address_line1, city, country, companies_count, 'customer'::text AS source FROM customers_list
        UNION ALL
        SELECT id, full_name, email, phone, address_line1, city, country, companies_count, 'person_group'::text AS source FROM pg_orphans
      )
      SELECT * FROM combined
      ORDER BY full_name ${orderDir} NULLS LAST, id ASC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const rows = (listResult.rows ?? []) as Row[];
    const items: CustomerListItemWithSource[] = rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email ?? null,
      phone: r.phone ?? null,
      addressLine1: r.address_line1 ?? null,
      city: r.city ?? null,
      country: r.country ?? null,
      companiesCount: Number(r.companies_count) ?? 0,
      source: r.source,
    }));

    return { items, total, page, limit };
  } catch (err) {
    const code = (err as { code?: string; cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
    const msg = String((err as { message?: string; cause?: { message?: string } })?.cause?.message ?? (err as { message?: string })?.message ?? "");
    if (code === "42P01" || msg.includes("person_groups") && msg.includes("does not exist")) {
      return listCustomers(params).then((r) => ({
        ...r,
        items: r.items.map((i) => ({ ...i, source: "customer" as const })),
      }));
    }
    throw err;
  }
}

/**
 * Busca person_groups por termo (full_name, email, phone).
 */
export async function lookupPersonGroups(
  q: string,
  limit: number = 10
): Promise<CustomerLookupItem[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const pattern = `%${term.replace(/%/g, "\\%")}%`;
  const digitsOnly = term.replace(/\D/g, "");
  const phonePattern = digitsOnly.length >= 2 ? `%${digitsOnly}%` : null;

  const conditions = [
    ilike(personGroups.fullName, pattern),
    ilike(personGroups.email, pattern),
  ];
  if (phonePattern) {
    conditions.push(ilike(personGroups.phone, phonePattern));
  }

  const rows = await db
    .select({
      id: personGroups.id,
      fullName: personGroups.fullName,
      email: personGroups.email,
      phone: personGroups.phone,
    })
    .from(personGroups)
    .where(or(...conditions))
    .orderBy(desc(personGroups.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email ?? null,
    phone: r.phone ?? null,
  }));
}

function isRelationNotFound(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
  return code === "42P01";
}

/**
 * Busca pessoas pela mesma fonte da página Clientes: clientes com sócio pagador (CTE).
 * Não depende da tabela person_groups. Retorna personGroupId como id, displayName como fullName.
 */
export async function lookupPayerGroupsFromClients(
  q: string,
  limit: number = 10
): Promise<CustomerLookupItem[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const pattern = `%${term.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const digitsOnly = term.replace(/\D/g, "");
  const hasPhone = digitsOnly.length >= 2;

  const GROUPS_CTE = sql`WITH payer_groups AS (
    SELECT DISTINCT c.person_group_id
    FROM clients c
    INNER JOIN client_partners cp ON cp.client_id = c.id AND cp.is_payer = true
    WHERE c.person_group_id IS NOT NULL AND c.deleted_at IS NULL
  ),
  groups AS (
    SELECT c.person_group_id, (array_agg(c.id ORDER BY c.updated_at DESC))[1] AS rep_client_id
    FROM clients c
    INNER JOIN payer_groups pg ON pg.person_group_id = c.person_group_id
    WHERE c.deleted_at IS NULL
    GROUP BY c.person_group_id
  ),
  with_partner AS (
    SELECT g.person_group_id,
      COALESCE(cp.full_name, c.company_name) AS display_name,
      COALESCE(cp.email, c.email) AS email,
      cp.phone AS phone
    FROM groups g
    JOIN clients c ON c.id = g.rep_client_id
    LEFT JOIN client_partners cp ON cp.client_id = g.rep_client_id AND cp.role = 'SocioPrincipal'
  )`;

  type Row = { person_group_id: string; display_name: string | null; email: string | null; phone: string | null };
  try {
    const phoneCond = hasPhone ? sql`OR with_partner.phone ILIKE ${`%${digitsOnly}%`}` : sql``;
    const listResult = await db.execute<Row>(sql`
      ${GROUPS_CTE}
      SELECT DISTINCT ON (with_partner.person_group_id)
        with_partner.person_group_id,
        with_partner.display_name,
        with_partner.email,
        with_partner.phone
      FROM with_partner
      WHERE (with_partner.display_name ILIKE ${pattern} OR with_partner.email ILIKE ${pattern} ${phoneCond})
      ORDER BY with_partner.person_group_id
      LIMIT ${limit}
    `);
    const rows = (listResult.rows ?? []) as Row[];
    return rows.map((r: Row) => ({
      id: r.person_group_id,
      fullName: r.display_name ?? "",
      email: r.email ?? null,
      phone: r.phone ?? null,
    }));
  } catch (err) {
    if (isRelationNotFound(err)) return [];
    throw err;
  }
}

/**
 * Busca unificada: customers + person_groups + payer groups (mesma fonte da página Clientes).
 * Se a tabela customers ou person_groups não existir, retorna [] para essa parte.
 */
export async function lookupCustomersAndPersons(
  q: string,
  limit: number = 10
): Promise<CustomerLookupItemWithSource[]> {
  const third = Math.max(1, Math.floor(limit / 3));
  let fromCustomers: CustomerLookupItem[] = [];
  let fromPersonTable: CustomerLookupItem[] = [];
  let fromPayerGroups: CustomerLookupItem[] = [];
  try {
    fromCustomers = await lookupCustomers(q, third);
  } catch (err) {
    if (!isRelationNotFound(err)) throw err;
  }
  try {
    fromPersonTable = await lookupPersonGroups(q, third);
  } catch (err) {
    if (!isRelationNotFound(err)) throw err;
  }
  try {
    fromPayerGroups = await lookupPayerGroupsFromClients(q, third);
  } catch (err) {
    if (!isRelationNotFound(err)) throw err;
  }
  const withSourceCustomer: CustomerLookupItemWithSource[] = fromCustomers.map((r) => ({
    ...r,
    source: "customer" as const,
  }));
  const seenIds = new Set<string>();
  const fromPersons: CustomerLookupItem[] = [];
  for (const r of [...fromPayerGroups, ...fromPersonTable]) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    fromPersons.push(r);
  }
  const withSourcePerson: CustomerLookupItemWithSource[] = fromPersons.map((r) => ({
    ...r,
    source: "person_group" as const,
  }));
  return [...withSourceCustomer, ...withSourcePerson].slice(0, limit);
}

const PLACEHOLDER_EMAIL_DOMAIN = "person.vulpeinc";
const PLACEHOLDER_ADDRESS = "A definir";

/**
 * Busca dados de uma pessoa pelo CTE (mesma fonte da página Clientes) quando não existe em person_groups.
 */
async function getPayerGroupSummaryByPersonId(
  personGroupId: string
): Promise<{ fullName: string; email: string | null; phone: string | null } | null> {
  const CTE = sql`WITH payer_groups AS (
    SELECT DISTINCT c.person_group_id FROM clients c
    INNER JOIN client_partners cp ON cp.client_id = c.id AND cp.is_payer = true
    WHERE c.person_group_id IS NOT NULL AND c.deleted_at IS NULL
  ),
  groups AS (
    SELECT c.person_group_id, (array_agg(c.id ORDER BY c.updated_at DESC))[1] AS rep_client_id
    FROM clients c INNER JOIN payer_groups pg ON pg.person_group_id = c.person_group_id
    WHERE c.deleted_at IS NULL
    GROUP BY c.person_group_id
  ),
  with_partner AS (
    SELECT g.person_group_id,
      COALESCE(cp.full_name, c.company_name) AS display_name,
      COALESCE(cp.email, c.email) AS email, cp.phone AS phone
    FROM groups g
    JOIN clients c ON c.id = g.rep_client_id
    LEFT JOIN client_partners cp ON cp.client_id = g.rep_client_id AND cp.role = 'SocioPrincipal'
  )`;
  type Row = { display_name: string | null; email: string | null; phone: string | null };
  try {
    const result = await db.execute<Row>(sql`
      ${CTE}
      SELECT with_partner.display_name, with_partner.email, with_partner.phone
      FROM with_partner
      WHERE with_partner.person_group_id = ${personGroupId}
      LIMIT 1
    `);
    const r = result.rows?.[0];
    if (!r || !r.display_name) return null;
    return {
      fullName: r.display_name,
      email: r.email ?? null,
      phone: r.phone ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve o [id] da rota /clientes/pagadores/[id] para o customer id a usar nas APIs.
 * Aceita personGroupId (ex.: criado em /clientes/new) ou customerId (ex.: Douglas).
 * - Se id existe em person_groups → getOrCreateCustomerFromPersonGroup(id) e retorna customer.id.
 * - Se id existe em customers → retorna id.
 * - Caso contrário → null.
 */
export async function resolveToCustomerId(
  id: string
): Promise<string | null> {
  if (!id) return null;
  try {
    const [inPg] = await db
      .select({ id: personGroups.id })
      .from(personGroups)
      .where(eq(personGroups.id, id))
      .limit(1);
    if (inPg) {
      const customer = await getOrCreateCustomerFromPersonGroup(id);
      return customer?.id ?? null;
    }
    const [inC] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    return inC?.id ?? null;
  } catch (err) {
    if (isRelationNotFound(err)) return null;
    throw err;
  }
}

/**
 * Retorna o customer id (e resumo) para um person_group: se já existir customer
 * com o mesmo e-mail normalizado, retorna esse; senão cria um customer a partir
 * dos dados da pessoa (tabela person_groups ou, se não houver, do CTE da página Clientes).
 */
export async function getOrCreateCustomerFromPersonGroup(
  personGroupId: string
): Promise<CustomerLookupItem | null> {
  let fullName: string;
  let emailRaw: string | null;
  let phone: string | null;
  let givenName: string;
  let surName: string;
  let citizenshipCountry: string;
  let addressLine1: string;
  let addressLine2: string | null;
  let city: string;
  let stateProvince: string;
  let postalCode: string;
  let country: string;

  let person: typeof personGroups.$inferSelect | null = null;
  try {
    const [p] = await db
      .select()
      .from(personGroups)
      .where(eq(personGroups.id, personGroupId))
      .limit(1);
    person = p ?? null;
  } catch (err) {
    if (!isRelationNotFound(err)) throw err;
  }

  if (person) {
    fullName = person.fullName;
    emailRaw = person.email?.trim() ?? null;
    phone = person.phone ?? null;
    givenName = person.givenName;
    surName = person.surName;
    citizenshipCountry = person.citizenshipCountry;
    addressLine1 = person.addressLine1?.trim() || PLACEHOLDER_ADDRESS;
    addressLine2 = person.addressLine2 ?? null;
    city = person.city?.trim() || PLACEHOLDER_ADDRESS;
    stateProvince = person.stateProvince?.trim() || PLACEHOLDER_ADDRESS;
    postalCode = person.postalCode?.trim() || PLACEHOLDER_ADDRESS;
    country = person.country?.trim() || PLACEHOLDER_ADDRESS;
  } else {
    const fromCte = await getPayerGroupSummaryByPersonId(personGroupId);
    if (!fromCte) return null;
    fullName = fromCte.fullName;
    emailRaw = fromCte.email?.trim() ?? null;
    phone = fromCte.phone ?? null;
    const parts = fullName.trim().split(/\s+/);
    givenName = parts[0] ?? fullName;
    surName = parts.slice(1).join(" ") || givenName;
    citizenshipCountry = PLACEHOLDER_ADDRESS;
    addressLine1 = addressLine2 = city = stateProvince = postalCode = country = PLACEHOLDER_ADDRESS;
  }

  const normalizedEmail =
    emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      ? normalizeEmail(emailRaw)
      : null;
  if (normalizedEmail) {
    const existing = await findCustomerByNormalizedEmail(db, normalizedEmail);
    if (existing) return existing;
  }

  const email = normalizedEmail ?? `${personGroupId}@${PLACEHOLDER_EMAIL_DOMAIN}`;

  const [row] = await db
    .insert(customers)
    .values({
      fullName,
      givenName,
      surName,
      citizenshipCountry,
      phone,
      email,
      addressLine1,
      addressLine2,
      city,
      stateProvince,
      postalCode,
      country,
      updatedAt: new Date(),
    })
    .returning({
      id: customers.id,
      fullName: customers.fullName,
      email: customers.email,
      phone: customers.phone,
    });

  if (!row) return null;
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email ?? null,
    phone: row.phone ?? null,
  };
}

/**
 * Remove o cliente pagador: [id] pode ser personGroupId ou customerId.
 * - Se person_group: desvincula clients.person_group_id, remove customer encontrado por e-mail (se houver), remove person_group.
 * - Se customer: remove o customer (client_partners.customer_id fica null por FK).
 * Retorna true se removeu algo; false se id não encontrado.
 */
export async function deleteClientePagador(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const [inPg] = await db
      .select({ id: personGroups.id, email: personGroups.email })
      .from(personGroups)
      .where(eq(personGroups.id, id))
      .limit(1);
    if (inPg) {
      const emailRaw = inPg.email?.trim();
      const normalizedEmail =
        emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
          ? normalizeEmail(emailRaw)
          : null;
      if (normalizedEmail) {
        const existing = await findCustomerByNormalizedEmail(db, normalizedEmail);
        if (existing) {
          await db.delete(customers).where(eq(customers.id, existing.id));
        }
      }
      await db
        .update(clients)
        .set({ personGroupId: null, updatedAt: new Date() })
        .where(eq(clients.personGroupId, id));
      await db.delete(personGroups).where(eq(personGroups.id, id));
      return true;
    }
    const [inC] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    if (inC) {
      await db.delete(customers).where(eq(customers.id, id));
      return true;
    }
    return false;
  } catch (err) {
    if (isRelationNotFound(err)) return false;
    throw err;
  }
}

export type CustomerFull = {
  id: string;
  fullName: string;
  givenName: string;
  surName: string;
  citizenshipCountry: string;
  phone: string | null;
  email: string;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
  };
};

/**
 * Busca customer por id com todos os campos para exibição no formulário.
 */
export async function getCustomerFullById(id: string): Promise<CustomerFull | null> {
  const [row] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.fullName,
    givenName: row.givenName,
    surName: row.surName,
    citizenshipCountry: row.citizenshipCountry,
    phone: row.phone ?? null,
    email: row.email,
    address: {
      line1: row.addressLine1,
      line2: row.addressLine2 ?? null,
      city: row.city,
      stateProvince: row.stateProvince,
      postalCode: row.postalCode,
      country: row.country,
    },
  };
}

/**
 * Atualiza customer por id. Normaliza email (trim + lower).
 * Retorna o customer atualizado no formato CustomerFull ou null se não existir.
 */
export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput
): Promise<CustomerFull | null> {
  const normalizedEmail = normalizeEmail(data.email);
  const [row] = await db
    .update(customers)
    .set({
      fullName: data.fullName,
      givenName: data.givenName,
      surName: data.surName,
      citizenshipCountry: data.citizenshipCountry,
      phone: data.phone ?? null,
      email: normalizedEmail,
      addressLine1: data.address.line1,
      addressLine2: data.address.line2?.trim() || null,
      city: data.address.city,
      stateProvince: data.address.stateProvince,
      postalCode: data.address.postalCode,
      country: data.address.country,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))
    .returning();
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.fullName,
    givenName: row.givenName,
    surName: row.surName,
    citizenshipCountry: row.citizenshipCountry,
    phone: row.phone ?? null,
    email: row.email,
    address: {
      line1: row.addressLine1,
      line2: row.addressLine2 ?? null,
      city: row.city,
      stateProvince: row.stateProvince,
      postalCode: row.postalCode,
      country: row.country,
    },
  };
}

/**
 * Busca customer por email normalizado (lower/trim).
 * Retorna o primeiro encontrado (id, fullName, email, phone).
 */
export async function findCustomerByNormalizedEmail(
  client: typeof db,
  normalizedEmail: string
): Promise<CustomerLookupItem | null> {
  const [row] = await client
    .select({
      id: customers.id,
      fullName: customers.fullName,
      email: customers.email,
      phone: customers.phone,
    })
    .from(customers)
    .where(sql`lower(${customers.email}) = ${normalizedEmail}`)
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email ?? null,
    phone: row.phone ?? null,
  };
}

/**
 * Cria um cliente pagador (customer).
 * Se já existir customer com o mesmo email (case-insensitive), retorna o existente com reused: true.
 */
export async function createCustomer(
  input: CreateCustomerInput
): Promise<{ id: string; reused?: boolean }> {
  const normalized = normalizeEmail(input.email);
  const existing = await findCustomerByNormalizedEmail(db, normalized);
  if (existing) {
    return { id: existing.id, reused: true };
  }
  const [row] = await db
    .insert(customers)
    .values({
      fullName: input.fullName,
      givenName: input.givenName,
      surName: input.surName,
      citizenshipCountry: input.citizenshipCountry,
      phone: input.phone ?? null,
      email: normalized,
      addressLine1: input.address.line1,
      addressLine2: input.address.line2 ?? null,
      city: input.address.city,
      stateProvince: input.address.stateProvince,
      postalCode: input.address.postalCode,
      country: input.address.country,
      updatedAt: new Date(),
    })
    .returning({ id: customers.id });

  if (!row) throw new Error("createCustomer failed");
  return { id: row.id, reused: false };
}

/**
 * Encontra ou cria customer (para uso dentro de transação com customerInline).
 * Retorna { id, reused }.
 */
export async function findOrCreateCustomer(
  client: typeof db,
  input: CreateCustomerInput
): Promise<{ id: string; reused: boolean }> {
  const normalized = normalizeEmail(input.email);
  const existing = await findCustomerByNormalizedEmail(client, normalized);
  if (existing) {
    return { id: existing.id, reused: true };
  }
  const [row] = await client
    .insert(customers)
    .values({
      fullName: input.fullName,
      givenName: input.givenName,
      surName: input.surName,
      citizenshipCountry: input.citizenshipCountry,
      phone: input.phone ?? null,
      email: normalized,
      addressLine1: input.address.line1,
      addressLine2: input.address.line2 ?? null,
      city: input.address.city,
      stateProvince: input.address.stateProvince,
      postalCode: input.address.postalCode,
      country: input.address.country,
      updatedAt: new Date(),
    })
    .returning({ id: customers.id });

  if (!row) throw new Error("findOrCreateCustomer failed");
  return { id: row.id, reused: false };
}

/**
 * Busca customer por id (para resumo no GET client).
 */
export async function getCustomerById(
  id: string
): Promise<CustomerLookupItem | null> {
  const [row] = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      email: customers.email,
      phone: customers.phone,
    })
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email ?? null,
    phone: row.phone ?? null,
  };
}

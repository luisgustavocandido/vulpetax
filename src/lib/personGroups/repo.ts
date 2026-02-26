import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, personGroups } from "@/db/schema";
import type { CreatePersonGroupInput, CreatePersonGroupAddress } from "./validators";

export type PersonGroupProfileRow = {
  personGroupId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  companiesCount: number;
  updatedAtMax: Date | string;
};

/**
 * Retorna todos os perfis de grupos (para auto-merge).
 * Mesma regra de "melhor" perfil: cliente mais recente + sócio principal.
 */
export async function getAllPersonGroupProfiles(): Promise<PersonGroupProfileRow[]> {
  const rows = await db.execute<PersonGroupProfileRow>(sql`
    WITH groups AS (
      SELECT
        c.person_group_id,
        COUNT(*)::int AS companies_count,
        (array_agg(c.id ORDER BY c.updated_at DESC))[1] AS rep_client_id,
        MAX(c.updated_at) AS updated_at_max
      FROM clients c
      WHERE c.person_group_id IS NOT NULL AND c.deleted_at IS NULL
      GROUP BY c.person_group_id
    ),
    rep_client AS (
      SELECT g.person_group_id, g.companies_count, g.rep_client_id, g.updated_at_max,
        c.company_name AS rep_company_name,
        c.email AS client_email
      FROM groups g
      JOIN clients c ON c.id = g.rep_client_id
    ),
    with_partner AS (
      SELECT r.person_group_id, r.companies_count, r.updated_at_max,
        COALESCE(cp.full_name, r.rep_company_name) AS display_name,
        COALESCE(cp.email, r.client_email) AS email,
        cp.phone AS phone
      FROM rep_client r
      LEFT JOIN client_partners cp ON cp.client_id = r.rep_client_id AND cp.role = 'SocioPrincipal'
    )
    SELECT
      with_partner.person_group_id AS "personGroupId",
      with_partner.display_name AS "displayName",
      with_partner.email,
      with_partner.phone,
      with_partner.companies_count AS "companiesCount",
      with_partner.updated_at_max AS "updatedAtMax"
    FROM with_partner
  `);
  return (rows.rows ?? []).map((r: PersonGroupProfileRow) => ({
    personGroupId: r.personGroupId,
    displayName: r.displayName ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    companiesCount: Number(r.companiesCount ?? 0),
    updatedAtMax: r.updatedAtMax instanceof Date ? r.updatedAtMax : new Date(String(r.updatedAtMax)),
  }));
}

/**
 * Verifica se existe ao menos um client (não deletado) com o personGroupId.
 */
export async function ensurePersonGroupExists(
  personGroupId: string
): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients)
    .where(
      and(
        eq(clients.personGroupId, personGroupId),
        isNull(clients.deletedAt)
      )
    );
  return (row?.count ?? 0) > 0;
}

export type MergePersonGroupsParams = {
  targetPersonGroupId: string;
  sourcePersonGroupIds: string[];
};

/**
 * Move todas as empresas (clients) dos grupos origem para o grupo destino.
 * Executa em transação. Retorna o número de clients atualizados.
 */
export async function mergePersonGroups(
  params: MergePersonGroupsParams
): Promise<{ movedCompanies: number }> {
  const { targetPersonGroupId, sourcePersonGroupIds } = params;

  if (sourcePersonGroupIds.length === 0) {
    return { movedCompanies: 0 };
  }

  const result = await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(clients)
      .set({
        personGroupId: targetPersonGroupId,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(clients.personGroupId, sourcePersonGroupIds),
          isNull(clients.deletedAt)
        )
      )
      .returning({ id: clients.id });

    return { movedCount: updateResult.length };
  });

  return { movedCompanies: result.movedCount };
}

function mapAddressToPersonGroup(addr: CreatePersonGroupAddress) {
  return {
    addressLine1: addr.line1?.trim() || null,
    addressLine2: addr.line2?.trim() || null,
    city: addr.city?.trim() || null,
    stateProvince: addr.stateProvince?.trim() || null,
    postalCode: addr.postalCode?.trim() || null,
    country: addr.country?.trim() || null,
  };
}

export type CreatePersonGroupResult = {
  personGroupId: string;
};

/**
 * Cria um novo person_group apenas com dados pessoais. Vínculo com empresa é feito em outro fluxo.
 */
export async function createPersonGroup(
  input: CreatePersonGroupInput
): Promise<CreatePersonGroupResult> {
  const { address, ...person } = input;
  const now = new Date();
  const base = {
    fullName: person.fullName.trim(),
    givenName: person.givenName.trim(),
    surName: person.surName.trim(),
    citizenshipCountry: person.citizenshipCountry.trim(),
    phone: person.phone?.trim() || null,
    email: person.email?.trim() || null,
    ...mapAddressToPersonGroup(address),
    updatedAt: now,
    createdAt: now,
  };

  const [inserted] = await db
    .insert(personGroups)
    .values(base)
    .returning({ id: personGroups.id });
  if (!inserted) throw new Error("Insert person_group failed");
  return { personGroupId: inserted.id };
}

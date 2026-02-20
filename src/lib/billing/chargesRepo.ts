import { db } from "@/db";
import { billingCharges, clients, clientLineItems } from "@/db/schema";
import type { BillingChargeStatus } from "@/db/schema";
import { and, eq, sql, desc, asc, gte, lte, or, isNull, inArray } from "drizzle-orm";
import type { SortOrder } from "@/types/billingFilters";

export type CreateChargeInput = {
  clientId: string;
  lineItemId: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  dueDate: string;
  status?: BillingChargeStatus;
};

export async function createChargeIfNotExists(
  input: CreateChargeInput
): Promise<{ id: string; created: boolean }> {
  const existing = await db
    .select({ id: billingCharges.id })
    .from(billingCharges)
    .where(
      and(
        eq(billingCharges.lineItemId, input.lineItemId),
        eq(billingCharges.periodStart, input.periodStart),
        eq(billingCharges.periodEnd, input.periodEnd)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    return { id: existing[0].id, created: false };
  }
  const [row] = await db
    .insert(billingCharges)
    .values({
      clientId: input.clientId,
      lineItemId: input.lineItemId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      amountCents: input.amountCents,
      dueDate: input.dueDate,
      status: input.status ?? "pending",
      currency: "USD",
    })
    .returning({ id: billingCharges.id });
  if (!row) throw new Error("Insert billing charge failed");
  return { id: row.id, created: true };
}

export async function markPaid(params: {
  chargeId: string;
  paidAt: string;
  paidMethod?: string | null;
  provider?: "manual" | "stripe";
  providerRef?: string | null;
  notes?: string | null;
}): Promise<boolean> {
  const res = await db
    .update(billingCharges)
    .set({
      status: "paid",
      paidAt: new Date(params.paidAt),
      paidMethod: params.paidMethod ?? null,
      provider: params.provider ?? "manual",
      providerRef: params.providerRef ?? null,
      notes: params.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(billingCharges.id, params.chargeId));
  return (res.rowCount ?? 0) > 0;
}

export async function markCanceled(params: {
  chargeId: string;
  notes?: string | null;
}): Promise<boolean> {
  const res = await db
    .update(billingCharges)
    .set({
      status: "canceled",
      notes: params.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(billingCharges.id, params.chargeId));
  return (res.rowCount ?? 0) > 0;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export type UpdateChargeInput = {
  amountCents?: number;
  dueDate?: string;
  notes?: string | null;
  /** Data de pagamento (apenas para cobranças já pagas). */
  paidAt?: string | null;
};

/** Atualiza cobrança (valor, data de vencimento, observações, data de pagamento). */
export async function updateCharge(
  chargeId: string,
  input: UpdateChargeInput
): Promise<boolean> {
  const set: {
    amountCents?: number;
    dueDate?: string;
    notes?: string | null;
    paidAt?: Date | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (input.amountCents !== undefined) set.amountCents = input.amountCents;
  if (input.dueDate !== undefined) set.dueDate = input.dueDate;
  if (input.notes !== undefined) set.notes = input.notes;
  if (input.paidAt !== undefined)
    set.paidAt = input.paidAt == null || input.paidAt === "" ? null : new Date(input.paidAt.trim().slice(0, 10) + "T12:00:00.000Z");
  if (Object.keys(set).length <= 1) return true;
  const res = await db
    .update(billingCharges)
    .set(set)
    .where(eq(billingCharges.id, chargeId));
  return (res.rowCount ?? 0) > 0;
}

/** Exclui uma cobrança permanentemente. */
export async function deleteCharge(chargeId: string): Promise<boolean> {
  const res = await db
    .delete(billingCharges)
    .where(eq(billingCharges.id, chargeId));
  return (res.rowCount ?? 0) > 0;
}

/** Reabre cobrança cancelada: status -> pending ou overdue conforme dueDate. */
export async function reopenCharge(chargeId: string): Promise<boolean> {
  const [c] = await db
    .select({ status: billingCharges.status, dueDate: billingCharges.dueDate })
    .from(billingCharges)
    .where(eq(billingCharges.id, chargeId))
    .limit(1);
  if (!c || c.status !== "canceled") return false;
  const today = todayIso();
  const newStatus = c.dueDate && String(c.dueDate).slice(0, 10) < today ? "overdue" : "pending";
  const res = await db
    .update(billingCharges)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(billingCharges.id, chargeId));
  return (res.rowCount ?? 0) > 0;
}

export type ListChargesFilters = {
  status?: BillingChargeStatus | "all" | "overdue" | "pending,overdue";
  period?: "all" | "Mensal" | "Anual";
  from?: string;
  to?: string;
  q?: string;
  clientId?: string;
  state?: string; // sigla do estado (ex: "WY")
  sort?: SortOrder;
  page?: number;
  limit?: number;
};

export type ChargeListRow = {
  id: string;
  clientId: string;
  lineItemId: string;
  periodStart: string | null;
  periodEnd: string | null;
  amountCents: number;
  currency: string | null;
  status: string;
  billingPeriod: string | null;
  dueDate: string | null;
  paidAt: string | null;
  paidMethod: string | null;
  provider: string | null;
  notes: string | null;
  companyName: string | null;
  paymentMethod: string | null;
  addressProvider: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  steNumber: string | null;
  llcState: string | null; // estado do LLC mais recente do cliente
};

export async function listCharges(
  filters: ListChargesFilters = {}
): Promise<{ data: ChargeListRow[]; total: number }> {
  const conditions = [isNull(clients.deletedAt)];

  if (filters.status && filters.status !== "all") {
    if (filters.status === "pending,overdue") {
      conditions.push(
        or(
          eq(billingCharges.status, "pending"),
          eq(billingCharges.status, "overdue")
        )!
      );
    } else if (filters.status === "overdue") {
      conditions.push(eq(billingCharges.status, "overdue"));
    } else {
      conditions.push(eq(billingCharges.status, filters.status as BillingChargeStatus));
    }
  }

  if (filters.period && filters.period !== "all") {
    conditions.push(eq(clientLineItems.billingPeriod, filters.period));
  }
  if (filters.from) {
    conditions.push(gte(billingCharges.dueDate, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(billingCharges.dueDate, filters.to));
  }
  if (filters.clientId) {
    conditions.push(eq(billingCharges.clientId, filters.clientId));
  }

  // Se filtro por estado, adicionar condição via subquery
  if (filters.state && filters.state !== "all") {
    const stateUpper = filters.state.toUpperCase();
    conditions.push(
      sql`${billingCharges.clientId} IN (
        SELECT DISTINCT ${clientLineItems.clientId}
        FROM ${clientLineItems}
        WHERE ${clientLineItems.kind} IN ('LLC', 'Llc', 'LLc', 'llc')
          AND ${clientLineItems.llcState} = ${stateUpper}
      )`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: billingCharges.id,
      clientId: billingCharges.clientId,
      lineItemId: billingCharges.lineItemId,
      periodStart: billingCharges.periodStart,
      periodEnd: billingCharges.periodEnd,
      amountCents: billingCharges.amountCents,
      currency: billingCharges.currency,
      status: billingCharges.status,
      dueDate: billingCharges.dueDate,
      paidAt: billingCharges.paidAt,
      paidMethod: billingCharges.paidMethod,
      provider: billingCharges.provider,
      notes: billingCharges.notes,
      companyName: clients.companyName,
      paymentMethod: clients.paymentMethod,
      billingPeriod: clientLineItems.billingPeriod,
      addressProvider: clientLineItems.addressProvider,
      addressLine1: clientLineItems.addressLine1,
      addressLine2: clientLineItems.addressLine2,
      steNumber: clientLineItems.steNumber,
    })
    .from(billingCharges)
    .innerJoin(clients, eq(billingCharges.clientId, clients.id))
    .innerJoin(clientLineItems, eq(billingCharges.lineItemId, clientLineItems.id));

  // Aplicar ordenação
  let orderByClause;
  switch (filters.sort) {
    case "dueDateAsc":
      orderByClause = [asc(billingCharges.dueDate), desc(billingCharges.periodStart)];
      break;
    case "dueDateDesc":
      orderByClause = [desc(billingCharges.dueDate), desc(billingCharges.periodStart)];
      break;
    case "companyAsc":
      orderByClause = [asc(clients.companyName), desc(billingCharges.dueDate)];
      break;
    case "companyDesc":
      orderByClause = [desc(clients.companyName), desc(billingCharges.dueDate)];
      break;
    default:
      // Default: overdue primeiro, depois por dueDate asc
      orderByClause = [
        sql`CASE WHEN ${billingCharges.status} = 'overdue' THEN 0 ELSE 1 END`,
        asc(billingCharges.dueDate),
        desc(billingCharges.periodStart),
      ];
  }
  const dataQuery = baseQuery.orderBy(...orderByClause);

  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(billingCharges)
    .innerJoin(clients, eq(billingCharges.clientId, clients.id))
    .innerJoin(clientLineItems, eq(billingCharges.lineItemId, clientLineItems.id));

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  type RowWithoutLlcState = Omit<ChargeListRow, "llcState">;
  let rawData: RowWithoutLlcState[];
  let total: number;

  if (filters.q?.trim()) {
    // Busca em memória
    const all = await (where ? dataQuery.where(where) : dataQuery);
    const q = filters.q.trim().toLowerCase();
    const filtered = all.filter(
      (r) =>
        r.companyName?.toLowerCase().includes(q) ||
        (r.addressLine1?.toLowerCase().includes(q) ?? false) ||
        (r.addressLine2?.toLowerCase().includes(q) ?? false) ||
        (r.addressProvider?.toLowerCase().includes(q) ?? false)
    );
    total = filtered.length;
    rawData = filtered.slice(offset, offset + limit) as RowWithoutLlcState[];
  } else {
    const countRes = await (where ? countQuery.where(where) : countQuery);
    const dataRes = await (where ? dataQuery.where(where) : dataQuery).limit(limit).offset(offset);
    total = (countRes[0] as { count: number })?.count ?? 0;
    rawData = dataRes as RowWithoutLlcState[];
  }

  // Buscar llcState para cada cliente único
  const clientIds = Array.from(new Set(rawData.map((r) => r.clientId)));
  const llcStatesMap = new Map<string, string | null>();

  if (clientIds.length > 0) {
    // Buscar o llcState mais recente de cada cliente
    const llcStates = await db
      .select({
        clientId: clientLineItems.clientId,
        llcState: clientLineItems.llcState,
      })
      .from(clientLineItems)
      .where(
        and(
          sql`${clientLineItems.kind} IN ('LLC', 'Llc', 'LLc', 'llc')`,
          sql`${clientLineItems.llcState} IS NOT NULL`,
          inArray(clientLineItems.clientId, clientIds)
        )
      )
      .orderBy(desc(clientLineItems.saleDate), desc(clientLineItems.createdAt));

    // Pegar o mais recente por cliente (primeiro resultado de cada cliente)
    for (const item of llcStates) {
      if (!llcStatesMap.has(item.clientId)) {
        llcStatesMap.set(item.clientId, item.llcState);
      }
    }
  }

  // Adicionar llcState aos resultados
  const data: ChargeListRow[] = rawData.map((r) => ({
    ...r,
    llcState: llcStatesMap.get(r.clientId) ?? null,
  }));

  return { data, total };
}

export type GetChargeResult = {
  billingCharges: {
    id: string;
    status: string;
    clientId: string;
    lineItemId: string;
    periodStart: string | null;
    periodEnd: string | null;
    dueDate: string | null;
    amountCents: number;
    paidAt: Date | string | null;
    paidMethod: string | null;
    notes: string | null;
  };
  client: { id: string; companyName: string | null; paymentMethod: string | null };
  lineItem: {
    id: string;
    addressProvider: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    steNumber: string | null;
  };
};

export async function getCharge(id: string): Promise<GetChargeResult | null> {
  const [row] = await db
    .select({
      id: billingCharges.id,
      status: billingCharges.status,
      clientId: billingCharges.clientId,
      lineItemId: billingCharges.lineItemId,
      periodStart: billingCharges.periodStart,
      periodEnd: billingCharges.periodEnd,
      dueDate: billingCharges.dueDate,
      amountCents: billingCharges.amountCents,
      paidAt: billingCharges.paidAt,
      paidMethod: billingCharges.paidMethod,
      notes: billingCharges.notes,
      companyName: clients.companyName,
      paymentMethod: clients.paymentMethod,
      clientPk: clients.id,
      lineItemPk: clientLineItems.id,
      addressProvider: clientLineItems.addressProvider,
      addressLine1: clientLineItems.addressLine1,
      addressLine2: clientLineItems.addressLine2,
      steNumber: clientLineItems.steNumber,
    })
    .from(billingCharges)
    .innerJoin(clients, eq(billingCharges.clientId, clients.id))
    .innerJoin(clientLineItems, eq(billingCharges.lineItemId, clientLineItems.id))
    .where(eq(billingCharges.id, id))
    .limit(1);
  if (!row) return null;
  const r = row as typeof row & { clientPk: string; lineItemPk: string };
  return {
    billingCharges: {
      id: r.id,
      status: r.status,
      clientId: r.clientId,
      lineItemId: r.lineItemId,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      dueDate: r.dueDate,
      amountCents: r.amountCents,
      paidAt: r.paidAt,
      paidMethod: r.paidMethod,
      notes: r.notes,
    },
    client: {
      id: r.clientPk,
      companyName: r.companyName,
      paymentMethod: r.paymentMethod,
    },
    lineItem: {
      id: r.lineItemPk,
      addressProvider: r.addressProvider,
      addressLine1: r.addressLine1,
      addressLine2: r.addressLine2,
      steNumber: r.steNumber,
    },
  };
}

export async function getChargesSummary(filters: Partial<ListChargesFilters> = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const conditions: ReturnType<typeof and>[] = [];

  // Aplicar filtros comuns (exceto status que é específico de cada query)
  if (filters.period && filters.period !== "all") {
    conditions.push(eq(clientLineItems.billingPeriod, filters.period));
  }
  if (filters.from) {
    conditions.push(gte(billingCharges.dueDate, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(billingCharges.dueDate, filters.to));
  }
  if (filters.clientId) {
    conditions.push(eq(billingCharges.clientId, filters.clientId));
  }
  if (filters.state && filters.state !== "all") {
    const stateUpper = filters.state.toUpperCase();
    conditions.push(
      sql`${billingCharges.clientId} IN (
        SELECT DISTINCT ${clientLineItems.clientId}
        FROM ${clientLineItems}
        WHERE ${clientLineItems.kind} IN ('LLC', 'Llc', 'LLc', 'llc')
          AND ${clientLineItems.llcState} = ${stateUpper}
      )`
    );
  }
  conditions.push(isNull(clients.deletedAt));

  const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;

  // Busca por texto (q) - aplicar em memória se necessário
  type SummaryRow = {
    status: string;
    amountCents: number;
    dueDate: string | null;
    paidAt: Date | string | null;
    companyName: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    addressProvider: string | null;
  };
  let qFilter: ((row: SummaryRow) => boolean) | undefined;
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    qFilter = (r: SummaryRow) =>
      r.companyName?.toLowerCase().includes(q) ||
      (r.addressLine1?.toLowerCase().includes(q) ?? false) ||
      (r.addressLine2?.toLowerCase().includes(q) ?? false) ||
      (r.addressProvider?.toLowerCase().includes(q) ?? false);
  }

  const baseQuery = db
    .select({
      status: billingCharges.status,
      amountCents: billingCharges.amountCents,
      dueDate: billingCharges.dueDate,
      paidAt: billingCharges.paidAt,
      companyName: clients.companyName,
      addressLine1: clientLineItems.addressLine1,
      addressLine2: clientLineItems.addressLine2,
      addressProvider: clientLineItems.addressProvider,
    })
    .from(billingCharges)
    .innerJoin(clients, eq(billingCharges.clientId, clients.id))
    .innerJoin(clientLineItems, eq(billingCharges.lineItemId, clientLineItems.id));

  const allRows = baseWhere ? await baseQuery.where(baseWhere) : await baseQuery;
  const filteredRows = qFilter ? allRows.filter(qFilter) : allRows;

  const pendingRows = filteredRows.filter(
    (r) => r.status === "pending" && r.dueDate && String(r.dueDate).slice(0, 10) >= today
  );
  const overdueRows = filteredRows.filter((r) => r.status === "overdue");
  
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const startNextMonth = new Date(startOfMonth);
  startNextMonth.setUTCMonth(startNextMonth.getUTCMonth() + 1);
  const paidThisMonthRows = filteredRows.filter(
    (r) =>
      r.status === "paid" &&
      r.paidAt &&
      new Date(r.paidAt) >= startOfMonth &&
      new Date(r.paidAt) < startNextMonth
  );

  return {
    pending: {
      count: pendingRows.length,
      totalCents: pendingRows.reduce((sum, r) => sum + (r.amountCents ?? 0), 0),
    },
    overdue: {
      count: overdueRows.length,
      totalCents: overdueRows.reduce((sum, r) => sum + (r.amountCents ?? 0), 0),
    },
    paidThisMonth: {
      count: paidThisMonthRows.length,
      totalCents: paidThisMonthRows.reduce((sum, r) => sum + (r.amountCents ?? 0), 0),
    },
  };
}

/**
 * Engine de Annual Report: gera obrigações baseadas no estado da LLC.
 */
import { db } from "@/db";
import { clients, clientLineItems, annualReportObligations } from "@/db/schema";
import { and, eq, sql, isNull, desc } from "drizzle-orm";
import { getAnnualReportRule, hasAnnualReportObligation } from "@/constants/annualReportRules";
import { getStateByCode, findStateByName } from "@/constants/usStates";

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

function dateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Normaliza llcState: aceita código (WY) ou nome (Wyoming) e retorna código.
 */
function normalizeLLCState(state: string | null): string | null {
  if (!state) return null;
  const trimmed = state.trim().toUpperCase();
  // Se já é código válido (2 letras)
  if (trimmed.length === 2 && getStateByCode(trimmed)) {
    return trimmed;
  }
  // Tentar encontrar por nome
  const found = findStateByName(state);
  return found ? found.code : trimmed.length === 2 ? trimmed : null;
}

/**
 * Resolve o estado da LLC para um cliente.
 * Retorna o llcState do item LLC mais recente (por saleDate, fallback createdAt).
 * Normaliza para código (aceita nome ou código).
 */
async function resolveLLCState(clientId: string): Promise<string | null> {
  const llcItems = await db
    .select({
      llcState: clientLineItems.llcState,
      saleDate: clientLineItems.saleDate,
      createdAt: clientLineItems.createdAt,
    })
    .from(clientLineItems)
    .where(
      and(
        eq(clientLineItems.clientId, clientId),
        sql`${clientLineItems.kind} IN ('LLC', 'Llc', 'LLc', 'llc')`,
        sql`${clientLineItems.llcState} IS NOT NULL`
      )
    )
    .orderBy(desc(clientLineItems.saleDate), desc(clientLineItems.createdAt))
    .limit(1);

  if (llcItems.length === 0 || !llcItems[0].llcState) {
    return null;
  }

  return normalizeLLCState(llcItems[0].llcState);
}

/**
 * Calcula a data de formação (formationDate) para um cliente.
 * Usa saleDate do item LLC mais recente, fallback para createdAt do cliente.
 */
async function resolveFormationDate(clientId: string): Promise<Date | null> {
  const llcItem = await db
    .select({
      saleDate: clientLineItems.saleDate,
    })
    .from(clientLineItems)
    .where(
      and(
        eq(clientLineItems.clientId, clientId),
        eq(clientLineItems.kind, "LLC"),
        sql`${clientLineItems.saleDate} IS NOT NULL`
      )
    )
    .orderBy(desc(clientLineItems.saleDate))
    .limit(1);

  if (llcItem.length > 0 && llcItem[0].saleDate) {
    return parseIso(llcItem[0].saleDate);
  }

  const client = await db
    .select({
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (client.length > 0 && client[0].createdAt) {
    return client[0].createdAt;
  }

  return null;
}

/**
 * Calcula o último dia do mês.
 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Calcula o último dia do trimestre.
 */
function getLastDayOfQuarter(year: number, quarter: number): Date {
  const month = quarter * 3 - 1; // 0-indexed: Q1=2, Q2=5, Q3=8, Q4=11
  const day = getLastDayOfMonth(year, month + 1);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Calcula dueDate baseado na regra do estado.
 */
function calculateDueDate(
  rule: ReturnType<typeof getAnnualReportRule>,
  formationDate: Date,
  periodYear: number
): Date | null {
  if (!rule) return null;

  const formationMonth = formationDate.getUTCMonth(); // 0-11
  const formationDay = formationDate.getUTCDate();

  switch (rule.dueType) {
    case "fixed-date":
      if (rule.month == null) return null;
      const fixedDay = rule.day ?? getLastDayOfMonth(periodYear, rule.month);
      return new Date(Date.UTC(periodYear, rule.month - 1, fixedDay));

    case "anniversary-month-end":
      // Último dia do mês de aniversário
      const lastDayEnd = getLastDayOfMonth(periodYear, formationMonth + 1);
      return new Date(Date.UTC(periodYear, formationMonth, lastDayEnd));

    case "anniversary-month-start":
      // 1º dia do mês de aniversário
      return new Date(Date.UTC(periodYear, formationMonth, 1));

    case "anniversary-quarter":
      const quarter = Math.floor(formationMonth / 3) + 1; // 1-4
      return getLastDayOfQuarter(periodYear, quarter);

    case "month-before-anniversary":
      // Mês anterior ao aniversário (último dia do mês anterior)
      const prevMonth = formationMonth === 0 ? 11 : formationMonth - 1;
      const prevYear = formationMonth === 0 ? periodYear - 1 : periodYear;
      const lastDayPrev = getLastDayOfMonth(prevYear, prevMonth + 1);
      return new Date(Date.UTC(prevYear, prevMonth, lastDayPrev));

    case "after-formation-days":
      if (rule.offsetDays == null) return null;
      const baseDate = new Date(formationDate);
      baseDate.setUTCDate(baseDate.getUTCDate() + rule.offsetDays);
      // Para o primeiro ano, usar a data calculada; para anos seguintes, usar mês/dia de formação
      if (periodYear === formationDate.getUTCFullYear()) {
        return baseDate;
      }
      // Anos seguintes (bienal): usar mês de aniversário
      return new Date(Date.UTC(periodYear, formationMonth, formationDay));

    case "fiscal-month-4":
      // Assume ano fiscal = ano calendário (Jan-Dec)
      // 4º mês = Abril, dia especificado na regra ou 1º
      const fiscalDay = rule.day ?? 1;
      return new Date(Date.UTC(periodYear, 3, fiscalDay)); // Abril = mês 3

    default:
      return null;
  }
}

/**
 * Garante obrigações de Annual Report para clientes com LLC.
 */
export async function ensureAnnualReportObligations({
  windowMonths = 6,
}: { windowMonths?: number } = {}): Promise<{ created: number; updated: number }> {
  const today = new Date();
  const todayStr = TODAY_ISO();
  const currentYear = today.getUTCFullYear();
  const windowEnd = new Date(today);
  windowEnd.setUTCMonth(windowEnd.getUTCMonth() + windowMonths);
  const windowEndYear = windowEnd.getUTCFullYear();

  // Buscar clientes ativos (sem deletedAt)
  const activeClients = await db
    .select({
      id: clients.id,
    })
    .from(clients)
    .where(isNull(clients.deletedAt));

  let created = 0;
  let updated = 0;
  let llcWithState = 0;
  let rulesMatched = 0;
  let rulesNoneFrequency = 0;
  const stateCounts: Record<string, number> = {};

  if (process.env.NODE_ENV === "development") {
    console.log("[AnnualReport] Iniciando geração. Clientes ativos:", activeClients.length);
  }

  for (const client of activeClients) {
    const llcState = await resolveLLCState(client.id);
    if (!llcState) continue;

    llcWithState++;
    stateCounts[llcState] = (stateCounts[llcState] || 0) + 1;

    const rule = getAnnualReportRule(llcState);
    if (!rule) continue;

    if (!hasAnnualReportObligation(llcState)) {
      rulesNoneFrequency++;
      continue;
    }

    rulesMatched++;

    const formationDate = await resolveFormationDate(client.id);
    if (!formationDate) continue;

    // Gerar obrigações para os anos no window
    const startYear = currentYear;
    const endYear = windowEndYear + (rule.frequency === "Bienal" ? 1 : 0);

    for (let year = startYear; year <= endYear; year++) {
      // Para bienais, pular anos ímpares após o primeiro
      if (rule.frequency === "Bienal") {
        const formationYear = formationDate.getUTCFullYear();
        const yearsSinceFormation = year - formationYear;
        if (yearsSinceFormation % 2 !== 0) continue;
      }

      const dueDate = calculateDueDate(rule, formationDate, year);
      if (!dueDate) continue;

      const dueDateStr = dateToIso(dueDate);
      const periodYear = dueDate.getUTCFullYear(); // Garantir que periodYear vem do dueDate

      // Verificar se já existe
      const existing = await db
        .select()
        .from(annualReportObligations)
        .where(
          and(
            eq(annualReportObligations.clientId, client.id),
            eq(annualReportObligations.llcState, llcState),
            eq(annualReportObligations.periodYear, periodYear)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        // Criar nova obrigação
        try {
          await db.insert(annualReportObligations).values({
            clientId: client.id,
            llcState,
            frequency: rule.frequency,
            periodYear,
            dueDate: dueDateStr,
            status: "pending",
          });
          created++;
        } catch (err: unknown) {
          if (process.env.NODE_ENV === "development") {
            console.error(`[AnnualReport] Erro ao criar obrigação para cliente ${client.id}, estado ${llcState}, ano ${periodYear}:`, err instanceof Error ? err.message : err);
          }
          // Ignorar constraint violation (já existe)
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg?.includes("unique") && !msg?.includes("duplicate")) {
            throw err;
          }
        }
      } else {
        // Atualizar dueDate se necessário (pode ter mudado a regra)
        if (existing[0].dueDate !== dueDateStr && existing[0].status === "pending") {
          await db
            .update(annualReportObligations)
            .set({ dueDate: dueDateStr, updatedAt: new Date() })
            .where(eq(annualReportObligations.id, existing[0].id));
          updated++;
        }
      }
    }
  }

  // Atualizar status: pending → overdue se dueDate < hoje
  const overdueResult = await db
    .update(annualReportObligations)
    .set({ status: "overdue", updatedAt: new Date() })
    .where(
      and(
        eq(annualReportObligations.status, "pending"),
        sql`${annualReportObligations.dueDate}::text < ${todayStr}`
      )
    );
  updated += overdueResult.rowCount ?? 0;

  // Corrigir overdue → pending se dueDate >= hoje
  const revertResult = await db
    .update(annualReportObligations)
    .set({ status: "pending", updatedAt: new Date() })
    .where(
      and(
        eq(annualReportObligations.status, "overdue"),
        sql`${annualReportObligations.dueDate}::text >= ${todayStr}`
      )
    );
  updated += revertResult.rowCount ?? 0;

  if (process.env.NODE_ENV === "development") {
    console.log("[AnnualReport] Clientes:", activeClients.length, "LLC com estado:", llcWithState, "Regras match:", rulesMatched, "Sem obrigação:", rulesNoneFrequency, "Criadas:", created, "Atualizadas:", updated);
    const topStates = Object.entries(stateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => `${code}:${count}`)
      .join(", ");
    if (topStates) console.log("[AnnualReport] Top estados:", topStates);
  }

  return { created, updated };
}

/**
 * Retorna informações de debug para diagnóstico.
 */
export async function getAnnualReportDebugInfo(): Promise<{
  db: { host: string; port: number; dbName: string };
  counts: {
    totalClientsActive: number;
    totalLineItemsLLC: number;
    totalLLCWithState: number;
    totalRulesMatched: number;
    totalRulesNoneFrequency: number;
    obligationsInDb: number;
  };
  sample: Array<{
    clientId: string;
    companyName: string | null;
    llcState: string | null;
    saleDate: string | null;
    createdAt: Date | null;
  }>;
}> {
  const dbUrl = process.env.DATABASE_URL || "";
  const dbMatch = dbUrl.match(/postgresql:\/\/(?:[^@]+@)?([^:]+):(\d+)\/(.+)(?:\?|$)/);
  const dbInfo = {
    host: dbMatch?.[1] || "unknown",
    port: Number(dbMatch?.[2]) || 5432,
    dbName: dbMatch?.[3] || "unknown",
  };

  const [activeClientsResult, llcItemsResult, llcWithStateResult, obligationsResult, sampleResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(isNull(clients.deletedAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(clientLineItems)
      .where(sql`${clientLineItems.kind} IN ('LLC', 'Llc', 'LLc', 'llc')`),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(clientLineItems)
      .where(
        and(
          sql`${clientLineItems.kind} IN ('LLC', 'Llc', 'LLc', 'llc')`,
          sql`${clientLineItems.llcState} IS NOT NULL`
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualReportObligations),
    db
      .select({
        clientId: clientLineItems.clientId,
        companyName: clients.companyName,
        llcState: clientLineItems.llcState,
        saleDate: clientLineItems.saleDate,
        createdAt: clientLineItems.createdAt,
      })
      .from(clientLineItems)
      .innerJoin(clients, eq(clientLineItems.clientId, clients.id))
      .where(
        and(
          sql`${clientLineItems.kind} IN ('LLC', 'Llc', 'LLc', 'llc')`,
          sql`${clientLineItems.llcState} IS NOT NULL`,
          isNull(clients.deletedAt)
        )
      )
      .orderBy(desc(clientLineItems.saleDate), desc(clientLineItems.createdAt))
      .limit(5),
  ]);

  const sample = sampleResult.map((item) => ({
    clientId: item.clientId,
    companyName: item.companyName,
    llcState: item.llcState,
    saleDate: item.saleDate,
    createdAt: item.createdAt,
  }));

  // Contar regras matched e none frequency
  let rulesMatched = 0;
  let rulesNoneFrequency = 0;
  const llcStates = await db
    .select({ llcState: clientLineItems.llcState })
    .from(clientLineItems)
    .where(
      and(
        sql`${clientLineItems.kind} IN ('LLC', 'Llc', 'LLc', 'llc')`,
        sql`${clientLineItems.llcState} IS NOT NULL`
      )
    );

  for (const item of llcStates) {
    if (!item.llcState) continue;
    const normalized = normalizeLLCState(item.llcState);
    if (!normalized) continue;
    const rule = getAnnualReportRule(normalized);
    if (!rule) continue;
    if (rule.frequency === "Nenhum") {
      rulesNoneFrequency++;
    } else {
      rulesMatched++;
    }
  }

  return {
    db: dbInfo,
    counts: {
      totalClientsActive: activeClientsResult[0]?.count ?? 0,
      totalLineItemsLLC: llcItemsResult[0]?.count ?? 0,
      totalLLCWithState: llcWithStateResult[0]?.count ?? 0,
      totalRulesMatched: rulesMatched,
      totalRulesNoneFrequency: rulesNoneFrequency,
      obligationsInDb: obligationsResult[0]?.count ?? 0,
    },
    sample,
  };
}

/**
 * KPIs executivos do Dashboard Pós-Venda LLC (receita, metas, delta MoM).
 * Período = clients.payment_date (empresas PAGAS no período), alinhado à tabela do dashboard.
 *
 * - Total LLCs (período): COUNT(DISTINCT clients.id) com payment_date no período e pelo menos 1 line_item kind='LLC'.
 * - Receita (período): SUM(li.value_cents) das line_items dessas mesmas empresas (sem duplicar).
 * - Ticket médio: revenue / NULLIF(totalLLCs, 0).
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { monthlyTargets } from "@/db/schema";
import { eq } from "drizzle-orm";

export type LlcExecutiveKpisParams = {
  from?: string;
  to?: string;
  timezone?: string;
};

export type LlcExecutiveKpisResult = {
  range: { from: string; to: string };
  current: { llcs: number; revenueCents: number; avgTicketCents: number };
  previous: { llcs: number; revenueCents: number; avgTicketCents: number };
  mom: {
    llcsPct: number | null;
    revenuePct: number | null;
    avgTicketPct: number | null;
  };
  targets: { llcTarget: number | null; revenueTargetCents: number | null };
  progress: { llcsPct: number | null; revenuePct: number | null };
};

function getDefaultMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

function getPreviousMonthRange(from: string): { from: string; to: string } {
  const start = new Date(from + "T00:00:00");
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  return {
    from: prevStart.toISOString().slice(0, 10),
    to: prevEnd.toISOString().slice(0, 10),
  };
}

/** Retorna o dia seguinte a `dateStr` (YYYY-MM-DD) para uso de intervalo [from, to) exclusivo. */
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Retorna KPIs do período atual e anterior (MoM) + metas do mês.
 * Período definido por clients.payment_date (igual ao filtro "Data pagamento" da tabela do dashboard).
 * Total LLCs = empresas (clientes) pagas no período que têm pelo menos 1 line_item kind='LLC'.
 * Receita = soma dos value_cents de todas as line_items dessas empresas.
 */
export async function getLlcExecutiveKpis(
  params: LlcExecutiveKpisParams
): Promise<LlcExecutiveKpisResult> {
  const { from: paramFrom, to: paramTo } = params;
  const rangeCurrent = paramFrom && paramTo
    ? { from: paramFrom, to: paramTo }
    : getDefaultMonthRange();
  const rangePrev = getPreviousMonthRange(rangeCurrent.from);

  const toExcl = nextDay(rangeCurrent.to);
  const prevToExcl = nextDay(rangePrev.to);

  type CteRow = {
    current_llcs: string;
    current_revenue_cents: string;
    prev_llcs: string;
    prev_revenue_cents: string;
  };

  const cteResult = await db.execute<CteRow>(sql`
    WITH
      params AS (
        SELECT
          ${rangeCurrent.from}::date AS from_ts,
          ${toExcl}::date AS to_excl,
          ${rangePrev.from}::date AS prev_from_ts,
          ${prevToExcl}::date AS prev_to_excl
      ),
      paid_llc_current AS (
        SELECT c.id
        FROM params p
        CROSS JOIN clients c
        WHERE c.deleted_at IS NULL
          AND c.payment_date IS NOT NULL
          AND c.payment_date >= p.from_ts AND c.payment_date < p.to_excl
          AND EXISTS (
            SELECT 1 FROM client_line_items li
            WHERE li.client_id = c.id AND li.kind = 'LLC'
          )
      ),
      paid_llc_prev AS (
        SELECT c.id
        FROM params p
        CROSS JOIN clients c
        WHERE c.deleted_at IS NULL
          AND c.payment_date IS NOT NULL
          AND c.payment_date >= p.prev_from_ts AND c.payment_date < p.prev_to_excl
          AND EXISTS (
            SELECT 1 FROM client_line_items li
            WHERE li.client_id = c.id AND li.kind = 'LLC'
          )
      ),
      current_period AS (
        SELECT
          (SELECT COUNT(*)::int FROM paid_llc_current) AS llcs,
          (SELECT COALESCE(SUM(li.value_cents), 0)::bigint FROM client_line_items li WHERE li.client_id IN (SELECT id FROM paid_llc_current)) AS revenue_cents
      ),
      previous_period AS (
        SELECT
          (SELECT COUNT(*)::int FROM paid_llc_prev) AS llcs,
          (SELECT COALESCE(SUM(li.value_cents), 0)::bigint FROM client_line_items li WHERE li.client_id IN (SELECT id FROM paid_llc_prev)) AS revenue_cents
      )
    SELECT
      (SELECT llcs FROM current_period) AS current_llcs,
      (SELECT revenue_cents FROM current_period) AS current_revenue_cents,
      (SELECT llcs FROM previous_period) AS prev_llcs,
      (SELECT revenue_cents FROM previous_period) AS prev_revenue_cents
  `);

  const row = (cteResult.rows?.[0] ?? null) as CteRow | null;

  const currentLLCs = row ? Number(row.current_llcs) : 0;
  const currentRevenueCents = row ? Number(row.current_revenue_cents) : 0;
  const currentAvgTicketCents = currentLLCs > 0 ? Math.round(currentRevenueCents / currentLLCs) : 0;

  const prevLLCs = row ? Number(row.prev_llcs) : 0;
  const prevRevenueCents = row ? Number(row.prev_revenue_cents) : 0;
  const prevAvgTicketCents = prevLLCs > 0 ? Math.round(prevRevenueCents / prevLLCs) : 0;

  const llcsMoM = prevLLCs !== 0 ? (currentLLCs - prevLLCs) / prevLLCs : null;
  const revenueMoM = prevRevenueCents !== 0 ? (currentRevenueCents - prevRevenueCents) / prevRevenueCents : null;
  const avgTicketMoM = prevAvgTicketCents !== 0 ? (currentAvgTicketCents - prevAvgTicketCents) / prevAvgTicketCents : null;

  const monthKey = rangeCurrent.from.slice(0, 7);
  let llcTarget: number | null = null;
  let revenueTargetCents: number | null = null;
  try {
    const [targetRow] = await db
      .select({
        llcTarget: monthlyTargets.llcTarget,
        revenueTargetCents: monthlyTargets.revenueTargetCents,
      })
      .from(monthlyTargets)
      .where(eq(monthlyTargets.month, monthKey))
      .limit(1);
    llcTarget = targetRow?.llcTarget ?? null;
    revenueTargetCents = targetRow?.revenueTargetCents ?? null;
  } catch (err: unknown) {
    const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
    if (code !== "42P01") throw err;
    // Tabela monthly_targets não existe (migration não aplicada)
  }

  const progressLLCs = llcTarget != null && llcTarget > 0 ? currentLLCs / llcTarget : null;
  const progressRevenue =
    revenueTargetCents != null && revenueTargetCents > 0 ? currentRevenueCents / revenueTargetCents : null;

  return {
    range: rangeCurrent,
    current: {
      llcs: currentLLCs,
      revenueCents: currentRevenueCents,
      avgTicketCents: currentAvgTicketCents,
    },
    previous: {
      llcs: prevLLCs,
      revenueCents: prevRevenueCents,
      avgTicketCents: prevAvgTicketCents,
    },
    mom: {
      llcsPct: llcsMoM,
      revenuePct: revenueMoM,
      avgTicketPct: avgTicketMoM,
    },
    targets: {
      llcTarget: llcTarget ?? null,
      revenueTargetCents: revenueTargetCents ?? null,
    },
    progress: {
      llcsPct: progressLLCs,
      revenuePct: progressRevenue,
    },
  };
}

export type LlcDebugKpisResult = {
  companiesPaidCount: number;
  llcItemsCount: number;
  revenueCents: number;
  criterioDataUsado: "payment_date";
};

/**
 * Números brutos do período para diagnóstico (debug).
 * Reutiliza o mesmo critério: payment_date no período, empresas com ≥1 LLC.
 */
export async function getLlcDebugKpis(
  params: LlcExecutiveKpisParams
): Promise<LlcDebugKpisResult> {
  const { from: paramFrom, to: paramTo } = params;
  const rangeCurrent =
    paramFrom && paramTo
      ? { from: paramFrom, to: paramTo }
      : getDefaultMonthRange();
  const toExcl = nextDay(rangeCurrent.to);

  type DebugRow = {
    companies_paid_count: string;
    llc_items_count: string;
    revenue_cents: string;
  };

  const result = await db.execute<DebugRow>(sql`
    WITH
      params AS (
        SELECT
          ${rangeCurrent.from}::date AS from_ts,
          ${toExcl}::date AS to_excl
      ),
      paid_llc_current AS (
        SELECT c.id
        FROM params p
        CROSS JOIN clients c
        WHERE c.deleted_at IS NULL
          AND c.payment_date IS NOT NULL
          AND c.payment_date >= p.from_ts AND c.payment_date < p.to_excl
          AND EXISTS (
            SELECT 1 FROM client_line_items li
            WHERE li.client_id = c.id AND li.kind = 'LLC'
          )
      ),
      item_counts AS (
        SELECT
          (SELECT COUNT(*)::int FROM paid_llc_current) AS companies_paid_count,
          (SELECT COUNT(*)::int FROM client_line_items li WHERE li.client_id IN (SELECT id FROM paid_llc_current) AND li.kind = 'LLC') AS llc_items_count,
          (SELECT COALESCE(SUM(li.value_cents), 0)::bigint FROM client_line_items li WHERE li.client_id IN (SELECT id FROM paid_llc_current)) AS revenue_cents
      )
    SELECT companies_paid_count::text, llc_items_count::text, revenue_cents::text
    FROM item_counts
  `);

  const row = (result.rows?.[0] ?? null) as DebugRow | null;
  return {
    companiesPaidCount: row ? Number(row.companies_paid_count) : 0,
    llcItemsCount: row ? Number(row.llc_items_count) : 0,
    revenueCents: row ? Number(row.revenue_cents) : 0,
    criterioDataUsado: "payment_date",
  };
}

/**
 * Performance por comercial (LLCs, receita, metas) no período do dashboard.
 * Mesmo critério do executive KPIs: clients.payment_date no período, empresas com ≥1 LLC.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { monthlyTargetsByCommercial } from "@/db/schema";
import { eq } from "drizzle-orm";
import { COMMERCIAL_OPTIONS } from "@/lib/dashboardFilters";

export type CommercialPerformanceParams = {
  from: string;
  to: string;
  commercial?: string | null;
  sdr?: string | null;
  paymentMethod?: string | null;
};

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type CommercialPerformanceRow = {
  commercialId: string;
  commercialName: string;
  current: { llcs: number; revenueCents: number; avgTicketCents: number };
  previous: { llcs: number; revenueCents: number; avgTicketCents: number };
  mom: { llcsPct: number | null; revenuePct: number | null; avgTicketPct: number | null };
  targets: { llcTarget: number | null; revenueTargetCents: number | null };
  progress: { llcsPct: number | null; revenuePct: number | null };
};

type CteRow = {
  commercial: string | null;
  current_llcs: string;
  current_revenue_cents: string;
  prev_llcs: string;
  prev_revenue_cents: string;
};

/**
 * Retorna performance por comercial (current + previous + MoM).
 * Uma query com CTEs; targets carregados em seguida para o mês (monthKey).
 */
export async function getCommercialPerformance(
  params: CommercialPerformanceParams
): Promise<CommercialPerformanceRow[]> {
  const toExcl = nextDay(params.to);
  const prevEnd = new Date(params.from + "T00:00:00");
  prevEnd.setMonth(prevEnd.getMonth() - 1);
  const prevLast = new Date(prevEnd.getFullYear(), prevEnd.getMonth() + 1, 0);
  const prevFirst = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
  const prevFrom = prevFirst.toISOString().slice(0, 10);
  const prevToExcl = nextDay(prevLast.toISOString().slice(0, 10));

  const commercialList = [...COMMERCIAL_OPTIONS];
  const valuesList = sql.join(
    commercialList.map((c) => sql`(${c})`),
    sql`, `
  );
  const cteResult = await db.execute<CteRow>(sql`
    WITH
      params AS (
        SELECT
          ${params.from}::date AS from_ts,
          ${toExcl}::date AS to_excl,
          ${prevFrom}::date AS prev_from_ts,
          ${prevToExcl}::date AS prev_to_excl
      ),
      paid_llc_current AS (
        SELECT c.id AS client_id, c.commercial
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
        SELECT c.id AS client_id, c.commercial
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
      agg_current AS (
        SELECT
          pc.commercial,
          COUNT(*)::int AS llcs,
          COALESCE(SUM(li.value_cents), 0)::bigint AS revenue_cents
        FROM paid_llc_current pc
        JOIN client_line_items li ON li.client_id = pc.client_id
        GROUP BY pc.commercial
      ),
      agg_prev AS (
        SELECT
          pc.commercial,
          COUNT(*)::int AS llcs,
          COALESCE(SUM(li.value_cents), 0)::bigint AS revenue_cents
        FROM paid_llc_prev pc
        JOIN client_line_items li ON li.client_id = pc.client_id
        GROUP BY pc.commercial
      ),
      all_commercials AS (
        SELECT * FROM (VALUES ${valuesList}) AS t(commercial)
      ),
      combined AS (
        SELECT
          ac.commercial,
          COALESCE(cur.llcs, 0)::int AS current_llcs,
          COALESCE(cur.revenue_cents, 0)::bigint AS current_revenue_cents,
          COALESCE(prv.llcs, 0)::int AS prev_llcs,
          COALESCE(prv.revenue_cents, 0)::bigint AS prev_revenue_cents
        FROM all_commercials ac
        LEFT JOIN agg_current cur ON cur.commercial = ac.commercial
        LEFT JOIN agg_prev prv ON prv.commercial = ac.commercial
      )
    SELECT
      commercial,
      current_llcs::text,
      current_revenue_cents::text,
      prev_llcs::text,
      prev_revenue_cents::text
    FROM combined
    ORDER BY current_revenue_cents DESC NULLS LAST
  `);

  const monthKey = params.from.slice(0, 7);
  const targetsMap: Record<string, { llcTarget: number; revenueTargetCents: number }> = {};
  try {
    const targetsRows = await db
      .select({
        commercial: monthlyTargetsByCommercial.commercial,
        llcTarget: monthlyTargetsByCommercial.llcTarget,
        revenueTargetCents: monthlyTargetsByCommercial.revenueTargetCents,
      })
      .from(monthlyTargetsByCommercial)
      .where(eq(monthlyTargetsByCommercial.month, monthKey));
    for (const r of targetsRows) {
      targetsMap[r.commercial] = {
        llcTarget: r.llcTarget,
        revenueTargetCents: r.revenueTargetCents,
      };
    }
  } catch (err: unknown) {
    const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
    if (code !== "42P01") throw err;
  }

  const rows = (cteResult.rows ?? []) as CteRow[];
  return rows.map((r) => {
    const comm = r.commercial ?? "(sem comercial)";
    const currentLLCs = Number(r.current_llcs);
    const currentRevenueCents = Number(r.current_revenue_cents);
    const prevLLCs = Number(r.prev_llcs);
    const prevRevenueCents = Number(r.prev_revenue_cents);
    const currentAvgTicketCents = currentLLCs > 0 ? Math.round(currentRevenueCents / currentLLCs) : 0;
    const prevAvgTicketCents = prevLLCs > 0 ? Math.round(prevRevenueCents / prevLLCs) : 0;
    const llcsMoM = prevLLCs !== 0 ? (currentLLCs - prevLLCs) / prevLLCs : null;
    const revenueMoM = prevRevenueCents !== 0 ? (currentRevenueCents - prevRevenueCents) / prevRevenueCents : null;
    const avgTicketMoM = prevAvgTicketCents !== 0 ? (currentAvgTicketCents - prevAvgTicketCents) / prevAvgTicketCents : null;
    const t = targetsMap[comm] ?? null;
    const llcTarget = t?.llcTarget ?? null;
    const revenueTargetCents = t?.revenueTargetCents ?? null;
    const progressLLCs = llcTarget != null && llcTarget > 0 ? currentLLCs / llcTarget : null;
    const progressRevenue = revenueTargetCents != null && revenueTargetCents > 0 ? currentRevenueCents / revenueTargetCents : null;
    return {
      commercialId: comm,
      commercialName: comm,
      current: { llcs: currentLLCs, revenueCents: currentRevenueCents, avgTicketCents: currentAvgTicketCents },
      previous: { llcs: prevLLCs, revenueCents: prevRevenueCents, avgTicketCents: prevAvgTicketCents },
      mom: { llcsPct: llcsMoM, revenuePct: revenueMoM, avgTicketPct: avgTicketMoM },
      targets: { llcTarget, revenueTargetCents },
      progress: { llcsPct: progressLLCs, revenuePct: progressRevenue },
    };
  });
}

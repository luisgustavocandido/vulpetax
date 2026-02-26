/**
 * Alertas do dashboard (insights do período). Máximo 3–5, objetivos.
 * Reaproveita dados já calculados (executive KPIs + KPIs de mix).
 * CTAs preservam searchParams atuais (dateFrom/dateTo/preset) e adicionam o necessário.
 */

import type { DashboardKPIs } from "@/lib/dashboardQueries";
import type { LlcExecutiveKpisResult } from "@/lib/dashboard/llcExecutiveRepo";
import type { VolumeByCommercial } from "@/lib/dashboardQueries";
import { formatUSD } from "@/lib/dashboardFilters";

const REVENUE_TICKET_MOM_THRESHOLD = 0.15; // 15%
const HOLDING_PCT_THRESHOLD = 5; // % Holding abaixo disso = alerta

export type DashboardAlertCta = {
  label: string;
  href: string;
};

export type DashboardAlert = {
  id: string;
  severity: "info" | "warn" | "success";
  title: string;
  description?: string;
  cta?: DashboardAlertCta;
};

export type DashboardFilterContext = {
  dateFrom: string;
  dateTo: string;
  preset?: string | null;
};

function buildDashboardHref(ctx: DashboardFilterContext, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  p.set("dateFrom", ctx.dateFrom);
  p.set("dateTo", ctx.dateTo);
  if (ctx.preset) p.set("preset", ctx.preset);
  Object.entries(extra).forEach(([k, v]) => p.set(k, v));
  return `/dashboard?${p.toString()}`;
}

function buildEmpresasHref(ctx: DashboardFilterContext): string {
  const p = new URLSearchParams();
  p.set("paymentDateFrom", ctx.dateFrom);
  p.set("paymentDateTo", ctx.dateTo);
  return `/empresas?${p.toString()}`;
}

export function getDashboardAlerts(
  kpis: DashboardKPIs,
  executiveKpis: LlcExecutiveKpisResult,
  byCommercial: VolumeByCommercial[] | undefined,
  filterContext: DashboardFilterContext
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const curRev = formatUSD(executiveKpis.current.revenueCents);
  const prevRev = formatUSD(executiveKpis.previous.revenueCents);
  const curTicket = formatUSD(executiveKpis.current.avgTicketCents);
  const prevTicket = formatUSD(executiveKpis.previous.avgTicketCents);

  const momRev = executiveKpis.mom.revenuePct;
  if (momRev != null && Math.abs(momRev) >= REVENUE_TICKET_MOM_THRESHOLD) {
    const pct = Math.round(momRev * 100);
    alerts.push({
      id: "revenue-mom",
      severity: momRev >= 0 ? "success" : "warn",
      title: pct >= 0 ? `Receita subiu ${pct}% vs mês anterior` : `Receita caiu ${Math.abs(pct)}% vs mês anterior`,
      description: `${curRev} vs ${prevRev}`,
      cta: { label: "Ver clientes", href: buildEmpresasHref(filterContext) },
    });
  }

  const momTicket = executiveKpis.mom.avgTicketPct;
  if (momTicket != null && Math.abs(momTicket) >= REVENUE_TICKET_MOM_THRESHOLD) {
    const pct = Math.round(momTicket * 100);
    alerts.push({
      id: "ticket-mom",
      severity: momTicket >= 0 ? "success" : "warn",
      title: pct >= 0 ? `Ticket médio subiu ${pct}% vs mês anterior` : `Ticket médio caiu ${Math.abs(pct)}% vs mês anterior`,
      description: `${curTicket} vs ${prevTicket}`,
      cta: { label: "Ver detalhes", href: buildDashboardHref(filterContext) },
    });
  }

  if (kpis.holdingPct < HOLDING_PCT_THRESHOLD && kpis.totalClients > 0) {
    alerts.push({
      id: "holding-low",
      severity: "info",
      title: "Holding abaixo do esperado",
      description: `Atual ${kpis.holdingPct.toFixed(1)}% (meta ${HOLDING_PCT_THRESHOLD}%)`,
      // Sem CTA: não existe filtro por Holding na listagem de empresas.
    });
  }

  if (byCommercial && byCommercial.length > 0) {
    const top = byCommercial[0];
    if (top && top.totalCents > 0) {
      const commercialName = top.commercial ?? "(sem comercial)";
      alerts.push({
        id: "top-commercial",
        severity: "info",
        title: `Top comercial do período: ${commercialName}`,
        description: `${formatUSD(top.totalCents)} / ${top.count} LLCs`,
        cta: {
          label: "Ver comercial",
          href: buildDashboardHref(filterContext, { commercial: commercialName }),
        },
      });
    }
  }

  return alerts.slice(0, 5);
}

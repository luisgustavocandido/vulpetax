import Link from "next/link";
import { parseDashboardFilters } from "@/lib/dashboardFilters";
import {
  fetchDashboardKPIs,
  fetchVolumeByCommercial,
  fetchVolumeByPaymentMethod,
  fetchTopCompanies,
  formatUSD,
} from "@/lib/dashboardQueries";
import { getLlcExecutiveKpis, getLlcDebugKpis } from "@/lib/dashboard/llcExecutiveRepo";
import { getCommercialPerformance } from "@/lib/dashboard/llcCommercialRepo";
import { getCurrentUser } from "@/lib/auth";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { CommercialMetaTable } from "@/components/dashboard/CommercialMetaTable";
import { InsightsAlerts } from "@/components/dashboard/InsightsAlerts";
import { getDashboardAlerts } from "@/lib/dashboard/alerts";
import { MixKpiCard } from "@/components/dashboard/MixKpiCard";
import { KpiCardWithDelta } from "@/components/dashboard/KpiCardWithDelta";
import { ProgressKpiCard } from "@/components/dashboard/ProgressKpiCard";
import { AddMonthlyTargetButton } from "@/components/dashboard/AddMonthlyTargetModal";
import { BarChart } from "@/components/dashboard/BarChart";
import { TopCompaniesTable } from "@/components/dashboard/TopCompaniesTable";
import { DashboardDebugSection } from "@/components/dashboard/DashboardDebugSection";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseDashboardFilters(params);

  const executiveParams = {
    from: filters.dateFrom ?? undefined,
    to: filters.dateTo ?? undefined,
  };

  const debugEnabled =
    String(params.debug ?? "") === "1";
  const user = await getCurrentUser();
  const showDebug = debugEnabled && user?.role === "admin";

  const [kpis, executiveKpis, byCommercial, byPaymentMethod, topCompanies, commercialPerformance, debugKpis] =
    await Promise.all([
      fetchDashboardKPIs(filters),
      getLlcExecutiveKpis(executiveParams),
      fetchVolumeByCommercial(filters),
      fetchVolumeByPaymentMethod(filters),
      fetchTopCompanies(filters, 10),
      getCommercialPerformance({
        from: filters.dateFrom!,
        to: filters.dateTo!,
        commercial: filters.commercial ?? null,
        sdr: filters.sdr ?? null,
        paymentMethod: filters.paymentMethod ?? null,
      }),
      showDebug ? getLlcDebugKpis(executiveParams) : Promise.resolve(null),
    ]);

  const maxCommercial = Math.max(...byCommercial.map((c) => c.count), 1);
  const maxPayment = Math.max(...byPaymentMethod.map((p) => p.count), 1);

  const barCommercialItems = byCommercial.map((c) => ({
    label: c.commercial ?? "(sem comercial)",
    count: c.count,
    totalCents: c.totalCents,
  }));
  const barPaymentItems = byPaymentMethod.map((p) => ({
    label: p.paymentMethod ?? "(não definido)",
    count: p.count,
    totalCents: p.totalCents,
  }));

  const filterContext = {
    dateFrom: filters.dateFrom!,
    dateTo: filters.dateTo!,
    preset: filters.preset ?? null,
  };
  const alerts = getDashboardAlerts(kpis, executiveKpis, byCommercial, filterContext);
  const commercialNames = commercialPerformance.map((r) => r.commercialName);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Dashboard Vulpeinc
        </h1>
        <Link
          href="/empresas"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ver clientes
        </Link>
      </div>

      <DashboardFilters values={filters} />
      <InsightsAlerts alerts={alerts} />

      {showDebug && debugKpis && (
        <DashboardDebugSection
          data={debugKpis}
          range={executiveKpis.range}
        />
      )}

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            KPIs
          </h2>
          <AddMonthlyTargetButton
            defaultMonth={executiveKpis.range.from.slice(0, 7)}
            commercialNames={commercialNames}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCardWithDelta
            title="Receita do mês"
            value={formatUSD(executiveKpis.current.revenueCents)}
            deltaPct={executiveKpis.mom.revenuePct}
          />
          <KpiCardWithDelta
            title="Total LLCs (período)"
            value={executiveKpis.current.llcs}
            deltaPct={executiveKpis.mom.llcsPct}
          />
          <KpiCardWithDelta
            title="Ticket médio (período)"
            value={formatUSD(executiveKpis.current.avgTicketCents)}
            deltaPct={executiveKpis.mom.avgTicketPct}
          />
          <ProgressKpiCard
            title="Meta LLCs"
            current={executiveKpis.current.llcs}
            target={executiveKpis.targets.llcTarget}
            progressPct={executiveKpis.progress.llcsPct}
            formatValue={(n) => String(n)}
          />
          <ProgressKpiCard
            title="Meta Receita"
            current={executiveKpis.current.revenueCents}
            target={executiveKpis.targets.revenueTargetCents}
            progressPct={executiveKpis.progress.revenuePct}
            formatValue={formatUSD}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <MixKpiCard
            title="% Express"
            mixKey="express"
            actualPct={kpis.expressPct}
            count={kpis.expressCount}
            total={kpis.totalClients}
          />
          <MixKpiCard
            title="% Holding"
            mixKey="holding"
            actualPct={kpis.holdingPct}
            count={kpis.holdingCount}
            total={kpis.totalClients}
          />
          <MixKpiCard
            title="% Anônimo"
            mixKey="anonymous"
            actualPct={kpis.anonymousPct}
            count={kpis.anonymousCount}
            total={kpis.totalClients}
          />
        </div>
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div>
          <BarChart
            title="Volume por Comercial"
            items={barCommercialItems}
            formatValue={formatUSD}
            maxCount={maxCommercial}
          />
          <CommercialMetaTable rows={commercialPerformance} />
        </div>
        <BarChart
          title="Volume por Método de Pagamento"
          items={barPaymentItems}
          formatValue={formatUSD}
          maxCount={maxPayment}
        />
      </section>

      <section>
        <TopCompaniesTable companies={topCompanies} />
      </section>
    </div>
  );
}

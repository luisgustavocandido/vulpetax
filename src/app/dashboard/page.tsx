import Link from "next/link";
import { parseDashboardFilters } from "@/lib/dashboardFilters";
import {
  fetchDashboardKPIs,
  fetchVolumeByCommercial,
  fetchVolumeByPaymentMethod,
  fetchTopCompanies,
  formatUSD,
} from "@/lib/dashboardQueries";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { KPICard } from "@/components/dashboard/KPICard";
import { BarChart } from "@/components/dashboard/BarChart";
import { TopCompaniesTable } from "@/components/dashboard/TopCompaniesTable";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseDashboardFilters(params);

  const [kpis, byCommercial, byPaymentMethod, topCompanies] =
    await Promise.all([
      fetchDashboardKPIs(filters),
      fetchVolumeByCommercial(filters),
      fetchVolumeByPaymentMethod(filters),
      fetchTopCompanies(filters, 10),
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

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Dashboard Pós-Venda LLC
        </h1>
        <Link
          href="/clients"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ver clientes
        </Link>
      </div>

      <DashboardFilters values={filters} />

      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          KPIs
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KPICard title="Total de LLCs" value={kpis.totalClients} />
          <KPICard
            title="Ticket médio"
            value={formatUSD(kpis.averageTicketCents)}
          />
          <KPICard
            title="% Express"
            value={`${kpis.expressPct.toFixed(1)}%`}
            subtitle={`${kpis.expressCount} de ${kpis.totalClients}`}
          />
          <KPICard
            title="% Holding"
            value={`${kpis.holdingPct.toFixed(1)}%`}
            subtitle={`${kpis.holdingCount} de ${kpis.totalClients}`}
          />
          <KPICard
            title="% Anônimo"
            value={`${kpis.anonymousPct.toFixed(1)}%`}
            subtitle={`${kpis.anonymousCount} de ${kpis.totalClients}`}
          />
        </div>
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <BarChart
          title="Volume por Comercial"
          items={barCommercialItems}
          formatValue={formatUSD}
          maxCount={maxCommercial}
        />
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

import { requireFinanceSession } from "@/lib/financeDashboardAuth";
import {
  getFinanceSummary,
  getFinanceRevenueSeries,
  getTopOverdueCharges,
} from "@/lib/financeDashboardQueries";
import { formatUSD } from "@/lib/dashboardFilters";
import Link from "next/link";
import { FinanceRevenueChart } from "./FinanceRevenueChart";

export const dynamic = "force-dynamic";

function formatDate(s: string): string {
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default async function DashboardFinanceiroHomePage() {
  await requireFinanceSession();

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const [summary, revenueSeries, topOverdue] = await Promise.all([
    getFinanceSummary(month),
    getFinanceRevenueSeries(12),
    getTopOverdueCharges(10),
  ]);

  const arTotal = summary.arPendingCents + summary.arOverdueCents;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">
        Dashboard Financeira
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Visão executiva de receita, MRR, contas a receber e inadimplência.
      </p>

      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Resumo
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">
              Receita MTD
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatUSD(summary.revenueMTDCents)}
            </p>
            {summary.revenueMoMPercent !== null && (
              <p
                className={`mt-0.5 text-xs ${
                  summary.revenueMoMPercent >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {summary.revenueMoMPercent >= 0 ? "+" : ""}
                {summary.revenueMoMPercent.toFixed(1)}% vs mês anterior
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">
              MRR (estimado)
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatUSD(summary.mrrCents)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Cobranças mensais pagas (últimos 30 dias)
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">
              A receber
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatUSD(arTotal)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Pendente: {formatUSD(summary.arPendingCents)} · Atrasado:{" "}
              {formatUSD(summary.arOverdueCents)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-500">
              Inadimplência
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {summary.delinquencyPercent.toFixed(1)}%
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Atrasado / (Pendente + Atrasado)
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <FinanceRevenueChart
          title="Receita por mês"
          subtitle="Últimos 12 meses · cobranças pagas"
          points={revenueSeries}
          height={220}
        />
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Maiores cobranças em atraso
          </h2>
          <Link
            href="/billing?tab=addresses&status=overdue"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Ver lista filtrada
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Empresa
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  Valor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Vencimento
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  Dias em atraso
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  Ver
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {topOverdue.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    Nenhuma cobrança em atraso.
                  </td>
                </tr>
              ) : (
                topOverdue.map((row) => (
                  <tr key={row.chargeId} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                      {row.clientName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-900">
                      {formatUSD(row.amountCents)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {formatDate(row.dueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-600">
                      {row.daysOverdue}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <Link
                        href={`/billing?tab=addresses&status=overdue`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

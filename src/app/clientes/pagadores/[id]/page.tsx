import Link from "next/link";
import { headers } from "next/headers";
import { getBaseUrlFromHeaders } from "@/lib/api";
import { notFound } from "next/navigation";
import { formatUSD } from "@/lib/dashboardFilters";
import { CustomerServicesSection } from "./CustomerServicesSection";
import { CustomerChargesSection } from "./CustomerChargesSection";
import { ClientePagadorDeleteButton } from "./ClientePagadorDeleteButton";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  const part = String(s).slice(0, 10);
  const [y, m, d] = part.split("-");
  return `${d}/${m}/${y}`;
}

export default async function ClientePagadorDetailPage({ params }: PageProps) {
  const { id: customerId } = await params;
  const headersList = await headers();
  const base = getBaseUrlFromHeaders(headersList);
  const cookie = headersList.get("cookie") ?? "";

  const [overviewRes, companiesRes, billingOverviewRes] = await Promise.all([
    fetch(`${base}/api/customers/${encodeURIComponent(customerId)}/overview`, {
      cache: "no-store",
      headers: { cookie },
    }),
    fetch(
      `${base}/api/customers/${encodeURIComponent(customerId)}/companies?page=1&limit=20`,
      { cache: "no-store", headers: { cookie } }
    ),
    fetch(`${base}/api/customers/${encodeURIComponent(customerId)}/billing/overview`, {
      cache: "no-store",
      headers: { cookie },
    }),
  ]);

  if (!overviewRes.ok) {
    if (overviewRes.status === 404) notFound();
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">Erro ao carregar cliente</p>
          <Link
            href="/clientes?tab=customers"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            ← Voltar para Clientes (Pagadores)
          </Link>
        </div>
      </div>
    );
  }

  const overview = (await overviewRes.json()) as {
    customer: {
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
    };
    totals: {
      companies: number;
      services: number;
      totalSpentCents: number;
      avgTicketCents: number;
      lastServiceAt: string | null;
      lastServiceDescription: string | null;
    };
    breakdown: { byKind: unknown[]; byCompany: unknown[] };
  };

  const companiesData = companiesRes.ok
    ? ((await companiesRes.json()) as {
        items: Array<{
          id: string;
          companyName: string;
          code: string;
          paymentDate: string | null;
          updatedAt: string | null;
        }>;
        total: number;
      })
    : { items: [] as Array<{ id: string; companyName: string; code: string; paymentDate: string | null; updatedAt: string | null }>, total: 0 };

  type BillingOverview = {
    totals: {
      billedCents: number;
      paidCents: number;
      openCents: number;
      paidPct: number;
      overdueCents: number;
      overdueCount: number;
      nextDueAt: string | null;
      nextDueCents: number | null;
    };
    breakdown: { byStatus: Array<{ status: string; count: number; totalCents: number; paidCents: number }> };
  };
  const billingOverview: BillingOverview = billingOverviewRes.ok
    ? ((await billingOverviewRes.json()) as BillingOverview)
    : {
        totals: {
          billedCents: 0,
          paidCents: 0,
          openCents: 0,
          paidPct: 0,
          overdueCents: 0,
          overdueCount: 0,
          nextDueAt: null,
          nextDueCents: null,
        },
        breakdown: { byStatus: [] },
      };

  const { customer, totals } = overview;
  const addressParts = [customer.addressLine1, customer.addressLine2, customer.city, customer.stateProvince, customer.postalCode, customer.country].filter(Boolean);
  const addressStr = addressParts.length ? addressParts.join(", ") : "—";

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/clientes?tab=customers"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Voltar para Clientes (Pagadores)
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{customer.fullName}</h1>
            <p className="mt-1 text-sm text-gray-600">{customer.email}</p>
            {customer.phone && (
              <p className="text-sm text-gray-600">{customer.phone}</p>
            )}
            <p className="mt-1 max-w-md text-sm text-gray-500">{addressStr}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clientes/pagadores/${encodeURIComponent(customerId)}/editar`}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Editar cliente
            </Link>
            <ClientePagadorDeleteButton id={customerId} customerName={customer.fullName} />
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Empresas vinculadas</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{totals.companies}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Serviços fechados</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{totals.services}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Total gasto (USD)</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatUSD(totals.totalSpentCents)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Ticket médio</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {totals.services > 0 ? formatUSD(totals.avgTicketCents) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Último serviço</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {totals.lastServiceAt ? formatDate(totals.lastServiceAt) : "—"}
          </p>
          {totals.lastServiceDescription && (
            <p className="mt-0.5 truncate text-xs text-gray-600" title={totals.lastServiceDescription}>
              {totals.lastServiceDescription}
            </p>
          )}
        </div>
      </div>

      {/* Empresas vinculadas */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Empresas vinculadas</h2>
          <Link
            href={`/empresas?customerId=${encodeURIComponent(customer.id)}`}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          {companiesData.items.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              Nenhuma empresa vinculada.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Empresa
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Código
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Data pagamento
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {companiesData.items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                      {c.companyName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                      {c.code}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                      {c.paymentDate ? formatDate(c.paymentDate) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                      <Link
                        href={`/empresas/${encodeURIComponent(c.id)}`}
                        className="text-indigo-600 hover:underline"
                      >
                        Abrir empresa
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Cobranças (métricas + lista paginada) */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Cobranças</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Total faturado</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">
              {formatUSD(billingOverview.totals.billedCents)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Total pago</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">
              {formatUSD(billingOverview.totals.paidCents)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Em aberto</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">
              {formatUSD(billingOverview.totals.openCents)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">% pago</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">
              {billingOverview.totals.billedCents > 0
                ? `${Math.round(billingOverview.totals.paidPct * 100)}%`
                : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Próximo vencimento</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {billingOverview.totals.nextDueAt ? formatDate(billingOverview.totals.nextDueAt) : "Sem vencimentos"}
            </p>
            {billingOverview.totals.nextDueCents != null && (
              <p className="mt-0.5 text-sm text-gray-600">
                {formatUSD(billingOverview.totals.nextDueCents)}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Atrasadas</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">
              {billingOverview.totals.overdueCount}
            </p>
            <p className="mt-0.5 text-sm text-gray-600">
              {formatUSD(billingOverview.totals.overdueCents)}
            </p>
          </div>
        </div>
        {/* Conciliação: delta serviços vs cobranças (billed - spent) */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase text-gray-500">Conciliação</p>
          <p className="mt-1 text-sm text-gray-700">
            Serviços (fechados): {formatUSD(totals.totalSpentCents)} · Cobranças (faturado):{" "}
            {formatUSD(billingOverview.totals.billedCents)} · Delta (cobrado − serviços):{" "}
            <span className="font-medium">
              {formatUSD(billingOverview.totals.billedCents - totals.totalSpentCents)}
            </span>
          </p>
        </div>
        <CustomerChargesSection customerId={customerId} />
      </section>

      {/* Serviços fechados (filtros + tabela paginada via API) */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Serviços fechados</h2>
        <CustomerServicesSection customerId={customerId} />
      </section>
    </div>
  );
}

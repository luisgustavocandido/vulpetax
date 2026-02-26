import Link from "next/link";
import { headers } from "next/headers";
import { getBaseUrlFromHeaders } from "@/lib/api";
import type { PersonDashboardPayload } from "@/lib/persons/schemas";

type PageProps = {
  params: Promise<{ personGroupId: string }>;
};

function statusBadgeProcess(status: "open" | "in_progress" | "done") {
  if (status === "done") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Concluído
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Em andamento
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      Em aberto
    </span>
  );
}

function statusBadgeAnnualReport(status: string) {
  if (status === "done") {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Concluído
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        Atrasado
      </span>
    );
  }
  if (status === "canceled") {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        Cancelado
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      Pendente
    </span>
  );
}

function statusBadgeCharge(status: string) {
  if (status === "paid") {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Paga
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        Atrasada
      </span>
    );
  }
  if (status === "canceled") {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        Cancelada
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      Pendente
    </span>
  );
}

export default async function PersonDashboardPage({ params }: PageProps) {
  const { personGroupId } = await params;
  const headersList = await headers();
  const base = getBaseUrlFromHeaders(headersList);
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${base}/api/persons/${personGroupId}/dashboard`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-red-600">Grupo da pessoa não encontrado ou sem empresas.</p>
          <Link href="/empresas" className="mt-2 inline-block text-indigo-600 hover:underline">
            Voltar para empresas
          </Link>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-600">Erro ao carregar painel.</p>
        <Link href="/empresas" className="mt-2 inline-block text-indigo-600 hover:underline">
          Voltar para empresas
        </Link>
      </div>
    );
  }

  const data = (await res.json()) as PersonDashboardPayload;
  const { companies, processes, annualReports, addressCharges } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pessoa</h1>
          <p className="mt-1 text-sm text-gray-500">
            personGroupId: {data.personGroupId}
          </p>
        </div>
        <Link
          href={`/empresas/person/${data.personGroupId}`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ver empresas
        </Link>
      </header>

      {/* Cards de resumo */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Resumo</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Empresas</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{companies.total}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Processos LLC (abertos)</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{processes.totals.open}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <p className="text-sm font-medium text-amber-700">Processos (em andamento)</p>
            <p className="mt-1 text-2xl font-semibold text-amber-900">{processes.totals.in_progress}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">Processos (concluídos)</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">{processes.totals.done}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Annual Reports (pendentes)</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{annualReports.totals.pending}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 shadow-sm">
            <p className="text-sm font-medium text-red-700">Annual Reports (atrasados)</p>
            <p className="mt-1 text-2xl font-semibold text-red-900">{annualReports.totals.overdue}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Cobranças (pendentes)</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{addressCharges.totals.pending}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 shadow-sm">
            <p className="text-sm font-medium text-red-700">Cobranças (atrasadas)</p>
            <p className="mt-1 text-2xl font-semibold text-red-900">{addressCharges.totals.overdue}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Cobranças (pagas)</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{addressCharges.totals.paid}</p>
          </div>
        </div>
      </section>

      {/* Empresas */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Empresas</h2>
          {companies.total > companies.items.length && (
            <Link
              href={`/empresas/person/${data.personGroupId}`}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Ver todas
            </Link>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {companies.items.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Nenhuma empresa.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Empresa</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Código</th>
                  <th className="relative px-4 py-2"><span className="sr-only">Ação</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {companies.items.map((c) => (
                  <tr key={c.clientId}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{c.companyName}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{c.customerCode ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      <Link href={`/empresas/${c.clientId}`} className="font-medium text-indigo-600 hover:underline">
                        Ver cliente
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Processos em andamento */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Processos em andamento</h2>
          <Link
            href="/processos"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Ver processos
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {processes.items.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Nenhum processo em andamento.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Empresa</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Progresso</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Etapa</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="relative px-4 py-2"><span className="sr-only">Ação</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {processes.items.map((p) => (
                  <tr key={p.processId}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.companyName ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{p.progressPct}%</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{p.currentStageTitle ?? "—"}</td>
                    <td className="px-4 py-2">{statusBadgeProcess(p.status)}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      <Link href={`/processos/${p.processId}`} className="font-medium text-indigo-600 hover:underline">
                        Abrir processo
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Annual Reports próximos */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Annual Reports próximos</h2>
          <Link
            href="/billing?tab=annual-reports"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Abrir billing
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {annualReports.items.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Nenhum pendente ou atrasado.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Empresa</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Ano</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Vencimento</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="relative px-4 py-2"><span className="sr-only">Ação</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {annualReports.items.map((ar) => (
                  <tr key={ar.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{ar.companyName ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{ar.llcState}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{ar.periodYear}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{ar.dueDate}</td>
                    <td className="px-4 py-2">{statusBadgeAnnualReport(ar.status)}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      <Link href="/billing?tab=annual-reports" className="font-medium text-indigo-600 hover:underline">
                        Abrir billing
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Cobranças próximas */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Cobranças próximas</h2>
          <Link
            href="/billing?tab=addresses"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Abrir billing
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {addressCharges.items.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Nenhuma pendente ou atrasada.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Empresa</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Endereço / Provider</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Vencimento</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="relative px-4 py-2"><span className="sr-only">Ação</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {addressCharges.items.map((ch) => (
                  <tr key={ch.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{ch.companyName ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {ch.addressProvider ?? ch.addressLine1 ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{ch.dueDate ?? "—"}</td>
                    <td className="px-4 py-2">{statusBadgeCharge(ch.status)}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      <Link href="/billing?tab=addresses" className="font-medium text-indigo-600 hover:underline">
                        Abrir billing
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="mt-6">
        <Link
          href="/empresas"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Voltar para empresas
        </Link>
      </div>
    </div>
  );
}

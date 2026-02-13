import Link from "next/link";
import { headers } from "next/headers";
import { getBaseUrl } from "@/lib/api";
import { TaxSyncPanel } from "@/components/tax/TaxSyncPanel";
import { TaxRemoveButton } from "@/components/tax/TaxRemoveButton";
import { TaxPageHeaderActions } from "@/components/tax/TaxPageHeaderActions";

type TaxRow = {
  clientId: string;
  companyName: string;
  customerCode: string;
  status: string;
  alertsCount: number;
  aggregateBalanceOver10k: boolean;
  hasUsBankAccounts: boolean;
  updatedAt: string | null;
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TaxListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  if (params.status && typeof params.status === "string") sp.set("status", params.status);
  if (params.aggregateBalanceOver10k === "true") sp.set("aggregateBalanceOver10k", "true");
  if (params.hasUsBankAccounts === "true") sp.set("hasUsBankAccounts", "true");

  const base = getBaseUrl();
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";
  const res = await fetch(`${base}/api/tax?${sp.toString()}`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-red-600">Erro ao carregar casos TAX.</p>
      </div>
    );
  }

  const { data } = await res.json();
  const list: TaxRow[] = data ?? [];

  const statusBadge = (s: string) => {
    const cls =
      s === "PRONTO_PARA_ENVIO"
        ? "bg-green-100 text-green-800"
        : s === "PENDENTE"
          ? "bg-blue-100 text-blue-800"
          : "bg-amber-100 text-amber-800";
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{s.replace(/_/g, " ")}</span>;
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      {typeof params.taxRemoved === "string" && params.taxRemoved === "1" && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-800">
          TAX removido. O cliente não aparecerá mais na lista TAX.
        </div>
      )}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">TAX (Não Residentes)</h1>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              Fonte: Google Sheets + manuais
            </span>
          </div>
          <TaxPageHeaderActions />
        </div>
        <TaxSyncPanel />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <form method="GET" className="flex gap-2">
          <select
            name="status"
            defaultValue={typeof params.status === "string" ? params.status : ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="INCOMPLETO">Incompleto</option>
            <option value="PENDENTE">Pendente</option>
            <option value="PRONTO_PARA_ENVIO">Pronto para envio</option>
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              name="aggregateBalanceOver10k"
              value="true"
              defaultChecked={params.aggregateBalanceOver10k === "true"}
              className="rounded border-slate-300"
            />
            FBAR (&gt;10k)
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              name="hasUsBankAccounts"
              value="true"
              defaultChecked={params.hasUsBankAccounts === "true"}
              className="rounded border-slate-300"
            />
            Com conta EUA
          </label>
          <button type="submit" className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
            Filtrar
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">Empresa</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">Código</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">Alertas</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">FBAR</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">Atualizado</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-slate-500">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {list.map((row) => (
              <tr key={row.clientId} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-sm text-slate-900">{row.companyName}</td>
                <td className="px-4 py-2 text-sm text-slate-600">{row.customerCode}</td>
                <td className="px-4 py-2">{statusBadge(row.status)}</td>
                <td className="px-4 py-2 text-sm text-slate-600">{row.alertsCount}</td>
                <td className="px-4 py-2">
                  {row.aggregateBalanceOver10k && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">FBAR</span>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-slate-500">
                  {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/clients/${row.clientId}/tax`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Abrir
                    </Link>
                    <TaxRemoveButton
                      clientId={row.clientId}
                      customerCode={row.customerCode}
                      companyName={row.companyName}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhum caso encontrado.</div>
        )}
      </div>
    </div>
  );
}

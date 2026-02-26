"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatUSD } from "@/lib/dashboardFilters";

const LINE_ITEM_KINDS = [
  "LLC",
  "Endereco",
  "Mensalidade",
  "Gateway",
  "ServicoAdicional",
  "BancoTradicional",
  "Outro",
] as const;

const SORT_OPTIONS = [
  { value: "saleDate_desc", label: "Data (mais recente)" },
  { value: "saleDate_asc", label: "Data (mais antigo)" },
  { value: "value_desc", label: "Valor (maior)" },
  { value: "value_asc", label: "Valor (menor)" },
] as const;

type ServiceItem = {
  lineItemId: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  kind: string;
  llcCategory: string | null;
  llcState: string | null;
  billingPeriod: string | null;
  addressProvider: string | null;
  valueCents: number;
  saleDate: string | null;
  commercial: string | null;
  sdr: string | null;
  description: string;
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  const part = String(s).slice(0, 10);
  const [y, m, d] = part.split("-");
  return `${d}/${m}/${y}`;
}

type CustomerServicesSectionProps = {
  customerId: string;
};

export function CustomerServicesSection({ customerId }: CustomerServicesSectionProps) {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [state, setState] = useState("");
  const [saleFrom, setSaleFrom] = useState("");
  const [saleTo, setSaleTo] = useState("");
  const [sort, setSort] = useState("saleDate_desc");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    items: ServiceItem[];
    total: number;
    page: number;
    limit: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(
    async (overrides?: { page?: number }) => {
      setLoading(true);
      setError(null);
      const p = overrides?.page ?? page;
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", String(limit));
      params.set("sort", sort);
    if (q.trim()) params.set("q", q.trim());
    if (kind.trim()) params.set("kind", kind.trim());
    if (state.trim()) params.set("state", state.trim().toUpperCase().slice(0, 2));
    if (saleFrom.trim()) params.set("saleFrom", saleFrom.trim());
    if (saleTo.trim()) params.set("saleTo", saleTo.trim());

    try {
      const res = await fetch(
        `/api/customers/${encodeURIComponent(customerId)}/services?${params.toString()}`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "Erro ao carregar serviços");
        setData(null);
        return;
      }
      const json = (await res.json()) as {
        items: ServiceItem[];
        total: number;
        page: number;
        limit: number;
      };
      setData(json);
    } catch {
      setError("Erro de conexão");
      setData(null);
    } finally {
      setLoading(false);
    }
  },
    [customerId, page, limit, sort, q, kind, state, saleFrom, saleTo]
  );

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    // useEffect will refetch when page updates to 1
  };

  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <form
        onSubmit={applyFilters}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
      >
        <div>
          <label htmlFor="svc-q" className="block text-xs font-medium text-gray-600">
            Busca (empresa/tipo)
          </label>
          <input
            id="svc-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 block w-40 rounded border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Texto..."
          />
        </div>
        <div>
          <label htmlFor="svc-kind" className="block text-xs font-medium text-gray-600">
            Tipo
          </label>
          <select
            id="svc-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="mt-1 block w-36 rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {LINE_ITEM_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="svc-state" className="block text-xs font-medium text-gray-600">
            Estado (LLC)
          </label>
          <input
            id="svc-state"
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
            className="mt-1 block w-20 rounded border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="ex: WY"
            maxLength={2}
          />
        </div>
        <div>
          <label htmlFor="svc-saleFrom" className="block text-xs font-medium text-gray-600">
            Data venda (de)
          </label>
          <input
            id="svc-saleFrom"
            type="date"
            value={saleFrom}
            onChange={(e) => setSaleFrom(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="svc-saleTo" className="block text-xs font-medium text-gray-600">
            Data venda (até)
          </label>
          <input
            id="svc-saleTo"
            type="date"
            value={saleTo}
            onChange={(e) => setSaleTo(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="svc-sort" className="block text-xs font-medium text-gray-600">
            Ordenar
          </label>
          <select
            id="svc-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="mt-1 block w-40 rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Filtrar
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Carregando serviços...
        </div>
      )}

      {!loading && data && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Nenhum serviço encontrado com os filtros aplicados.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Empresa
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Tipo
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Categoria / Estado
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Valor (USD)
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Data venda
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Comercial / SDR
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map((row) => (
                    <tr key={row.lineItemId} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <Link
                          href={`/empresas/${encodeURIComponent(row.companyId)}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {row.companyName}
                        </Link>
                        <span className="ml-1 text-gray-500">({row.companyCode})</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                        {row.kind}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                        {row.kind === "LLC"
                          ? [row.llcCategory, row.llcState].filter(Boolean).join(" / ") || "—"
                          : row.kind === "Endereco"
                            ? row.addressProvider ?? row.billingPeriod ?? "—"
                            : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {formatUSD(row.valueCents)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                        {formatDate(row.saleDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                        {[row.commercial, row.sdr].filter(Boolean).join(" / ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {total > limit && (
            <nav className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-600">
                Página {page} de {Math.ceil(total / limit) || 1}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / limit)}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  Próximo
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

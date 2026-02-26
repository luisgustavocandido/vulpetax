"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatUSD } from "@/lib/dashboardFilters";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Atrasada" },
  { value: "canceled", label: "Cancelada" },
] as const;

const SORT_OPTIONS = [
  { value: "dueDate_desc", label: "Vencimento (mais recente)" },
  { value: "dueDate_asc", label: "Vencimento (mais próximo)" },
  { value: "value_desc", label: "Valor (maior)" },
  { value: "value_asc", label: "Valor (menor)" },
  { value: "createdAt_desc", label: "Criado em (mais recente)" },
  { value: "createdAt_asc", label: "Criado em (mais antigo)" },
] as const;

type ChargeItem = {
  chargeId: string;
  companyId: string;
  companyName: string;
  companyCode: string | null;
  status: string;
  amountCents: number;
  paidCents: number | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  gateway: string | null;
  method: string | null;
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  const part = String(s).slice(0, 10);
  const [y, m, d] = part.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTime(s: string | null): string {
  if (!s) return "—";
  const part = String(s).slice(0, 10);
  const [y, m, d] = part.split("-");
  const dateStr = `${d}/${m}/${y}`;
  if (s.length <= 10) return dateStr;
  const timePart = s.includes("T") ? s.split("T")[1]?.slice(0, 5) : "";
  return timePart ? `${dateStr} ${timePart}` : dateStr;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pendente",
    paid: "Pago",
    overdue: "Atrasada",
    canceled: "Cancelada",
  };
  return map[status] ?? status;
}

type CustomerChargesSectionProps = {
  customerId: string;
};

export function CustomerChargesSection({ customerId }: CustomerChargesSectionProps) {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [paidFrom, setPaidFrom] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [sort, setSort] = useState("dueDate_desc");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    items: ChargeItem[];
    total: number;
    page: number;
    limit: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCharges = useCallback(
    async (overrides?: { page?: number }) => {
      setLoading(true);
      setError(null);
      const p = overrides?.page ?? page;
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", String(limit));
      params.set("sort", sort);
      if (q.trim()) params.set("q", q.trim());
      if (status.trim()) params.set("status", status.trim());
      if (dueFrom.trim()) params.set("dueFrom", dueFrom.trim());
      if (dueTo.trim()) params.set("dueTo", dueTo.trim());
      if (paidFrom.trim()) params.set("paidFrom", paidFrom.trim());
      if (paidTo.trim()) params.set("paidTo", paidTo.trim());

      try {
        const res = await fetch(
          `/api/customers/${encodeURIComponent(customerId)}/billing/charges?${params.toString()}`
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError((j as { error?: string }).error ?? "Erro ao carregar cobranças");
          setData(null);
          return;
        }
        const json = (await res.json()) as {
          items: ChargeItem[];
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
    [customerId, page, limit, sort, q, status, dueFrom, dueTo, paidFrom, paidTo]
  );

  useEffect(() => {
    fetchCharges();
  }, [fetchCharges]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
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
          <label htmlFor="ch-q" className="block text-xs font-medium text-gray-600">
            Busca (empresa, código, ID)
          </label>
          <input
            id="ch-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 block w-40 rounded border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Texto..."
          />
        </div>
        <div>
          <label htmlFor="ch-status" className="block text-xs font-medium text-gray-600">
            Status
          </label>
          <select
            id="ch-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-32 rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ch-dueFrom" className="block text-xs font-medium text-gray-600">
            Vencimento (de)
          </label>
          <input
            id="ch-dueFrom"
            type="date"
            value={dueFrom}
            onChange={(e) => setDueFrom(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ch-dueTo" className="block text-xs font-medium text-gray-600">
            Vencimento (até)
          </label>
          <input
            id="ch-dueTo"
            type="date"
            value={dueTo}
            onChange={(e) => setDueTo(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ch-paidFrom" className="block text-xs font-medium text-gray-600">
            Pago (de)
          </label>
          <input
            id="ch-paidFrom"
            type="date"
            value={paidFrom}
            onChange={(e) => setPaidFrom(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ch-paidTo" className="block text-xs font-medium text-gray-600">
            Pago (até)
          </label>
          <input
            id="ch-paidTo"
            type="date"
            value={paidTo}
            onChange={(e) => setPaidTo(e.target.value)}
            className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ch-sort" className="block text-xs font-medium text-gray-600">
            Ordenar
          </label>
          <select
            id="ch-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="mt-1 block w-44 rounded border border-gray-300 px-2 py-1.5 text-sm"
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
          Carregando cobranças...
        </div>
      )}

      {!loading && data && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Nenhuma cobrança encontrada com os filtros aplicados.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Empresa
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Valor (USD)
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Vencimento
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Pago em
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Gateway / Método
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Criado em
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map((row) => (
                    <tr key={row.chargeId} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <Link
                          href={`/empresas/${encodeURIComponent(row.companyId)}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {row.companyName}
                        </Link>
                        {row.companyCode && (
                          <span className="ml-1 text-gray-500">({row.companyCode})</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                        {statusLabel(row.status)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                        {formatUSD(row.amountCents)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                        {formatDate(row.dueDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                        {row.paidAt ? formatDateTime(row.paidAt) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                        {[row.gateway, row.method].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                        <Link
                          href={`/empresas/${encodeURIComponent(row.companyId)}`}
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

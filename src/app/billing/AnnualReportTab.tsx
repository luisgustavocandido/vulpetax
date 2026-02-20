"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getStateByCode, US_STATES } from "@/constants/usStates";

type AnnualReportRow = {
  id: string;
  clientId: string;
  llcState: string;
  frequency: string;
  periodYear: number;
  dueDate: string;
  status: string;
  doneAt: string | null;
  notes: string | null;
  companyName: string | null;
};

type Meta = {
  page: number;
  limit: number;
  total: number;
  totals: {
    pending: number;
    overdue: number;
    done: number;
  };
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  const part = String(s).slice(0, 10);
  const [y, m, d] = part.split("-");
  return `${d}/${m}/${y}`;
}

function statusLabel(s: string): string {
  if (s === "done") return "Concluído";
  if (s === "canceled") return "Cancelado";
  if (s === "overdue") return "Atrasado";
  if (s === "pending") return "Pendente";
  return s;
}

function statusClass(s: string): string {
  if (s === "done") return "bg-green-100 text-green-800";
  if (s === "canceled") return "bg-slate-100 text-slate-600";
  if (s === "overdue") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

export function AnnualReportTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ data: AnnualReportRow[]; meta: Meta } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const qRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = searchParams.get("arStatus") ?? "pending,overdue";
  const frequency = searchParams.get("arFrequency") ?? "";
  const state = searchParams.get("arState") ?? "";
  const year = searchParams.get("arYear") ?? "";
  const sort = searchParams.get("arSort") ?? "";
  const from = searchParams.get("arFrom") ?? "";
  const to = searchParams.get("arTo") ?? "";
  const qParam = searchParams.get("arQ") ?? "";
  const page = Math.max(1, Number(searchParams.get("arPage")) || 1);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("arLimit")) || 20));

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("status", status);
    if (frequency) params.set("frequency", frequency);
    if (state) params.set("state", state);
    if (year) params.set("year", year);
    if (sort) params.set("sort", sort);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (qRef.current) params.set("q", qRef.current);
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("windowMonths", "12");
    try {
      const res = await fetch(`/api/billing/annual-reports?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Erro ao carregar");
      }
      const json = await res.json();
      setData({
        data: json.data ?? [],
        meta: json.meta ?? {
          page: 1,
          limit: 20,
          total: 0,
          totals: { pending: 0, overdue: 0, done: 0 },
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar obrigações");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status, frequency, state, year, sort, from, to, page, limit]);

  useEffect(() => {
    qRef.current = qParam;
    fetchReports();
  }, [fetchReports, qParam]);

  const debouncedSetQuery = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const u = new URLSearchParams(searchParams.toString());
      if (value.trim()) u.set("arQ", value.trim());
      else u.delete("arQ");
      u.delete("arPage");
      router.push(`/billing?${u.toString()}`);
      debounceRef.current = null;
    }, 300);
  }, [router, searchParams]);

  async function handleMarkDone(id: string) {
    try {
      const res = await fetch(`/api/billing/annual-reports/${id}/done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Falha ao marcar como concluído");
      setToast({ type: "success", message: "Obrigação marcada como concluída." });
      fetchReports();
      router.refresh();
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Erro" });
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancelar esta obrigação?")) return;
    try {
      const res = await fetch(`/api/billing/annual-reports/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Falha ao cancelar");
      setToast({ type: "success", message: "Obrigação cancelada." });
      fetchReports();
      router.refresh();
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Erro" });
    }
  }

  async function handleReopen(id: string) {
    if (!confirm("Reabrir esta obrigação?")) return;
    try {
      const res = await fetch(`/api/billing/annual-reports/${id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Falha ao reabrir");
      setToast({ type: "success", message: "Obrigação reaberta." });
      fetchReports();
      router.refresh();
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Erro" });
    }
  }

  function handleRefresh() {
    fetchReports();
    setToast({ type: "success", message: "Lista atualizada." });
  }

  const meta = data?.meta;
  const reports = data?.data ?? [];
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            toast.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => { setError(null); fetchReports(); }}
            className="ml-2 font-medium underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {meta && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pendentes</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{meta.totals.pending}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 shadow-sm">
            <p className="text-sm font-medium text-red-700">Atrasados</p>
            <p className="mt-1 text-2xl font-semibold text-red-900">{meta.totals.overdue}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Concluídos</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{meta.totals.done}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              u.set("arStatus", e.target.value);
              u.delete("arPage");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="pending,overdue">Pendentes + Atrasados</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Atrasados</option>
            <option value="done">Concluídos</option>
            <option value="canceled">Cancelados</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Frequência</label>
          <select
            value={frequency}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("arFrequency", e.target.value);
              else u.delete("arFrequency");
              u.delete("arPage");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            <option value="Anual">Anual</option>
            <option value="Bienal">Bienal</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
          <select
            value={state}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("arState", e.target.value);
              else u.delete("arState");
              u.delete("arPage");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Ano</label>
          <input
            type="number"
            min="2020"
            max="2030"
            value={year}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("arYear", e.target.value);
              else u.delete("arYear");
              u.delete("arPage");
              router.push(`/billing?${u.toString()}`);
            }}
            placeholder="2026"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("arFrom", e.target.value);
              else u.delete("arFrom");
              u.delete("arPage");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("arTo", e.target.value);
              else u.delete("arTo");
              u.delete("arPage");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Busca</label>
          <input
            type="search"
            defaultValue={qParam}
            placeholder="Nome da empresa"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === "Enter" && debouncedSetQuery((e.target as HTMLInputElement).value)}
            onChange={(e) => debouncedSetQuery(e.target.value)}
          />
        </div>
        <div className="md:col-span-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordenar</label>
          <select
            value={sort}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("arSort", e.target.value);
              else u.delete("arSort");
              u.delete("arPage");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Padrão</option>
            <option value="dueDateAsc">Vencimento ↑</option>
            <option value="dueDateDesc">Vencimento ↓</option>
            <option value="companyAsc">Empresa A-Z</option>
            <option value="companyDesc">Empresa Z-A</option>
          </select>
        </div>
        <div className="md:col-span-1">
          <button
            type="button"
            onClick={handleRefresh}
            className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700"
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded bg-slate-200" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-8 text-center text-slate-600">
          Nenhuma obrigação de Annual Report encontrada. Ajuste os filtros ou verifique se os clientes têm LLC cadastrada com estado válido.
        </div>
      ) : (
        <>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Frequência</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Ano</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Vencimento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {reports.map((row) => {
                    const state = getStateByCode(row.llcState);
                    const stateName = state ? `${state.name} (${row.llcState})` : row.llcState;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">{row.companyName ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{stateName}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{row.frequency}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{row.periodYear}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(row.dueDate)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {row.status !== "done" && row.status !== "canceled" && (
                              <button
                                type="button"
                                onClick={() => handleMarkDone(row.id)}
                                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                              >
                                Concluir
                              </button>
                            )}
                            {row.status !== "canceled" && (
                              <button
                                type="button"
                                onClick={() => handleCancel(row.id)}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Cancelar
                              </button>
                            )}
                            {(row.status === "done" || row.status === "canceled") && (
                              <button
                                type="button"
                                onClick={() => handleReopen(row.id)}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Reabrir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && meta && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Página {meta.page} de {totalPages} ({meta.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    const u = new URLSearchParams(searchParams.toString());
                    u.set("arPage", String(page - 1));
                    router.push(`/billing?${u.toString()}`);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const u = new URLSearchParams(searchParams.toString());
                    u.set("arPage", String(page + 1));
                    router.push(`/billing?${u.toString()}`);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

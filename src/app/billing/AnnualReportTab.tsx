"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getStateByCode, US_STATES } from "@/constants/usStates";
import { AnnualReportCompanyModal } from "./AnnualReportCompanyModal";

type CompanyRow = {
  clientId: string;
  companyName: string | null;
  states: string[];
  counts: {
    pending: number;
    overdue: number;
    done: number;
    canceled: number;
  };
  nextDueDate: string | null;
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

export function AnnualReportTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ data: CompanyRow[]; meta: Meta } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const qRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<{ clientId: string; companyName: string | null } | null>(null);

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

  const fetchCompanies = useCallback(async () => {
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
      const res = await fetch(`/api/billing/annual-reports/companies?${params.toString()}`);
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
      setError(e instanceof Error ? e.message : "Erro ao carregar empresas");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status, frequency, state, year, sort, from, to, page, limit]);

  useEffect(() => {
    qRef.current = qParam;
    fetchCompanies();
  }, [fetchCompanies, qParam]);

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

  function handleRefresh() {
    fetchCompanies();
    setToast({ type: "success", message: "Lista atualizada." });
  }

  function openModal(company: CompanyRow) {
    setSelectedCompany({ clientId: company.clientId, companyName: company.companyName });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedCompany(null);
  }

  function handleModalActionComplete() {
    fetchCompanies();
    setToast({ type: "success", message: "Status atualizado." });
  }

  const meta = data?.meta;
  const companies = data?.data ?? [];
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
            onClick={() => { setError(null); fetchCompanies(); }}
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
      ) : companies.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-8 text-center text-slate-600">
          Nenhuma empresa com Annual Report encontrada. Ajuste os filtros ou verifique se os clientes têm LLC cadastrada com estado válido.
        </div>
      ) : (
        <>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Estados</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Próx. Vencimento</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Pendentes</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Atrasados</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Concluídos</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {companies.map((company) => {
                    const hasOverdue = company.counts.overdue > 0;
                    return (
                      <tr
                        key={company.clientId}
                        className={`hover:bg-slate-50 cursor-pointer ${hasOverdue ? "bg-red-50/30" : ""}`}
                        onClick={() => openModal(company)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {company.companyName ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {company.states.map((s) => {
                              const stateInfo = getStateByCode(s);
                              return (
                                <span
                                  key={s}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                  title={stateInfo?.name ?? s}
                                >
                                  {s}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatDate(company.nextDueDate)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {company.counts.pending > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              {company.counts.pending}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {company.counts.overdue > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {company.counts.overdue}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {company.counts.done > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {company.counts.done}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(company);
                            }}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            Ver anos
                          </button>
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
                Página {meta.page} de {totalPages} ({meta.total} empresas)
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

      {/* Modal de detalhes por empresa */}
      {selectedCompany && (
        <AnnualReportCompanyModal
          clientId={selectedCompany.clientId}
          companyName={selectedCompany.companyName}
          isOpen={modalOpen}
          onClose={closeModal}
          onActionComplete={handleModalActionComplete}
        />
      )}
    </div>
  );
}

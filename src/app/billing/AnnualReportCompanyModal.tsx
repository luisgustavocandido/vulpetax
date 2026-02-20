"use client";

import { useState, useEffect, useCallback } from "react";
import { getStateByCode } from "@/constants/usStates";

type Obligation = {
  id: string;
  llcState: string;
  frequency: string;
  periodYear: number;
  dueDate: string;
  status: string;
  doneAt: string | null;
  notes: string | null;
};

type Props = {
  clientId: string;
  companyName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
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

export function AnnualReportCompanyModal({
  clientId,
  companyName,
  isOpen,
  onClose,
  onActionComplete,
}: Props) {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchObligations = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/annual-reports/company/${clientId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Erro ao carregar obrigações");
      }
      const json = await res.json();
      setObligations(json.obligations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (isOpen && clientId) {
      fetchObligations();
    }
  }, [isOpen, clientId, fetchObligations]);

  async function handleMarkDone(obligationId: string) {
    setActionLoading(obligationId);
    try {
      const res = await fetch(`/api/billing/annual-reports/${obligationId}/done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao marcar como concluído");
      }
      await fetchObligations();
      onActionComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReopen(obligationId: string) {
    setActionLoading(obligationId);
    try {
      const res = await fetch(`/api/billing/annual-reports/${obligationId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao reabrir");
      }
      await fetchObligations();
      onActionComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(obligationId: string) {
    if (!confirm("Cancelar esta obrigação?")) return;
    setActionLoading(obligationId);
    try {
      const res = await fetch(`/api/billing/annual-reports/${obligationId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao cancelar");
      }
      await fetchObligations();
      onActionComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setActionLoading(null);
    }
  }

  if (!isOpen) return null;

  // Agrupar obrigações por estado
  const byState = obligations.reduce((acc, ob) => {
    const key = ob.llcState;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ob);
    return acc;
  }, {} as Record<string, Obligation[]>);

  const stateKeys = Object.keys(byState).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl max-h-[85vh] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {companyName ?? "Empresa"}
            </h2>
            <p className="text-sm text-slate-500">Annual Reports por ano</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
              <button
                type="button"
                onClick={() => { setError(null); fetchObligations(); }}
                className="ml-2 font-medium underline"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded bg-slate-200" />
              ))}
            </div>
          ) : obligations.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma obrigação encontrada para esta empresa.
            </div>
          ) : (
            <div className="space-y-6">
              {stateKeys.map((stateCode) => {
                const stateInfo = getStateByCode(stateCode);
                const stateName = stateInfo ? `${stateInfo.name} (${stateCode})` : stateCode;
                const items = byState[stateCode];

                return (
                  <div key={stateCode}>
                    <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {stateCode}
                      </span>
                      {stateName}
                    </h3>

                    <div className="rounded-md border border-slate-200 overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">Ano</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">Frequência</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">Vencimento</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">Status</th>
                            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-slate-500">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {items.map((ob) => (
                            <tr key={ob.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-sm font-medium text-slate-900">
                                {ob.periodYear}
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-600">
                                {ob.frequency}
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-600">
                                {formatDate(ob.dueDate)}
                              </td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(ob.status)}`}>
                                  {statusLabel(ob.status)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex justify-end gap-1">
                                  {ob.status !== "done" && ob.status !== "canceled" && (
                                    <button
                                      type="button"
                                      disabled={actionLoading === ob.id}
                                      onClick={() => handleMarkDone(ob.id)}
                                      className="rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {actionLoading === ob.id ? "..." : "Pago"}
                                    </button>
                                  )}
                                  {(ob.status === "done" || ob.status === "canceled") && (
                                    <button
                                      type="button"
                                      disabled={actionLoading === ob.id}
                                      onClick={() => handleReopen(ob.id)}
                                      className="rounded px-2 py-1 text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      {actionLoading === ob.id ? "..." : "Reabrir"}
                                    </button>
                                  )}
                                  {ob.status !== "canceled" && (
                                    <button
                                      type="button"
                                      disabled={actionLoading === ob.id}
                                      onClick={() => handleCancel(ob.id)}
                                      className="rounded px-2 py-1 text-xs font-medium border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      {actionLoading === ob.id ? "..." : "Cancelar"}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

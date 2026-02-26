"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type ByCommercialItem = {
  commercial: string;
  llcTarget: string;
  revenueUsd: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Mês padrão YYYY-MM (ex: do período atual do dashboard) */
  defaultMonth: string;
  /** Comerciais do período (para a aba "Por comercial") */
  commercialNames?: string[];
};

export function AddMonthlyTargetModal({
  open,
  onClose,
  defaultMonth,
  commercialNames = [],
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "by-commercial">("general");
  const [month, setMonth] = useState(defaultMonth);
  const [llcTarget, setLlcTarget] = useState("");
  const [revenueUsd, setRevenueUsd] = useState("");
  const [byCommercialRows, setByCommercialRows] = useState<ByCommercialItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGeneral = useCallback(() => {
    fetch(`/api/dashboard/targets?month=${encodeURIComponent(defaultMonth)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Falha ao carregar meta"))))
      .then((data: { month: string; llcTarget: number; revenueTargetCents: number }) => {
        setMonth(data.month);
        setLlcTarget(data.llcTarget === 0 ? "" : String(data.llcTarget));
        setRevenueUsd(data.revenueTargetCents === 0 ? "" : String(data.revenueTargetCents / 100));
      })
      .catch(() => {
        setLlcTarget("");
        setRevenueUsd("");
      });
  }, [defaultMonth]);

  const loadByCommercial = useCallback(() => {
    const monthKey = month || defaultMonth;
    fetch(
      `/api/dashboard/targets/by-commercial?month=${encodeURIComponent(monthKey)}`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Falha ao carregar"))))
      .then((data: Array<{ commercial: string; llcTarget: number; revenueTargetCents: number }>) => {
        const map = new Map(data.map((d) => [d.commercial, d]));
        const names = commercialNames.length > 0 ? commercialNames : [];
        const rows: ByCommercialItem[] = names.length
          ? names.map((name) => {
              const t = map.get(name);
              return {
                commercial: name,
                llcTarget: t ? (t.llcTarget === 0 ? "" : String(t.llcTarget)) : "",
                revenueUsd: t ? (t.revenueTargetCents === 0 ? "" : String(t.revenueTargetCents / 100)) : "",
              };
            })
          : data.map((d) => ({
              commercial: d.commercial,
              llcTarget: d.llcTarget === 0 ? "" : String(d.llcTarget),
              revenueUsd: d.revenueTargetCents === 0 ? "" : String(d.revenueTargetCents / 100),
            }));
        setByCommercialRows(rows);
      })
      .catch(() => setByCommercialRows([]));
  }, [month, defaultMonth, commercialNames]);

  useEffect(() => {
    if (!open) return;
    setMonth(defaultMonth);
    setError(null);
    setTab("general");
    loadGeneral();
  }, [open, defaultMonth, loadGeneral]);

  const commercialNamesKey = commercialNames.join(",");
  useEffect(() => {
    if (!open || tab !== "by-commercial") return;
    if (commercialNames.length > 0) {
      setByCommercialRows((prev) => {
        if (prev.length !== commercialNames.length || prev.some((r, i) => r.commercial !== commercialNames[i])) {
          return commercialNames.map((name) => ({ commercial: name, llcTarget: "", revenueUsd: "" }));
        }
        return prev;
      });
    }
    loadByCommercial();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commercialNamesKey tracks list identity without array ref churn
  }, [open, tab, month, commercialNamesKey, loadByCommercial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const llc = llcTarget === "" ? 0 : parseInt(llcTarget, 10);
    const revenue = revenueUsd === "" ? 0 : parseFloat(revenueUsd);
    if (Number.isNaN(llc) || llc < 0) {
      setError("Meta de LLCs deve ser um número ≥ 0");
      return;
    }
    if (Number.isNaN(revenue) || revenue < 0) {
      setError("Meta de receita deve ser um número ≥ 0 (em USD)");
      return;
    }
    const revenueTargetCents = Math.round(revenue * 100);

    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          llcTarget: llc,
          revenueTargetCents,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Erro ao salvar");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleByCommercialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const monthKey = month || defaultMonth;
    const items = byCommercialRows.map((row) => {
      const llc = row.llcTarget === "" ? 0 : parseInt(row.llcTarget, 10);
      const rev = row.revenueUsd === "" ? 0 : parseFloat(row.revenueUsd);
      return {
        commercial: row.commercial,
        llcTarget: Number.isNaN(llc) || llc < 0 ? 0 : llc,
        revenueTargetCents: Number.isNaN(rev) || rev < 0 ? 0 : Math.round(rev * 100),
      };
    });

    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/targets/by-commercial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: monthKey, items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Erro ao salvar");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const setByCommercialRow = (index: number, field: "llcTarget" | "revenueUsd", value: string) => {
    setByCommercialRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="mb-4 text-lg font-semibold text-gray-900">
          Adicionar / editar meta mensal
        </h2>

        <div className="mb-4 flex gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab("general")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "general"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Geral
          </button>
          <button
            type="button"
            onClick={() => setTab("by-commercial")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "by-commercial"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Por comercial
          </button>
        </div>

        {tab === "general" && (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="meta-month" className="block text-sm font-medium text-gray-700">
                Mês (YYYY-MM) *
              </label>
              <input
                id="meta-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="meta-llc" className="block text-sm font-medium text-gray-700">
                Meta de LLCs
              </label>
              <input
                id="meta-llc"
                type="number"
                min={0}
                value={llcTarget}
                onChange={(e) => setLlcTarget(e.target.value)}
                placeholder="Ex: 50"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="meta-revenue" className="block text-sm font-medium text-gray-700">
                Meta de receita (USD)
              </label>
              <input
                id="meta-revenue"
                type="number"
                min={0}
                step={0.01}
                value={revenueUsd}
                onChange={(e) => setRevenueUsd(e.target.value)}
                placeholder="Ex: 50000"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {tab === "by-commercial" && (
          <form onSubmit={handleByCommercialSubmit}>
            <div className="mb-4">
              <label htmlFor="meta-month-bc" className="block text-sm font-medium text-gray-700">
                Mês (YYYY-MM) *
              </label>
              <input
                id="meta-month-bc"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {byCommercialRows.length === 0 && commercialNames.length === 0 ? (
              <p className="mb-4 text-sm text-gray-500">
                Nenhum comercial no período. Ajuste o filtro do dashboard e abra o modal novamente.
              </p>
            ) : (
              <div className="mb-4 max-h-64 overflow-y-auto rounded border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Comercial</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Meta LLCs</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Meta Receita (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {byCommercialRows.map((row, index) => (
                      <tr key={row.commercial} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-medium text-gray-900">{row.commercial}</td>
                        <td className="px-3 py-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            value={row.llcTarget}
                            onChange={(e) => setByCommercialRow(index, "llcTarget", e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.revenueUsd}
                            onChange={(e) => setByCommercialRow(index, "revenueUsd", e.target.value)}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || byCommercialRows.length === 0}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

type ButtonProps = {
  defaultMonth: string;
  /** Comerciais do período (para a aba "Por comercial") */
  commercialNames?: string[];
};

export function AddMonthlyTargetButton({ defaultMonth, commercialNames = [] }: ButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Adicionar metas
      </button>
      <AddMonthlyTargetModal
        open={open}
        onClose={() => setOpen(false)}
        defaultMonth={defaultMonth}
        commercialNames={commercialNames}
      />
    </>
  );
}

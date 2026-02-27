"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type PersonGroupRow = {
  personGroupId: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  companiesCount: number;
};

type ClientesTableProps = {
  items: PersonGroupRow[];
};

type AutoMergeResult = {
  dryRun: boolean;
  mergesPlannedOrExecuted: number;
  movedCompaniesTotal: number;
  merges: Array<{
    targetPersonGroupId: string;
    sourcePersonGroupIds: string[];
    movedCompanies: number;
    reason: string;
    score: number;
  }>;
};

function shortId(id: string): string {
  return id.slice(0, 8);
}

const MIN_SCORE_OPTIONS = [
  { value: 0.85, label: "0.85 (mais sugestões)" },
  { value: 0.9, label: "0.90 (recomendado)" },
  { value: 0.95, label: "0.95 (apenas alta confiança)" },
];

export function ClientesTable({ items }: ClientesTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [isAutoMergeOpen, setIsAutoMergeOpen] = useState(false);
  const [autoMergeMinScore, setAutoMergeMinScore] = useState(0.9);
  const [autoMergeDryRun, setAutoMergeDryRun] = useState(true);
  const [autoMergeLoading, setAutoMergeLoading] = useState(false);
  const [autoMergeResult, setAutoMergeResult] = useState<AutoMergeResult | null>(null);

  const clearBanner = useCallback(() => {
    setBanner(null);
  }, []);

  const toggleOne = useCallback((personGroupId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(personGroupId)) next.delete(personGroupId);
      else next.add(personGroupId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((r) => r.personGroupId)));
    }
  }, [items, selected.size]);

  const openMergeModal = useCallback(() => {
    const ids = Array.from(selected);
    setTargetId(ids[0] ?? "");
    setIsMergeOpen(true);
  }, [selected]);

  const closeMergeModal = useCallback(() => {
    setIsMergeOpen(false);
    setTargetId("");
  }, []);

  const selectedRows = items.filter((r) => selected.has(r.personGroupId));
  const sourceIds = selectedRows
    .map((r) => r.personGroupId)
    .filter((id) => id !== targetId);
  const companiesToMove = selectedRows
    .filter((r) => r.personGroupId !== targetId)
    .reduce((acc, r) => acc + r.companiesCount, 0);

  const handleMerge = useCallback(async () => {
    if (!targetId || sourceIds.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/person-groups/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPersonGroupId: targetId,
          sourcePersonGroupIds: sourceIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setBanner({ type: "error", message: "Grupo destino não pode ser origem." });
        } else if (res.status === 404) {
          setBanner({
            type: "error",
            message: data.error ?? "Grupo não encontrado (talvez já foi mesclado).",
          });
        } else {
          setBanner({
            type: "error",
            message: data.error ?? "Erro ao mesclar. Tente novamente.",
          });
        }
        setSubmitting(false);
        return;
      }
      setBanner({
        type: "success",
        message: `Mesclado com sucesso. ${data.movedCompanies ?? 0} empresa(s) movida(s).`,
      });
      closeMergeModal();
      setSelected(new Set());
      router.refresh();
      setTimeout(clearBanner, 4000);
    } catch {
      setBanner({ type: "error", message: "Erro de rede. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }, [targetId, sourceIds, closeMergeModal, router, clearBanner]);

  const runAutoMerge = useCallback(async () => {
    setAutoMergeLoading(true);
    setAutoMergeResult(null);
    try {
      const res = await fetch("/api/person-groups/auto-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minScore: autoMergeMinScore,
          maxMerges: 200,
          dryRun: autoMergeDryRun,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: data.error ?? "Erro ao executar auto-mesclar." });
        setAutoMergeLoading(false);
        return;
      }
      setAutoMergeResult(data as AutoMergeResult);
      if (!autoMergeDryRun && data.mergesPlannedOrExecuted > 0) {
        setBanner({
          type: "success",
          message: `Auto-mesclar concluído: ${data.mergesPlannedOrExecuted} merge(s), ${data.movedCompaniesTotal ?? 0} empresa(s) movidas.`,
        });
        setTimeout(() => {
          setIsAutoMergeOpen(false);
          router.refresh();
          setTimeout(clearBanner, 4000);
        }, 1500);
      }
    } catch {
      setBanner({ type: "error", message: "Erro de rede. Tente novamente." });
    } finally {
      setAutoMergeLoading(false);
    }
  }, [autoMergeMinScore, autoMergeDryRun, router, clearBanner]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        Nenhum cliente (pessoa) encontrado.
      </div>
    );
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0;

  return (
    <>
      <div className="space-y-4">
        {banner && (
          <div
            role="alert"
            className={`rounded-md px-4 py-3 text-sm ${
              banner.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {banner.message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openMergeModal}
            disabled={selected.size < 2}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-50"
          >
            Mesclar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAutoMergeOpen(true);
              setAutoMergeResult(null);
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Auto-mesclar
          </button>
          {someSelected && (
            <span className="text-sm text-gray-600">
              {selected.size} selecionado(s)
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-2 py-2">
                  <label className="flex cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Selecionar todos da página"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Nome
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  E-mail
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Telefone
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Empresas
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((row) => (
                <tr key={row.personGroupId} className="hover:bg-gray-50">
                  <td className="w-10 px-2 py-2">
                    <label className="flex cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selected.has(row.personGroupId)}
                        onChange={() => toggleOne(row.personGroupId)}
                        aria-label={`Selecionar ${row.displayName ?? row.personGroupId}`}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                    {row.displayName ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                    {row.email ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                    {row.phone ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                    {row.companiesCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                    <span className="flex justify-end gap-3">
                      <Link
                        href={`/empresas/person/${row.personGroupId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        Ver empresas
                      </Link>
                      <Link
                        href={`/clientes/pagadores/${row.personGroupId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        Painel
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isMergeOpen && selectedRows.length >= 2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="merge-modal-title"
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="merge-modal-title" className="border-b border-gray-200 px-6 py-4 text-lg font-semibold text-gray-900">
              Mesclar clientes
            </h2>
            <p className="px-6 pt-4 text-sm text-gray-600">
              Selecione o grupo destino. As empresas dos outros grupos serão movidas para ele.
            </p>
            {companiesToMove > 0 && (
              <p className="px-6 pt-1 text-xs text-amber-700">
                Isso moverá {companiesToMove} empresa(s) para o grupo destino.
              </p>
            )}
            <div className="px-6 py-4">
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase text-gray-500">
                  Grupo destino
                </legend>
                {selectedRows.map((row) => (
                  <label
                    key={row.personGroupId}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="mergeTarget"
                      value={row.personGroupId}
                      checked={targetId === row.personGroupId}
                      onChange={() => setTargetId(row.personGroupId)}
                      className="mt-1 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block font-medium text-gray-900">
                        {row.displayName ?? "—"}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {shortId(row.personGroupId)} · {row.companiesCount} empresa(s)
                      </span>
                    </div>
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeMergeModal}
                disabled={submitting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={submitting || !targetId}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting
                  ? "Mesclando…"
                  : `Mesclar (mover ${companiesToMove} empresa(s))`}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAutoMergeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auto-merge-modal-title"
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="auto-merge-modal-title" className="border-b border-gray-200 px-6 py-4 text-lg font-semibold text-gray-900">
              Auto-mesclar clientes
            </h2>
            <p className="px-6 pt-3 text-sm text-amber-800 bg-amber-50 border-b border-amber-100">
              Isso pode mesclar pessoas diferentes se os dados estiverem errados. Use dry-run primeiro.
            </p>
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium uppercase text-gray-500 mb-1">
                  Nível de confiança (minScore)
                </label>
                <select
                  value={autoMergeMinScore}
                  onChange={(e) => setAutoMergeMinScore(Number(e.target.value))}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {MIN_SCORE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoMergeDryRun}
                  onChange={(e) => setAutoMergeDryRun(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                <span className="text-sm text-gray-700">Dry-run (recomendado) — não altera o banco</span>
              </label>
              {autoMergeResult !== null && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                  <p className="text-sm font-medium text-gray-900">
                    {autoMergeResult.dryRun ? "Plano (dry-run)" : "Executado"}:
                    {" "}{autoMergeResult.mergesPlannedOrExecuted} merge(s),
                    {" "}{autoMergeResult.movedCompaniesTotal} empresa(s) no total.
                  </p>
                  <p className="text-xs text-gray-600">
                    Primeiros clusters:
                  </p>
                  <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                    {autoMergeResult.merges.slice(0, 10).map((m, i) => (
                      <li key={i}>
                        {m.reason} (score {m.score}) → {m.movedCompanies} empresa(s)
                      </li>
                    ))}
                    {autoMergeResult.merges.length > 10 && (
                      <li>… e mais {autoMergeResult.merges.length - 10}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 mt-auto">
              <button
                type="button"
                onClick={() => {
                  setIsAutoMergeOpen(false);
                  setAutoMergeResult(null);
                }}
                disabled={autoMergeLoading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={runAutoMerge}
                disabled={autoMergeLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {autoMergeLoading ? "Executando…" : autoMergeDryRun ? "Simular (dry-run)" : "Executar de verdade"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

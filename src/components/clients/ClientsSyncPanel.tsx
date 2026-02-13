"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type SyncStatus = {
  lastSyncedAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
};

type PreviewData = {
  fetchedRows: number;
  validRows: number;
  invalidRows: number;
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkip: number;
  errors: { row: number; field?: string; message: string }[];
  sample: Array<{
    row: number;
    companyName: string;
    customerCode: string | null;
    action: "create" | "update" | "skip";
  }>;
};

type ConfirmResult = {
  rowsTotal: number;
  rowsImported: number;
  rowsErrors: number;
  profileUsed: string;
  importHistoryId?: string;
};

const SYNC_TIMEOUT_MS = 120_000;

export function ClientsSyncPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/clients/sync-status");
      if (res.ok) {
        const data = await res.json();
        setStatus({
          lastSyncedAt: data.lastSyncedAt,
          lastRunStatus: data.lastRunStatus,
          lastRunError: data.lastRunError,
        });
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handlePreview = async () => {
    setLoadingPreview(true);
    setMessage(null);
    setPreview(null);
    setConfirmed(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

    try {
      const res = await fetch("/api/clients/sync/preview", {
        method: "POST",
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        const msg =
          data.error ??
          (res.status === 429
            ? "Aguarde 60 segundos antes de solicitar outro preview."
            : "Erro ao obter prévia.");
        setMessage({ type: "error", text: msg });
        return;
      }

      setPreview(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessage({ type: "error", text: "Preview expirou (timeout)." });
      } else {
        setMessage({ type: "error", text: "Erro ao obter prévia da planilha." });
      }
    } finally {
      clearTimeout(timeout);
      setLoadingPreview(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmed || !preview) return;
    setLoadingConfirm(true);
    setMessage(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

    try {
      const res = await fetch("/api/clients/sync/confirm", {
        method: "POST",
        signal: controller.signal,
      });
      const data: ConfirmResult = await res.json();

      if (!res.ok) {
        const err = data as { error?: string };
        const msg =
          res.status === 409
            ? "Uma sincronização já está em execução. Aguarde."
            : err?.error ?? "Erro ao sincronizar.";
        setMessage({ type: "error", text: msg });
        return;
      }

      const { rowsImported, rowsTotal, rowsErrors } = data;
      let text = `Sincronizado: ${rowsImported} de ${rowsTotal} linhas`;
      if (rowsErrors > 0) text += ` (${rowsErrors} com erro)`;
      setMessage({ type: "success", text });
      setPreview(null);
      setConfirmed(false);
      await fetchStatus();
      // Força a tabela de clientes a recarregar navegando para a mesma URL (dados atualizados)
      const query = searchParams.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessage({ type: "error", text: "Sincronização expirou (timeout)." });
      } else {
        setMessage({ type: "error", text: "Erro ao sincronizar com o Google Sheets." });
      }
    } finally {
      clearTimeout(timeout);
      setLoadingConfirm(false);
    }
  };

  const lastSyncText = status?.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
  const statusText = status?.lastRunStatus === "ok" ? "OK" : status?.lastRunStatus ?? "—";

  const actionLabel = (a: "create" | "update" | "skip") =>
    a === "create" ? "Criar" : a === "update" ? "Atualizar" : "Ignorar";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loadingPreview}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingPreview ? "Carregando prévia…" : "Pré-visualizar sincronização"}
          </button>
          <span className="text-xs text-gray-500">
            Último sync: {lastSyncText} · Status: {statusText}
          </span>
        </div>
        {message && (
          <p
            className={`text-sm ${
              message.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      {preview && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">
            Prévia da sincronização (Pós-Venda LLC)
          </h3>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            <div className="rounded bg-white p-2 shadow-sm">
              <div className="text-xs text-gray-500">Linhas lidas</div>
              <div className="text-lg font-semibold">{preview.fetchedRows}</div>
            </div>
            <div className="rounded bg-white p-2 shadow-sm">
              <div className="text-xs text-gray-500">Válidas</div>
              <div className="text-lg font-semibold text-green-700">{preview.validRows}</div>
            </div>
            <div className="rounded bg-white p-2 shadow-sm">
              <div className="text-xs text-gray-500">Inválidas</div>
              <div className="text-lg font-semibold text-amber-700">{preview.invalidRows}</div>
            </div>
            <div className="rounded bg-white p-2 shadow-sm">
              <div className="text-xs text-gray-500">A criar</div>
              <div className="text-lg font-semibold text-blue-700">{preview.wouldCreate}</div>
            </div>
            <div className="rounded bg-white p-2 shadow-sm">
              <div className="text-xs text-gray-500">A atualizar</div>
              <div className="text-lg font-semibold text-indigo-700">{preview.wouldUpdate}</div>
            </div>
            <div className="rounded bg-white p-2 shadow-sm">
              <div className="text-xs text-gray-500">A ignorar</div>
              <div className="text-lg font-semibold text-gray-600">{preview.wouldSkip}</div>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">
                Erros (até 10)
              </h4>
              <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-1 text-left font-medium">Linha</th>
                      <th className="px-3 py-1 text-left font-medium">Campo</th>
                      <th className="px-3 py-1 text-left font-medium">Mensagem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((e, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1">{e.row}</td>
                        <td className="px-3 py-1 text-gray-600">{e.field ?? "—"}</td>
                        <td className="px-3 py-1 text-red-600">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.sample.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">
                Amostra (3)
              </h4>
              <ul className="space-y-1 rounded border border-gray-200 bg-white p-3 text-sm">
                {preview.sample.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800">{s.companyName}</span>
                    <span className="text-gray-500">
                      {s.customerCode ?? "—"} · Linha {s.row}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        s.action === "create"
                          ? "bg-blue-100 text-blue-800"
                          : s.action === "update"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {actionLabel(s.action)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                Entendo que isso vai atualizar a base
              </span>
            </label>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!confirmed || loadingConfirm}
              className="w-fit rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingConfirm ? "Sincronizando…" : "Confirmar sincronização"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

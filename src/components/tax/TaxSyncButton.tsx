"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type SyncStatus = {
  lastSyncedAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
};

const SYNC_TIMEOUT_MS = 120_000;

export function TaxSyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/tax/sync-status");
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

  const handleSync = async () => {
    setLoading(true);
    setMessage(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

    try {
      const res = await fetch("/api/tax/sync", {
        method: "POST",
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error ?? (res.status === 429 ? "Aguarde 60 segundos antes de tentar novamente." : "Erro ao sincronizar.");
        setMessage({ type: "error", text: msg });
        return;
      }

      const { rowsImported, rowsTotal, rowsErrors } = data;
      let text = `Sincronizado: ${rowsImported} de ${rowsTotal} linhas`;
      if (rowsErrors > 0) text += ` (${rowsErrors} com erro)`;
      setMessage({ type: "success", text });
      await fetchStatus();
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessage({ type: "error", text: "Sincronização expirou (timeout)." });
      } else {
        setMessage({ type: "error", text: "Erro ao sincronizar com o Google Sheets." });
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const lastSyncText = status?.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  const statusText = status?.lastRunStatus === "ok" ? "OK" : status?.lastRunStatus ?? "—";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={loading}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sincronizando…" : "Sincronizar agora"}
        </button>
        <span className="text-xs text-slate-500">
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
  );
}

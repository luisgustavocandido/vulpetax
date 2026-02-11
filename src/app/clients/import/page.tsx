"use client";

import { useState } from "react";
import Link from "next/link";
import { ImportResult } from "@/components/ImportResult";
import { ImportPreview } from "@/components/ImportPreview";

type ImportResponse = {
  dryRun?: boolean;
  rowsTotal?: number;
  rowsImported?: number;
  rowsValid?: number;
  rowsInvalid?: number;
  rowsErrors?: number;
  sample?: { clientPatch: Record<string, unknown>; partners: unknown[]; items: unknown[] }[];
  errors?: { row: number; field: string; message: string }[];
  error?: string;
};

export default function ImportClientsPage() {
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(dryRun: boolean) {
    setError(null);
    setResult(null);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]#file');
    const file = input?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo CSV.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = `/api/clients/import${dryRun ? "?dryRun=1" : ""}`;
      const res = await fetch(url, { method: "POST", body: fd });
      
      let json: ImportResponse;
      try {
        const text = await res.text();
        json = text ? JSON.parse(text) : {};
      } catch {
        setError("Erro ao processar resposta do servidor.");
        setResult(null);
        return;
      }
      
      setResult(json);
      if (!res.ok) {
        setError(json.error ?? "Erro na importação");
      }
    } catch {
      setError("Erro ao enviar arquivo.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Importar clientes</h1>
        <Link href="/clients" className="text-sm text-blue-600 hover:underline">
          Voltar para clientes
        </Link>
      </div>

      <div className="max-w-lg space-y-4">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700">
            Arquivo CSV
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleAction(true)}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Processando…" : "Pré-visualizar"}
          </button>
          <button
            type="button"
            onClick={() => handleAction(false)}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Importando…" : "Importar"}
          </button>
        </div>
      </div>

      {result?.dryRun && result.rowsTotal !== undefined && (
        <ImportPreview
          rowsTotal={result.rowsTotal}
          rowsValid={result.rowsValid ?? 0}
          rowsInvalid={result.rowsInvalid ?? 0}
          sample={result.sample ?? []}
          errors={result.errors ?? []}
        />
      )}

      {result && !result.dryRun && result.rowsTotal !== undefined && (
        <ImportResult
          rowsTotal={result.rowsTotal}
          rowsImported={result.rowsImported ?? 0}
          rowsErrors={result.rowsErrors ?? 0}
          errors={result.errors ?? []}
        />
      )}
    </div>
  );
}

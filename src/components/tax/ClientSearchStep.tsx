"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { safeJson, extractErrorMessage } from "@/lib/safeJson";

type Client = {
  id: string;
  companyName: string;
  customerCode: string | null;
  createdAt: string;
};

type Props = {
  taxYear: number;
  onBack: () => void;
  onCancel: () => void;
};

export function ClientSearchStep({ taxYear, onBack, onCancel }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (query.trim().length < 2) {
      setClients([]);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients/search?query=${encodeURIComponent(query)}&limit=10`);
        const payload = await safeJson(res);
        if (payload && typeof payload === "object" && "clients" in payload) {
          setClients(Array.isArray(payload.clients) ? payload.clients : []);
        } else {
          setClients([]);
        }
        setLoading(false);
      } catch {
        setError("Erro ao buscar clientes");
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setQuery(client.companyName);
    setClients([]);
  };

  const handleCreate = async () => {
    if (!selectedClient) {
      setError("Selecione um cliente");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${selectedClient.id}/tax/forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear }),
      });

      const payload = await safeJson(res);

      if (!res.ok) {
        const message = extractErrorMessage(res, payload);
        throw new Error(`Falha ao criar TAX (HTTP ${res.status}): ${message}`);
      }

      if (!payload || typeof payload !== "object" || !("taxFormId" in payload)) {
        throw new Error("Resposta inválida do servidor: taxFormId não encontrado");
      }

      const data = payload as { taxFormId: string };
      router.push(`/clients/${selectedClient.id}/tax/${data.taxFormId}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Buscar LLC/Cliente</h1>
        <p className="mt-1 text-sm text-slate-500">Digite o nome da LLC para buscar no sistema</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <label htmlFor="search" className="block text-sm font-medium text-slate-700">
            Nome da LLC
          </label>
          <div className="relative mt-1">
            <input
              type="text"
              id="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o nome da LLC..."
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            {loading && (
              <div className="absolute right-3 top-2.5 text-xs text-slate-500">Buscando...</div>
            )}
          </div>
          {clients.length > 0 && (
            <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectClient(client)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <div className="font-medium text-slate-900">{client.companyName}</div>
                  {client.customerCode && (
                    <div className="text-xs text-slate-500">{client.customerCode}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedClient && (
          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Cliente selecionado:</h3>
            <p className="mt-1 text-sm text-slate-700">{selectedClient.companyName}</p>
            {selectedClient.customerCode && (
              <p className="text-xs text-slate-500">Código: {selectedClient.customerCode}</p>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={!selectedClient || creating}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {creating ? "Criando..." : "Criar TAX"}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={creating}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={creating}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

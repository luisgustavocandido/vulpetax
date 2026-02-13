"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  companyName: string;
  customerCode: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateTaxFormDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoadingClients(true);
      fetch("/api/clients?limit=1000")
        .then((res) => res.json())
        .then((data) => {
          // API retorna { data: [...], total, page, limit }
          setClients(data.data || []);
          setLoadingClients(false);
        })
        .catch(() => {
          setError("Erro ao carregar clientes");
          setLoadingClients(false);
        });
    } else {
      // Reset ao fechar
      setSelectedClientId("");
      setTaxYear(new Date().getFullYear());
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError("Selecione um cliente");
      return;
    }
    if (taxYear < 2000 || taxYear > 2100) {
      setError("Ano fiscal deve estar entre 2000 e 2100");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${selectedClientId}/tax/forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar formulário");
      }

      const data = await res.json();
      onClose();
      router.push(`/clients/${selectedClientId}/tax/${data.taxFormId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Criar novo TAX</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="client" className="block text-sm font-medium text-slate-700">
              Cliente *
            </label>
            {loadingClients ? (
              <div className="mt-1 text-sm text-slate-500">Carregando clientes...</div>
            ) : (
              <select
                id="client"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="">Selecione um cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName} {client.customerCode && `(${client.customerCode})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="taxYear" className="block text-sm font-medium text-slate-700">
              Ano Fiscal *
            </label>
            <input
              type="number"
              id="taxYear"
              min="2000"
              max="2100"
              value={taxYear}
              onChange={(e) => setTaxYear(parseInt(e.target.value, 10))}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <p className="mt-1 text-xs text-slate-500">O ano fiscal para o qual este formulário será preenchido</p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || loadingClients}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creating ? "Criando..." : "Criar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

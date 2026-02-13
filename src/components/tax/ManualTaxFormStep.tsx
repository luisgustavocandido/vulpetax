"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeJson, extractErrorMessage } from "@/lib/safeJson";

type Props = {
  taxYear: number;
  onBack: () => void;
  onCancel: () => void;
};

export function ManualTaxFormStep({ taxYear, onBack, onCancel }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    try {
      // Criar cliente provisório
      const clientRes = await fetch("/api/clients/provisional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear }),
      });

      const clientPayload = await safeJson(clientRes);

      if (!clientRes.ok) {
        const message = extractErrorMessage(clientRes, clientPayload);
        throw new Error(`Falha ao criar cliente provisório (HTTP ${clientRes.status}): ${message}`);
      }

      if (!clientPayload || typeof clientPayload !== "object" || !("clientId" in clientPayload)) {
        throw new Error("Resposta inválida do servidor: clientId não encontrado");
      }

      const clientData = clientPayload as { clientId: string };

      // Criar tax form para o cliente provisório
      const formRes = await fetch(`/api/clients/${clientData.clientId}/tax/forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear }),
      });

      const formPayload = await safeJson(formRes);

      if (!formRes.ok) {
        const message = extractErrorMessage(formRes, formPayload);
        throw new Error(`Falha ao criar formulário TAX (HTTP ${formRes.status}): ${message}`);
      }

      if (!formPayload || typeof formPayload !== "object" || !("taxFormId" in formPayload)) {
        throw new Error("Resposta inválida do servidor: taxFormId não encontrado");
      }

      const formData = formPayload as { taxFormId: string };
      router.push(`/clients/${clientData.clientId}/tax/${formData.taxFormId}`);
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
        <h1 className="text-xl font-semibold text-slate-900">Formulário TAX Manual</h1>
        <p className="mt-1 text-sm text-slate-500">
          Você irá preencher todos os dados do formulário TAX manualmente
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <p className="text-sm text-slate-700">
            Um cliente provisório será criado automaticamente. Você poderá preencher todos os dados
            do formulário TAX no próximo passo.
          </p>
          <p className="mt-2 text-sm font-medium text-slate-900">Ano Fiscal: {taxYear}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {creating ? "Criando..." : "Continuar"}
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

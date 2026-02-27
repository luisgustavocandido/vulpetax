"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClientePagadorDeleteButtonProps = {
  /** Id da URL (personGroupId ou customerId). */
  id: string;
  /** Nome do cliente para exibir na confirmação. */
  customerName: string;
};

/**
 * Botão para apagar cliente (pagador). Pede confirmação e redireciona para /clientes após sucesso.
 */
export function ClientePagadorDeleteButton({ id, customerName }: ClientePagadorDeleteButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/customers/${encodeURIComponent(id)}`, { method: "DELETE" });
    setDeleting(false);
    setConfirming(false);
    if (res.ok) {
      router.push("/clientes?tab=customers");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      alert((json as { error?: string }).error ?? "Erro ao excluir cliente");
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">
          Excluir &quot;{customerName}&quot;?
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? "Excluindo…" : "Sim"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Não
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
    >
      Apagar cliente
    </button>
  );
}

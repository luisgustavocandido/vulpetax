"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClientDeleteButtonProps = {
  clientId: string;
  clientName: string;
};

/**
 * Client: confirmação antes de DELETE; redirect após sucesso.
 */
export function ClientDeleteButton({ clientId, clientName }: ClientDeleteButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    setDeleting(false);
    setConfirming(false);
    if (res.ok) {
      router.push("/clients");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "Erro ao excluir");
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">
          Excluir &quot;{clientName}&quot;?
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? "Excluindo…" : "Sim"}
        </button>
        <button
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
      Excluir
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  clientId: string;
  customerCode: string;
  companyName: string;
  /** Se true, redireciona para /tax após sucesso (página de detalhe) */
  redirectOnSuccess?: boolean;
};

export function TaxRemoveButton({
  clientId,
  customerCode,
  companyName,
  redirectOnSuccess = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    confirmValue.trim().toLowerCase() === customerCode.toLowerCase() ||
    confirmValue.trim().toLowerCase() === companyName.trim().toLowerCase();

  const handleOpen = () => {
    setOpen(true);
    setConfirmValue("");
    setError(null);
  };

  const handleClose = () => {
    if (!loading) {
      setOpen(false);
      setConfirmValue("");
      setError(null);
    }
  };

  const handleRemove = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/tax`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao remover TAX.");
        return;
      }

      setOpen(false);
      if (redirectOnSuccess) {
        router.push("/tax?taxRemoved=1");
      } else {
        router.refresh();
      }
    } catch {
      setError("Erro ao remover TAX.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-sm text-red-600 hover:underline"
      >
        Remover TAX
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleClose}
        >
          <div
            className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Remover TAX</h3>
            <p className="mt-2 text-sm text-slate-600">
              Isso removerá o vínculo TAX do cliente <strong>{companyName}</strong>. O cliente não
              aparecerá mais na lista TAX. O cadastro do cliente será mantido.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Para confirmar, digite o código <strong>{customerCode}</strong> ou o nome da empresa.
            </p>
            <input
              type="text"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              placeholder="Código ou nome da empresa"
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={!isValid || loading}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Removendo…" : "Remover TAX"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

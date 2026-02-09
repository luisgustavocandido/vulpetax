"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createFilingDelivery,
  deleteFilingDelivery,
} from "@/app/actions/filing-deliveries";
import type { FilingDelivery } from "@/db";

const METHOD_LABELS: Record<string, string> = {
  paper_mail: "Correio (paper mail)",
  fax: "Fax",
  efile: "E-file (online)",
  other: "Outro",
};

type Props = {
  taxFilingId: string;
  deliveries: FilingDelivery[];
};

export function FilingDeliverySection({ taxFilingId, deliveries }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(deliveryId: string) {
    if (!confirm("Remover este registro de envio? O status da declaração voltará a 'Pronto para enviar' se for o último envio."))
      return;
    startTransition(async () => {
      await deleteFilingDelivery(deliveryId);
      router.refresh();
    });
  }

  function submit(formData: FormData) {
    const filingMethod = formData.get("filingMethod") as string;
    const sentAtStr = formData.get("sentAt") as string;
    const deliveredAtStr = (formData.get("deliveredAt") as string) || undefined;
    const shippingTracking = (formData.get("shippingTracking") as string) || undefined;
    const faxConfirmation = (formData.get("faxConfirmation") as string) || undefined;

    if (!filingMethod || !sentAtStr) return;

    startTransition(async () => {
      await createFilingDelivery({
        taxFilingId,
        filingMethod: filingMethod as "paper_mail" | "fax" | "efile" | "other",
        sentAt: new Date(sentAtStr),
        deliveredAt: deliveredAtStr ? new Date(deliveredAtStr) : null,
        shippingTracking: shippingTracking || null,
        faxConfirmation: faxConfirmation || null,
      });
      router.refresh();
    });
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 section-title">Registro de envio</h2>
      <p className="mb-4 text-sm text-neutral-600">
        Registre quando a declaração for enviada ao IRS/estado (correio, fax,
        e-file). O status da declaração será atualizado para &quot;Enviado&quot;.
      </p>

      <div className="card mb-4">
        <div className="card-body">
          <form action={submit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Método de envio *</label>
              <select name="filingMethod" required className="select">
                <option value="">Selecione</option>
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Data de envio *</label>
              <input
                name="sentAt"
                type="date"
                required
                className="input"
              />
            </div>
            <div>
              <label className="label">Data de entrega (opcional)</label>
              <input
                name="deliveredAt"
                type="date"
                className="input"
              />
            </div>
            <div>
              <label className="label">
                Nº rastreamento / tracking (correio)
              </label>
              <input
                name="shippingTracking"
                type="text"
                placeholder="Ex: 9400 1000 0000 0000 0000 00"
                className="input"
              />
            </div>
            <div>
              <label className="label">Confirmação fax (se aplicável)</label>
              <input
                name="faxConfirmation"
                type="text"
                placeholder="Nº ou referência"
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="btn btn-primary"
              >
                {isPending ? "Registrando…" : "Registrar envio"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {deliveries.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="mb-2 text-sm font-medium text-neutral-700">
            Envios registrados
          </h3>
          <ul className="space-y-2">
            {deliveries.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">
                    {METHOD_LABELS[d.filingMethod] ?? d.filingMethod}
                  </span>
                  <span className="ml-2 text-neutral-500">
                    Enviado em{" "}
                    {d.sentAt
                      ? new Date(d.sentAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </span>
                  {d.deliveredAt && (
                    <span className="ml-2 text-neutral-500">
                      · Entregue em{" "}
                      {new Date(d.deliveredAt).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {(d.shippingTracking || d.faxConfirmation) && (
                    <span className="ml-2 block text-neutral-500">
                      {d.shippingTracking || d.faxConfirmation}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  disabled={isPending}
                  className="shrink-0 text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Apagar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

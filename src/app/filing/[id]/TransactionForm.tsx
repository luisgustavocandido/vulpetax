"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addReportableTransaction } from "@/app/actions/tax-filings";
import type { ReportableTransactionType } from "@/db";

type Option = { value: string; label: string };
type RelatedPartyRow = { id: string; name: string };

type Props = {
  taxFilingId: string;
  relatedParties: RelatedPartyRow[];
  transactionTypes: Option[];
};

export function TransactionForm({
  taxFilingId,
  relatedParties,
  transactionTypes,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const transactionType = formData.get("transactionType") as string;
    const amountStr = formData.get("amountUsd") as string;
    const description = (formData.get("description") as string) || undefined;
    const dateStr = (formData.get("transactionDate") as string) || undefined;
    const relatedPartyId = (formData.get("relatedPartyId") as string) || undefined;

    const amountUsd = parseFloat(amountStr?.replace(",", ".") ?? "0");
    if (!transactionType || Number.isNaN(amountUsd)) return;

    startTransition(async () => {
      await addReportableTransaction({
        taxFilingId,
        relatedPartyId: relatedPartyId || null,
        transactionType: transactionType as ReportableTransactionType,
        description: description?.trim(),
        amountUsd,
        transactionDate: dateStr ? new Date(dateStr) : undefined,
      });
      router.refresh();
    });
  }

  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2">
      {relatedParties.length > 0 && (
        <div className="sm:col-span-2">
          <label className="label">Parte relacionada</label>
          <select
            name="relatedPartyId"
            className="select"
          >
            <option value="">— Nenhum —</option>
            {relatedParties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label">Tipo de transação *</label>
        <select
          name="transactionType"
          required
          className="select"
        >
          <option value="">Selecione</option>
          {transactionTypes.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Valor (USD) *</label>
        <input
          name="amountUsd"
          type="text"
          required
          inputMode="decimal"
          placeholder="0.00"
          className="input"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Descrição (opcional)</label>
        <input
          name="description"
          type="text"
          className="input"
        />
      </div>
      <div>
        <label className="label">Data (opcional)</label>
        <input
          name="transactionDate"
          type="date"
          className="input"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary"
        >
          {isPending ? "Adicionando…" : "Adicionar transação"}
        </button>
      </div>
    </form>
  );
}

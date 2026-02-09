"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeReportableTransaction } from "@/app/actions/tax-filings";
import type { ReportableTransaction } from "@/db";

type RelatedPartyRow = { id: string; name: string };

type Props = {
  transactions: ReportableTransaction[];
  relatedParties: RelatedPartyRow[];
  labels: Record<string, string>;
};

export function TransactionList({
  transactions,
  relatedParties,
  labels,
}: Props) {
  const partyMap = new Map(relatedParties.map((p) => [p.id, p.name]));
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm("Remover esta transação?")) return;
    startTransition(async () => {
      await removeReportableTransaction(id);
      router.refresh();
    });
  }

  if (transactions.length === 0) {
    return (
      <p className="mt-4 text-sm text-neutral-500">
        Nenhuma transação cadastrada. Se não houve transações no ano, ainda é
        necessário entregar o Form 5472 (com valor zero ou indicando “none”).
      </p>
    );
  }

  const total = transactions.reduce((s, t) => s + t.amountUsd, 0);

  return (
    <div className="mt-4">
      <table className="w-full rounded border border-neutral-200 text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            {relatedParties.length > 0 && (
              <th className="px-4 py-2 text-left font-medium">Parte relacionada</th>
            )}
            <th className="px-4 py-2 text-left font-medium">Tipo</th>
            <th className="px-4 py-2 text-left font-medium">Descrição</th>
            <th className="px-4 py-2 text-right font-medium">Valor (USD)</th>
            <th className="w-20 px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-b border-neutral-100">
              {relatedParties.length > 0 && (
                <td className="px-4 py-2 text-neutral-600">
                  {t.relatedPartyId
                    ? partyMap.get(t.relatedPartyId) ?? "—"
                    : "—"}
                </td>
              )}
              <td className="px-4 py-2">{labels[t.transactionType] ?? t.transactionType}</td>
              <td className="px-4 py-2 text-neutral-600">{t.description ?? "—"}</td>
              <td className="px-4 py-2 text-right font-medium">
                {Number(t.amountUsd).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-2">
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  disabled={isPending}
                  className="text-red-600 hover:underline disabled:opacity-50"
                >
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-neutral-50 font-medium">
            <td className="px-4 py-2" colSpan={relatedParties.length > 0 ? 3 : 2}>
              Total
            </td>
            <td className="px-4 py-2 text-right">
              {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

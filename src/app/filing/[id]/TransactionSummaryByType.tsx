import type { ReportableTransaction } from "@/db";

type Props = {
  transactions: ReportableTransaction[];
  labels: Record<string, string>;
};

/** Totais por tipo de transação (alinhado ao formulário VulpeTax). */
export function TransactionSummaryByType({ transactions, labels }: Props) {
  const byType = new Map<string, number>();
  for (const t of transactions) {
    const current = byType.get(t.transactionType) ?? 0;
    byType.set(t.transactionType, current + Number(t.amountUsd));
  }

  const formLabels: Record<string, string> = {
    distribution: "Total de retiradas no ano fiscal (USD)",
    contribution: "Total transferido pessoalmente para a LLC (USD)",
    loan_from_owner: "Total transferido para a LLC (empréstimo) (USD)",
    loan_to_owner: "Total retirado pessoalmente da LLC (USD)",
    personal_expenses_paid_by_llc: "Despesas pessoais pagas com recursos da empresa (USD)",
    business_expenses_paid_personally: "Despesas empresariais pagas com recursos pessoais (USD)",
  };

  const order = [
    "distribution",
    "contribution",
    "loan_from_owner",
    "loan_to_owner",
    "personal_expenses_paid_by_llc",
    "business_expenses_paid_personally",
  ] as const;

  const rows = order.filter((type) => byType.has(type));
  if (rows.length === 0 && byType.size === 0) return null;

  const otherTypes = [...byType.entries()].filter(([k]) => !order.includes(k as (typeof order)[number]));
  const total = transactions.reduce((s, t) => s + Number(t.amountUsd), 0);

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-medium text-neutral-700">Resumo por tipo (formulário)</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((type) => (
            <tr key={type}>
              <td className="py-1 text-neutral-600">
                {formLabels[type] ?? labels[type] ?? type}
              </td>
              <td className="py-1 text-right font-medium">
                {(byType.get(type) ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
          {otherTypes.map(([type, amount]) => (
            <tr key={type}>
              <td className="py-1 text-neutral-600">{labels[type] ?? type}</td>
              <td className="py-1 text-right font-medium">
                {amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
          <tr className="border-t border-neutral-200 font-medium">
            <td className="py-2">Total</td>
            <td className="py-2 text-right">
              {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

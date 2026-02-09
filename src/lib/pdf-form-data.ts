import type { ReportableTransaction } from "@/db";

/** Totais por tipo de transação para o Form 5472 / VulpeTax. */
export function getTransactionTotalsByType(transactions: ReportableTransaction[]) {
  const byType = new Map<string, number>();
  for (const t of transactions) {
    const current = byType.get(t.transactionType) ?? 0;
    byType.set(t.transactionType, current + Number(t.amountUsd));
  }
  return byType;
}

export const FORM_LABELS: Record<string, string> = {
  distribution: "Total de retiradas no ano fiscal (USD)",
  contribution: "Total transferido pessoalmente para a LLC (USD)",
  loan_from_owner: "Total transferido para a LLC (empréstimo) (USD)",
  loan_to_owner: "Total retirado pessoalmente da LLC (USD)",
  personal_expenses_paid_by_llc:
    "Despesas pessoais pagas com recursos da empresa (USD)",
  business_expenses_paid_personally:
    "Despesas empresariais pagas com recursos pessoais (USD)",
};

const ORDER: readonly string[] = [
  "distribution",
  "contribution",
  "loan_from_owner",
  "loan_to_owner",
  "personal_expenses_paid_by_llc",
  "business_expenses_paid_personally",
];

export function getOrderedTotals(transactions: ReportableTransaction[]) {
  const byType = getTransactionTotalsByType(transactions);
  const total = transactions.reduce((s, t) => s + Number(t.amountUsd), 0);
  const rows: { type: string; label: string; amount: number }[] = [];

  for (const type of ORDER) {
    if (byType.has(type)) {
      rows.push({
        type,
        label: FORM_LABELS[type] ?? type,
        amount: byType.get(type)!,
      });
    }
  }

  const otherTypes = [...byType.entries()].filter(
    ([k]) => !ORDER.includes(k)
  );
  for (const [type, amount] of otherTypes) {
    rows.push({ type, label: FORM_LABELS[type] ?? type, amount });
  }

  return { rows, total };
}

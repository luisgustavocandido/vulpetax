import type { TaxFiling } from "@/db";
import type { RelatedParty } from "@/db";
import type { ReportableTransaction } from "@/db";

export type ReadinessItem = {
  id: string;
  message: string;
  severity: "blocking" | "warning";
};

export type ReadinessResult = {
  score: number; // 0-100
  blocking: ReadinessItem[];
  warnings: ReadinessItem[];
  readyToFile: boolean;
};

/**
 * Completeness engine: o que falta para fechar e enviar (Form 5472 + pro forma 1120).
 * Bloqueantes: impedem marcar "pronto para enviar".
 */
export function getTaxFilingReadiness(
  filing: TaxFiling,
  relatedParties: RelatedParty[],
  transactions: ReportableTransaction[]
): ReadinessResult {
  const blocking: ReadinessItem[] = [];
  const warnings: ReadinessItem[] = [];

  // Mínimo 1 related party obrigatório (Form 5472)
  if (relatedParties.length === 0) {
    blocking.push({
      id: "missing_related_party",
      message: "Cadastre ao menos 1 related party (titular estrangeiro).",
      severity: "blocking",
    });
  }

  // Transações com related party quando há parties cadastrados (recomendado)
  const hasParties = relatedParties.length > 0;
  const transactionsWithoutParty = hasParties
    ? transactions.filter((t) => !t.relatedPartyId)
    : [];
  if (transactionsWithoutParty.length > 0) {
    warnings.push({
      id: "tx_without_party",
      message: `${transactionsWithoutParty.length} transação(ões) sem related party atribuído.`,
      severity: "warning",
    });
  }

  // Documentação pendente em transações
  const pendingDoc = transactions.filter(
    (t) => t.documentationStatus === "pending" || t.documentationStatus == null
  );
  if (pendingDoc.length > 0 && transactions.length > 0) {
    warnings.push({
      id: "doc_pending",
      message: `${pendingDoc.length} transação(ões) com documentação pendente.`,
      severity: "warning",
    });
  }

  // Status ainda em rascunho
  if (filing.status === "draft" && blocking.length === 0) {
    warnings.push({
      id: "status_draft",
      message: "Declaração ainda em rascunho. Altere para 'Pronto para enviar' quando validado.",
      severity: "warning",
    });
  }

  const blockingCount = blocking.length;
  const warningCount = warnings.length;
  const readyToFile = blockingCount === 0;

  // Score simples: 100 - (blocking * 40) - (warning * 10), mínimo 0
  const score = Math.max(
    0,
    Math.min(100, 100 - blockingCount * 40 - warningCount * 10)
  );

  return {
    score,
    blocking,
    warnings,
    readyToFile,
  };
}

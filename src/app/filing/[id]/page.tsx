import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaxFilingWithTransactions } from "@/app/actions/tax-filings";
import { getRelatedPartiesByFiling } from "@/app/actions/related-parties";
import { getDeliveriesByFiling } from "@/app/actions/filing-deliveries";
import { getLLC } from "@/app/actions/llcs";
import { getClient } from "@/app/actions/clients";
import { reportableTransactionTypes } from "@/db";
import { TransactionForm } from "./TransactionForm";
import { TransactionList } from "./TransactionList";
import { StatusSelect } from "./StatusSelect";
import { RelatedPartiesSection } from "./RelatedPartiesSection";
import { ReadinessPanel } from "./ReadinessPanel";
import { FilingFormDataSection } from "./FilingFormDataSection";
import { TransactionSummaryByType } from "./TransactionSummaryByType";
import { DeclarationAccept } from "./DeclarationAccept";
import { FilingDeliverySection } from "./FilingDeliverySection";

const TRANSACTION_LABELS: Record<string, string> = {
  contribution: "Contribuição de capital",
  distribution: "Distribuição ao titular",
  loan_from_owner: "Empréstimo do titular à LLC",
  loan_to_owner: "Empréstimo da LLC ao titular",
  payment_for_services: "Pagamento por serviços",
  sale_of_inventory: "Venda de estoque",
  sale_of_tangible_property: "Venda de propriedade tangível",
  personal_expenses_paid_by_llc: "Despesas pessoais pagas com recursos da empresa",
  business_expenses_paid_personally: "Despesas empresariais pagas com recursos pessoais",
  other: "Outro",
};

export default async function FilingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const filing = await getTaxFilingWithTransactions(id);
  if (!filing) notFound();

  const [relatedParties, deliveries, llc] = await Promise.all([
    getRelatedPartiesByFiling(id),
    getDeliveriesByFiling(id),
    getLLC(filing.llcId),
  ]);
  const client = llc ? await getClient(llc.clientId) : null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={client ? `/client/${client.id}` : "/"}
          className="btn btn-ghost -ml-2 px-2 py-1"
        >
          ← {client?.fullName ?? "Clientes"}
        </Link>
        <h1 className="page-title">
          Declaração {filing.taxYear} — {llc?.name ?? "LLC"}
        </h1>
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <StatusSelect filingId={id} currentStatus={filing.status} />
          <span className="text-neutral-400">|</span>
          <span className="text-sm text-neutral-600">
            Prazo federal:{" "}
            {filing.federalDeadline
              ? new Date(filing.federalDeadline).toLocaleDateString("pt-BR")
              : "—"}
          </span>
          <span className="text-sm text-neutral-600">
            Prazo estado:{" "}
            {filing.stateDeadline
              ? new Date(filing.stateDeadline).toLocaleDateString("pt-BR")
              : "—"}
          </span>
          <span className="text-neutral-400">|</span>
          <Link
            href={`/filing/${id}/pdf`}
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Gerar PDF
          </Link>
        </div>
      </div>

      <ReadinessPanel
        filing={filing}
        relatedParties={relatedParties}
      />

      <RelatedPartiesSection taxFilingId={id} relatedParties={relatedParties} />

      <FilingFormDataSection filingId={id} filing={filing} />

      <section className="mb-8">
        <h2 className="mb-3 section-title">Form 5472 — Transações reportáveis</h2>
        <p className="mb-4 text-sm text-neutral-600">
          Todas as transações entre a LLC e o titular estrangeiro (você) no ano
          fiscal devem ser declaradas: contribuições, distribuições,
          empréstimos, pagamentos por serviços, etc.
        </p>
        <div className="card">
          <div className="card-body">
            <TransactionForm
              taxFilingId={id}
              relatedParties={relatedParties}
              transactionTypes={reportableTransactionTypes.map((t) => ({
                value: t,
                label: TRANSACTION_LABELS[t] ?? t,
              }))}
            />
          </div>
        </div>
        <TransactionSummaryByType transactions={filing.transactions} labels={TRANSACTION_LABELS} />
        <TransactionList
          transactions={filing.transactions}
          relatedParties={relatedParties}
          labels={TRANSACTION_LABELS}
        />
      </section>

      <DeclarationAccept filingId={id} filing={filing} />

      <FilingDeliverySection taxFilingId={id} deliveries={deliveries} />
    </div>
  );
}

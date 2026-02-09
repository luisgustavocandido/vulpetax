import { getTaxFilingReadiness } from "@/lib/readiness";
import type { TaxFiling, RelatedParty, ReportableTransaction } from "@/db";

type Props = {
  filing: TaxFiling & { transactions: ReportableTransaction[] };
  relatedParties: RelatedParty[];
};

export function ReadinessPanel({ filing, relatedParties }: Props) {
  const readiness = getTaxFilingReadiness(
    filing,
    relatedParties,
    filing.transactions
  );

  return (
    <div className="card mb-6">
      <div className="p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-700">
          Prontidão fiscal
        </h2>
      <div className="flex items-center gap-4">
        <div
          className={`text-2xl font-bold ${
            readiness.readyToFile ? "text-green-600" : "text-amber-600"
          }`}
        >
          {readiness.score}%
        </div>
        {readiness.readyToFile ? (
          <span className="text-sm text-green-700">
            Pronto para enviar (sem bloqueios).
          </span>
        ) : (
          <span className="text-sm text-amber-700">
            Corrija os itens bloqueantes abaixo.
          </span>
        )}
      </div>
      {(readiness.blocking.length > 0 || readiness.warnings.length > 0) && (
        <ul className="mt-3 space-y-1 text-sm">
          {readiness.blocking.map((b) => (
            <li key={b.id} className="text-red-700">
              ● {b.message}
            </li>
          ))}
          {readiness.warnings.map((w) => (
            <li key={w.id} className="text-amber-700">
              ○ {w.message}
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}

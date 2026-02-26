"use client";

import { formatUSD } from "@/lib/dashboardFilters";
import type { CommercialPerformanceRow } from "@/lib/dashboard/llcCommercialRepo";

type Props = { rows: CommercialPerformanceRow[] };

export function CommercialMetaTable({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Comercial</th>
            <th className="px-4 py-2 text-right font-medium text-gray-700">LLCs</th>
            <th className="px-4 py-2 text-right font-medium text-gray-700">Meta LLCs</th>
            <th className="px-4 py-2 text-right font-medium text-gray-700">Receita</th>
            <th className="px-4 py-2 text-right font-medium text-gray-700">Meta Receita</th>
            <th className="px-4 py-2 text-right font-medium text-gray-700">% Atingido</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {rows.map((r) => {
            const llcTarget = r.targets.llcTarget;
            const revTarget = r.targets.revenueTargetCents;
            const pctLlc = r.progress.llcsPct != null ? `${Math.round(r.progress.llcsPct * 100)}%` : "—";
            const pctRev = r.progress.revenuePct != null ? `${Math.round(r.progress.revenuePct * 100)}%` : "—";
            const metaLlc = llcTarget != null ? String(llcTarget) : "—";
            const metaRev = revTarget != null ? formatUSD(revTarget) : "—";
            return (
              <tr key={r.commercialId} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">{r.commercialName}</td>
                <td className="px-4 py-2 text-right text-gray-700">{r.current.llcs}</td>
                <td className="px-4 py-2 text-right text-gray-600">{metaLlc}</td>
                <td className="px-4 py-2 text-right text-gray-700">{formatUSD(r.current.revenueCents)}</td>
                <td className="px-4 py-2 text-right text-gray-600">{metaRev}</td>
                <td className="px-4 py-2 text-right">
                  {llcTarget != null || revTarget != null ? (
                    <span className="text-gray-700">{pctLlc} LLC · {pctRev} Rec</span>
                  ) : (
                    <span className="text-gray-400">Sem meta</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

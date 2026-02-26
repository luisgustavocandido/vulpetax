"use client";

import { formatUSD } from "@/lib/dashboardFilters";
import type { LlcDebugKpisResult } from "@/lib/dashboard/llcExecutiveRepo";

type Props = {
  data: LlcDebugKpisResult;
  range: { from: string; to: string };
};

export function DashboardDebugSection({ data, range }: Props) {
  return (
    <section className="mb-8 rounded-lg border border-amber-200 bg-amber-50/80 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-800">
        Diagnóstico do período (debug)
      </h2>
      <p className="mb-3 text-xs text-amber-700">
        Período: {range.from} a {range.to}
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-medium text-gray-700">companiesPaidCount</dt>
          <dd className="text-gray-900">{data.companiesPaidCount}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-700">llcItemsCount</dt>
          <dd className="text-gray-900">{data.llcItemsCount}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-700">revenueCents</dt>
          <dd className="text-gray-900">{data.revenueCents} ({formatUSD(data.revenueCents)})</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-700">criterioDataUsado</dt>
          <dd className="text-gray-900">{data.criterioDataUsado}</dd>
        </div>
      </dl>
    </section>
  );
}

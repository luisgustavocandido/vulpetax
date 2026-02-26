"use client";

import { getMixTargetPct, isMixAboveOrAtTarget, type MixKey } from "@/lib/dashboard/mixTargets";

type Props = {
  title: string;
  mixKey: MixKey;
  actualPct: number;
  count: number;
  total: number;
};

export function MixKpiCard({ title, mixKey, actualPct, count, total }: Props) {
  const targetPct = getMixTargetPct(mixKey);
  const aboveOrAt = isMixAboveOrAtTarget(mixKey, actualPct);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
            aboveOrAt ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
          title={aboveOrAt ? "Acima ou na meta" : "Abaixo da meta"}
        >
          {aboveOrAt ? "✓ meta" : "⚠ abaixo"}
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-gray-900">
        Atual {actualPct.toFixed(1)}% / Meta {targetPct}%
      </p>
      <p className="mt-0.5 text-xs text-gray-400">
        {count} de {total}
      </p>
    </div>
  );
}

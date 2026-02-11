"use client";

import { formatUSD } from "@/lib/dashboardFilters";
import type { TimeSeriesPoint } from "@/lib/dashboardQueries";

type Props = {
  title: string;
  subtitle?: string;
  points: TimeSeriesPoint[];
  height?: number;
};

/**
 * Gráfico de linha SVG simples baseado em paymentDate.
 * Sem bibliotecas pesadas - usa polyline para a linha.
 */
export function LineChart({ title, subtitle, points, height = 200 }: Props) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        <p className="mt-4 text-sm text-gray-500">Nenhum dado</p>
      </div>
    );
  }

  const values = points.map((p) => p.valueCents);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const lastVal = values[values.length - 1] ?? 0;

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const w = 600;
  const h = height;
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const xScale = (i: number) => padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
  const yScale = (v: number) => padding.top + chartH - (v / maxVal) * chartH;

  const pathPoints = points
    .map((p, i) => `${xScale(i)},${yScale(p.valueCents)}`)
    .join(" ");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="min-w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pathPoints}
          />
          {points.map((p, i) => (
            <g key={p.dateKey}>
              <title>{`${p.label}: ${formatUSD(p.valueCents)}`}</title>
              <circle
                cx={xScale(i)}
                cy={yScale(p.valueCents)}
                r="4"
                fill="#3b82f6"
                className="hover:r-6"
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 border-t border-gray-100 pt-3 text-xs">
        <span>
          <span className="font-medium text-gray-500">Máx:</span>{" "}
          <span className="font-medium text-gray-700">{formatUSD(maxVal)}</span>
        </span>
        <span>
          <span className="font-medium text-gray-500">Mín:</span>{" "}
          <span className="font-medium text-gray-700">{formatUSD(minVal)}</span>
        </span>
        <span>
          <span className="font-medium text-gray-500">Último:</span>{" "}
          <span className="font-medium text-gray-700">{formatUSD(lastVal)}</span>
        </span>
      </div>

      <div className="mt-2 max-h-24 overflow-y-auto">
        <ul className="space-y-1 text-xs text-gray-500">
          {points.slice(-8).reverse().map((p) => (
            <li key={p.dateKey} className="flex justify-between">
              <span>{p.label}</span>
              <span>{formatUSD(p.valueCents)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

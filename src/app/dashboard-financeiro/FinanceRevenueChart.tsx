"use client";

import { useState, useEffect } from "react";
import { formatUSD } from "@/lib/dashboardFilters";
import type { FinanceRevenueSeriesPoint } from "@/lib/financeDashboardQueries";

type Props = {
  title: string;
  subtitle?: string;
  points: FinanceRevenueSeriesPoint[];
  height?: number;
};

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m ?? "1", 10) - 1]}/${y}`;
}

export function FinanceRevenueChart({ title, subtitle, points, height = 220 }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        <p className="mt-4 text-sm text-slate-500">Sem cobranças pagas no período.</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        <div
          className="mt-4 animate-pulse rounded bg-slate-100"
          style={{ height: height ?? 220 }}
        />
      </div>
    );
  }

  const values = points.map((p) => p.revenueCents);
  const maxVal = Math.max(...values, 1);

  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const w = 600;
  const h = height;
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const xScale = (i: number) =>
    padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
  const yScale = (v: number) =>
    padding.top + chartH - (v / maxVal) * chartH;

  const pathPoints = points
    .map((p, i) => `${xScale(i)},${yScale(p.revenueCents)}`)
    .join(" ");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="min-w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <polyline
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pathPoints}
          />
          {points.map((p, i) => (
            <g key={p.month}>
              <title>
                {formatMonthLabel(p.month)}: {formatUSD(p.revenueCents)} ({p.paidCount}{" "}
                cobrança{p.paidCount !== 1 ? "s" : ""})
              </title>
              <circle
                cx={xScale(i)}
                cy={yScale(p.revenueCents)}
                r="4"
                fill="#0ea5e9"
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 max-h-24 overflow-y-auto">
        <ul className="space-y-1 text-xs text-slate-500">
          {points.slice(-8)
            .reverse()
            .map((p) => (
              <li key={p.month} className="flex justify-between">
                <span>{formatMonthLabel(p.month)}</span>
                <span>{formatUSD(p.revenueCents)} ({p.paidCount})</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

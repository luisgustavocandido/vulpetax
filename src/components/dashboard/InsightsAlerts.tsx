"use client";

import Link from "next/link";
import type { DashboardAlert } from "@/lib/dashboard/alerts";

type Props = { alerts: DashboardAlert[] };

const severityStyles = {
  success: "border-green-200 bg-green-50 text-green-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function InsightsAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Nenhum alerta para este período.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Insights do período</h3>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className={`flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm ${severityStyles[a.severity]}`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <span className="shrink-0">
                {a.severity === "success" && "✓"}
                {a.severity === "warn" && "⚠"}
                {a.severity === "info" && "ℹ"}
              </span>
              <div className="min-w-0">
                <span className="font-medium">{a.title}</span>
                {a.description != null && (
                  <p className="mt-0.5 text-xs opacity-90">{a.description}</p>
                )}
              </div>
            </div>
            {a.cta && (
              <Link
                href={a.cta.href}
                className="shrink-0 rounded border border-current/30 px-2 py-1 text-xs font-medium opacity-90 hover:opacity-100"
              >
                {a.cta.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

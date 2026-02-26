"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  COMMERCIAL_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  getDefaultDateRange,
  getPresetRange,
  getPresetFromRange,
  PRESET_KEYS,
  type DashboardFilters,
  type PresetKey,
} from "@/lib/dashboardFilters";

const PRESET_LABELS: Record<PresetKey, string> = {
  month: "Mês atual",
  last7: "Últimos 7 dias",
  previous_month: "Mês anterior",
  year: "Ano atual",
};

type Props = { values: DashboardFilters };

export function DashboardFilters({ values }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didSetDefaultDates = useRef(false);

  useEffect(() => {
    if (didSetDefaultDates.current) return;
    const from = searchParams.get("dateFrom");
    const to = searchParams.get("dateTo");
    if (from && to) return;
    didSetDefaultDates.current = true;
    const def = getDefaultDateRange();
    const next = new URLSearchParams(searchParams.toString());
    next.set("dateFrom", def.from);
    next.set("dateTo", def.to);
    next.set("preset", "month");
    router.replace(`${pathname}?${next.toString()}`);
  }, [pathname, router, searchParams]);

  const defaultRange = getDefaultDateRange();
  const activePreset =
    values.dateFrom && values.dateTo
      ? getPresetFromRange(values.dateFrom, values.dateTo)
      : "month";

  const applyPreset = (key: PresetKey) => {
    const r = getPresetRange(key);
    const next = new URLSearchParams(searchParams.toString());
    next.set("dateFrom", r.from);
    next.set("dateTo", r.to);
    next.set("preset", key);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const hasAny =
    (values.dateFrom && values.dateFrom !== defaultRange.from) ||
    (values.dateTo && values.dateTo !== defaultRange.to) ||
    !!values.commercial ||
    !!values.sdr ||
    !!values.paymentMethod;

  return (
    <form method="GET" action="/dashboard" className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Período:</span>
        {PRESET_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              activePreset === key
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
        {activePreset === "custom" && (
          <span className="text-sm text-gray-500">(Personalizado)</span>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700">
            Data pagamento de
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={values.dateFrom ?? defaultRange.from}
            className="mt-1 block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700">
            até
          </label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={values.dateTo ?? defaultRange.to}
            className="mt-1 block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="commercial" className="block text-sm font-medium text-gray-700">
            Comercial
          </label>
          <select
            id="commercial"
            name="commercial"
            defaultValue={values.commercial ?? ""}
            className="mt-1 block w-36 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {COMMERCIAL_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sdr" className="block text-sm font-medium text-gray-700">
            SDR
          </label>
          <select
            id="sdr"
            name="sdr"
            defaultValue={values.sdr ?? ""}
            className="mt-1 block w-36 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {COMMERCIAL_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
            Método pagamento
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue={values.paymentMethod ?? ""}
            className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Filtrar
          </button>
          {hasAny && (
            <a
              href={`/dashboard?dateFrom=${defaultRange.from}&dateTo=${defaultRange.to}&preset=month`}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Limpar
            </a>
          )}
        </div>
      </div>
    </form>
  );
}

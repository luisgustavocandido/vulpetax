"use client";

import {
  COMMERCIAL_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  type DashboardFilters,
} from "@/lib/dashboardFilters";

type Props = { values: DashboardFilters };

export function DashboardFilters({ values }: Props) {
  const hasAny =
    !!values.dateFrom ||
    !!values.dateTo ||
    !!values.commercial ||
    !!values.sdr ||
    !!values.paymentMethod;

  return (
    <form method="GET" action="/dashboard" className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700">
            Data pagamento de
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={values.dateFrom ?? ""}
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
            defaultValue={values.dateTo ?? ""}
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
            <a href="/dashboard" className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Limpar
            </a>
          )}
        </div>
      </div>
    </form>
  );
}

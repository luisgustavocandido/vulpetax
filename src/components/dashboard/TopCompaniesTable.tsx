"use client";

import Link from "next/link";
import { formatUSD } from "@/lib/dashboardFilters";

export type TopCompany = {
  companyName: string;
  customerCode: string;
  totalCents: number;
};

type Props = {
  companies: TopCompany[];
};

export function TopCompaniesTable({ companies }: Props) {
  if (companies.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Top 10 empresas por valor</h3>
        <p className="text-sm text-gray-500">Nenhum dado</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-700">Top 10 empresas por valor</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Empresa
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Código
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {companies.map((c) => (
              <tr key={c.customerCode} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm">
                  <Link
                    href={`/clients?q=${encodeURIComponent(c.companyName)}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {c.companyName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{c.customerCode}</td>
                <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                  {formatUSD(c.totalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

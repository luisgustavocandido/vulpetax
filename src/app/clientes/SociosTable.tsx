"use client";

import Link from "next/link";

export type PartnerRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  percentage: number;
  company: { id: string; name: string; code: string };
};

type SociosTableProps = {
  items: PartnerRow[];
};

function roleLabel(role: string): string {
  return role === "SocioPrincipal" ? "Sócio Principal" : "Sócio";
}

export function SociosTable({ items }: SociosTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        Nenhum sócio encontrado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Nome
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              E-mail
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Telefone
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Empresa
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Papel
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              %
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {items.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                {row.fullName || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                {row.email ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                {row.phone ?? "—"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-600">
                <Link
                  href={`/empresas/${row.company.id}`}
                  className="text-indigo-600 hover:underline"
                >
                  {row.company.name}
                </Link>
                {row.company.code && (
                  <span className="ml-1 text-gray-400">({row.company.code})</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                {roleLabel(row.role)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                {row.percentage.toFixed(1)}%
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                <Link
                  href={`/empresas/${row.company.id}`}
                  className="text-indigo-600 hover:underline"
                >
                  Abrir empresa
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

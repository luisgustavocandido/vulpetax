"use client";

import Link from "next/link";

export type CustomerRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  country: string | null;
  companiesCount: number;
  source: "customer" | "person_group";
};

type ClientesPagadoresTableProps = {
  items: CustomerRow[];
};

function formatAddress(row: CustomerRow): string {
  const parts = [row.addressLine1, row.city, row.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function ClientesPagadoresTable({ items }: ClientesPagadoresTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        Nenhum cliente pagador encontrado.
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
              Endereço
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Empresas
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
              <td className="max-w-[200px] truncate px-4 py-2 text-sm text-gray-600" title={formatAddress(row)}>
                {formatAddress(row)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                {row.companiesCount}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                <span className="flex justify-end gap-3">
                  <Link
                    href={`/clientes/pagadores/${encodeURIComponent(row.id)}`}
                    className="text-indigo-600 hover:underline"
                  >
                    Ver cliente
                  </Link>
                  <Link
                    href={`/clientes/pagadores/${encodeURIComponent(row.id)}/editar`}
                    className="text-indigo-600 hover:underline"
                  >
                    Editar
                  </Link>
                  {row.source === "customer" ? (
                    <Link
                      href={`/empresas?customerId=${encodeURIComponent(row.id)}`}
                      className="text-indigo-600 hover:underline"
                    >
                      Ver empresas
                    </Link>
                  ) : (
                    <Link
                      href={`/empresas/person/${encodeURIComponent(row.id)}`}
                      className="text-indigo-600 hover:underline"
                    >
                      Ver empresas
                    </Link>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

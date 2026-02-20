"use client";

import Link from "next/link";

export type ClientRow = {
  id: string;
  companyName: string;
  customerCode: string;
  paymentDate: string | null;
  commercial: string | null;
  paymentMethod: string | null;
  totalCents: number;
};

type ClientTableProps = {
  clients: ClientRow[];
  /** Ordenação atual por data de pagamento: desc = mais recente primeiro, asc = mais antigo primeiro */
  orderPaymentDate?: string | null;
  /** Parâmetros atuais da URL para montar o link de ordenação (page, limit, filtros, etc.) */
  searchParamsForSort?: Record<string, string>;
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("pt-BR");
  } catch {
    return s;
  }
}

function buildSortUrl(
  currentOrder: string | null | undefined,
  searchParams: Record<string, string> | undefined
): string {
  const params = new URLSearchParams(searchParams ?? {});
  // Ciclo: padrão → mais recente (desc) → mais antigo (asc) → padrão
  if (!currentOrder || currentOrder === "") {
    params.set("orderPaymentDate", "desc");
  } else if (currentOrder === "desc") {
    params.set("orderPaymentDate", "asc");
  } else {
    params.delete("orderPaymentDate");
  }
  const q = params.toString();
  return `/clients${q ? `?${q}` : ""}`;
}

function sortLabel(order: string | null | undefined): string {
  if (order === "desc") return "Data Pagamento ↓";
  if (order === "asc") return "Data Pagamento ↑";
  return "Data Pagamento";
}

export function ClientTable({
  clients,
  orderPaymentDate = null,
  searchParamsForSort = {},
}: ClientTableProps) {
  if (clients.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        Nenhum cliente encontrado.
      </div>
    );
  }

  const sortHref = buildSortUrl(orderPaymentDate, searchParamsForSort);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Empresa
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Código
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              <Link
                href={sortHref}
                className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 hover:underline"
                title={
                  orderPaymentDate === "desc"
                    ? "Clique para: mais antigo primeiro"
                    : orderPaymentDate === "asc"
                      ? "Clique para: ordenação padrão"
                      : "Clique para: mais recente primeiro"
                }
              >
                {sortLabel(orderPaymentDate)}
              </Link>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Comercial
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Pagamento via
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {clients.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">
                {c.companyName}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                {c.customerCode}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                {formatDate(c.paymentDate)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                {c.commercial ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-600">
                {c.paymentMethod ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                <Link href={`/clients/${c.id}`} className="text-blue-600 hover:text-blue-800">
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

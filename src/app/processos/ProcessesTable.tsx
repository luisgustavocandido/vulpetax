"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { formatDate } from "@/lib/pdf/formatHelpers";

type ProcessListItem = {
  id: string;
  clientId: string;
  companyName: string | null;
  kind: string;
  status: "open" | "in_progress" | "done";
  totalSteps: number;
  doneSteps: number;
  inProgressSteps: number;
  pendingSteps: number;
  progressPct: number;
  paymentDate: string | null;
  updatedAt: string;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
};

type Props = {
  items: ProcessListItem[];
  pagination: Pagination;
};

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function statusBadge(status: ProcessListItem["status"]) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Concluído
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Em andamento
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      Em aberto
    </span>
  );
}

export default function ProcessesTable({ items, pagination }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { page, limit, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handlePageChange = (nextPage: number) => {
    const u = new URLSearchParams(searchParams.toString());
    u.set("page", String(nextPage));
    router.push(`/processos?${u.toString()}`);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-600">
        Nenhum processo encontrado. Ajuste os filtros ou crie um novo processo a partir de um cliente/serviço.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200">
        <div className="w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Empresa
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">
                  Progresso
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">
                  Etapas
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Pagamento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Atualizado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Link
                      href={`/clients/${p.clientId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {p.companyName ?? "—"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                    <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {p.kind}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {statusBadge(p.status)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-slate-700">
                    <div className="mx-auto flex max-w-[120px] flex-col items-center gap-1">
                      <div className="flex w-full items-center overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${p.progressPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600">
                        {p.progressPct}% ({p.doneSteps}/{p.totalSteps})
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-slate-700">
                    <span className="inline-flex flex-col text-xs text-slate-600">
                      <span>Total: {p.totalSteps}</span>
                      <span>Em andamento: {p.inProgressSteps}</span>
                      <span>Pendentes: {p.pendingSteps}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                    {formatDate(p.paymentDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                    {formatDateTime(p.updatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <Link
                      href={`/processos/${p.id}`}
                      className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      Ver checklist
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Página {page} de {totalPages} ({total} processos)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


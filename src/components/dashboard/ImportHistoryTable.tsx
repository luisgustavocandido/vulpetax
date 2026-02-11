import type { ImportHistoryRow } from "@/lib/dashboardQueries";

type Props = {
  rows: ImportHistoryRow[];
};

function formatDate(d: Date): string {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImportHistoryTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Últimas importações</h3>
        <p className="text-sm text-gray-500">Nenhuma importação</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-700">Últimas importações</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Data
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                Arquivo
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                Importados
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                Erros
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-600">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-2 text-sm text-gray-900">{r.filename}</td>
                <td className="px-4 py-2 text-right text-sm text-gray-600">
                  {r.rowsImported} / {r.rowsTotal}
                </td>
                <td className="px-4 py-2 text-right text-sm">
                  {r.rowsErrors > 0 ? (
                    <span className="text-red-600">{r.rowsErrors}</span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

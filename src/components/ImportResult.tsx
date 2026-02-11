import Link from "next/link";

export type ImportError = { row: number; field: string; message: string };

type ImportResultProps = {
  rowsTotal: number;
  rowsImported: number;
  rowsErrors: number;
  errors: ImportError[];
};

/**
 * Exibe o resultado da importação (até 100 erros).
 */
export function ImportResult({
  rowsTotal,
  rowsImported,
  rowsErrors,
  errors,
}: ImportResultProps) {
  const displayErrors = errors.slice(0, 100);

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Resultado</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-600">
          <li>Total de linhas: {rowsTotal}</li>
          <li>Importadas: {rowsImported}</li>
          <li>Com erro: {rowsErrors}</li>
        </ul>
      </div>

      {displayErrors.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Erros {errors.length > 100 ? `(mostrando 100 de ${errors.length})` : ""}
          </h2>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left font-medium text-gray-700">Linha</th>
                  <th className="py-2 text-left font-medium text-gray-700">Campo</th>
                  <th className="py-2 text-left font-medium text-gray-700">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {displayErrors.map((e, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-600">{e.row}</td>
                    <td className="py-1.5 text-gray-600">{e.field}</td>
                    <td className="py-1.5 text-red-600">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Link
        href="/clients"
        className="inline-block text-sm text-blue-600 hover:underline"
      >
        Voltar para clientes
      </Link>
    </div>
  );
}

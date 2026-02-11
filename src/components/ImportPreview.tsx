"use client";

export type ImportPreviewSample = {
  clientPatch: Record<string, unknown>;
  partners: unknown[];
  items: unknown[];
};

export type ImportError = { row: number; field: string; message: string };

type ImportPreviewProps = {
  rowsTotal: number;
  rowsValid: number;
  rowsInvalid: number;
  sample: ImportPreviewSample[];
  errors: ImportError[];
};

/**
 * Exibe resultado do dry-run (pré-visualização).
 */
export function ImportPreview({
  rowsTotal,
  rowsValid,
  rowsInvalid,
  sample,
  errors,
}: ImportPreviewProps) {
  const displayErrors = errors.slice(0, 100);

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-amber-900">Pré-visualização (sem gravação)</h2>
        <ul className="mt-2 space-y-1 text-sm text-amber-800">
          <li>Total de linhas: {rowsTotal}</li>
          <li>Válidas: {rowsValid}</li>
          <li>Inválidas: {rowsInvalid}</li>
        </ul>
      </div>

      {sample.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Exemplo de dados normalizados ({sample.length} de 3)
          </h2>
          <div className="mt-2 space-y-4">
            {sample.map((s, idx) => (
              <div key={idx} className="rounded border border-gray-100 bg-gray-50 p-3 text-xs">
                <pre className="whitespace-pre-wrap break-all font-mono text-gray-700">
                  {JSON.stringify(
                    { clientPatch: s.clientPatch, partners: s.partners, items: s.items },
                    null,
                    2
                  )}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {displayErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-900">
            Erros / Avisos {errors.length > 100 ? `(mostrando 100 de ${errors.length})` : ""}
          </h2>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-red-200">
                  <th className="py-2 text-left font-medium text-red-800">Linha</th>
                  <th className="py-2 text-left font-medium text-red-800">Campo</th>
                  <th className="py-2 text-left font-medium text-red-800">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {displayErrors.map((e, i) => (
                  <tr key={i} className="border-b border-red-100">
                    <td className="py-1.5 text-red-700">{e.row}</td>
                    <td className="py-1.5 text-red-700">{e.field}</td>
                    <td className="py-1.5 text-red-600">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

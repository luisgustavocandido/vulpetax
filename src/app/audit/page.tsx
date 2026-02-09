import { getRecentAuditLog } from "@/app/actions/audit";

export default async function AuditPage() {
  const entries = await getRecentAuditLog();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">
        Audit log
      </h1>
      <p className="mb-4 text-sm text-neutral-600">
        Últimas alterações (quem, o quê, quando). Uso interno.
      </p>
      {entries.length === 0 ? (
        <p className="text-neutral-500">Nenhuma entrada no audit log.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-2 text-left font-medium">Quando</th>
                <th className="px-4 py-2 text-left font-medium">Usuário</th>
                <th className="px-4 py-2 text-left font-medium">Ação</th>
                <th className="px-4 py-2 text-left font-medium">Entidade</th>
                <th className="px-4 py-2 text-left font-medium">ID</th>
                <th className="px-4 py-2 text-left font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100">
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-600">
                    {e.createdAt ? new Date(e.createdAt).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {e.user ? `${e.user.name}` : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-2">{e.action}</td>
                  <td className="px-4 py-2">{e.entityType}</td>
                  <td className="font-mono text-neutral-500">{e.entityId.slice(0, 8)}…</td>
                  <td className="max-w-xs truncate px-4 py-2 text-neutral-600">
                    {e.oldValues != null && (
                      <span className="text-red-600">old: {String(e.oldValues).slice(0, 60)}… </span>
                    )}
                    {e.newValues != null && (
                      <span className="text-green-700">new: {String(e.newValues).slice(0, 60)}…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

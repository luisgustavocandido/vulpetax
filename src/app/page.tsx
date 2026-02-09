import Link from "next/link";
import { getClients } from "./actions/clients";
import { ClientDeleteButton } from "./client/ClientDeleteButton";

export default async function HomePage() {
  const clients = await getClients();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Cadastros e acesso rápido às declarações.
          </p>
        </div>
        <Link href="/client/new" className="btn btn-primary">
          Novo cliente
        </Link>
      </div>
      {clients.length === 0 ? (
        <div className="card border-dashed">
          <div className="card-body text-center">
            <p className="mb-2 text-neutral-600">
              Nenhum cliente cadastrado.
            </p>
            <Link href="/client/new" className="btn btn-secondary">
              Cadastrar primeiro cliente
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
            >
              <Link href={`/client/${c.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">
                      {c.fullName}
                    </p>
                    <p className="truncate text-sm text-neutral-600">
                      {c.email} · {c.country}
                    </p>
                  </div>
                  <span className="text-sm text-neutral-400">Ver →</span>
                </div>
              </Link>
              <ClientDeleteButton clientId={c.id} clientName={c.fullName} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientWithLlcs } from "@/app/actions/clients";
import { getTaxFilingsByLLC } from "@/app/actions/tax-filings";
import { ClientDeleteButton } from "../ClientDeleteButton";
import { LLCDeleteButton } from "./LLCDeleteButton";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getClientWithLlcs(id);
  if (!data) notFound();

  const llcsWithFilings = await Promise.all(
    data.llcs.map(async (llc) => {
      const filings = await getTaxFilingsByLLC(llc.id);
      return { ...llc, filings };
    })
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="btn btn-ghost -ml-2 px-2 py-1">
            ← Clientes
          </Link>
          <h1 className="page-title">{data.fullName}</h1>
        </div>
        <ClientDeleteButton clientId={id} clientName={data.fullName} />
      </div>

      <section className="card mb-8">
        <div className="card-body">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">
            Dados do titular
          </h2>
          <p className="text-neutral-700">{data.email}</p>
        {data.phone && (
          <p className="text-neutral-700">{data.phone}</p>
        )}
        <p className="text-neutral-700">{data.country}</p>
        {data.address && (
          <p className="text-neutral-500">{data.address}</p>
        )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">LLCs</h2>
          <Link
            href={`/client/${id}/llc/new`}
            className="btn btn-primary"
          >
            Nova LLC
          </Link>
        </div>

        {llcsWithFilings.length === 0 ? (
          <div className="card border-dashed">
            <div className="card-body text-center">
              <p className="text-neutral-600">Nenhuma LLC cadastrada.</p>
              <div className="mt-3">
                <Link href={`/client/${id}/llc/new`} className="btn btn-secondary">
                  Cadastrar LLC
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {llcsWithFilings.map((llc) => (
              <li
                key={llc.id}
                className="card"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">
                        {llc.name}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        EIN {llc.ein} · {llc.state} · Formada em{" "}
                        {new Date(llc.formationDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/client/${id}/llc/${llc.id}/filing/new`}
                        className="btn btn-secondary whitespace-nowrap"
                      >
                        Nova declaração
                      </Link>
                      <LLCDeleteButton llcId={llc.id} llcName={llc.name} />
                    </div>
                  </div>
                {llc.filings.length > 0 ? (
                  <ul className="mt-3 border-t border-neutral-100 pt-3">
                    {llc.filings.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 py-1">
                        <Link
                          href={`/filing/${f.id}`}
                          className="text-sm text-neutral-700 hover:underline"
                        >
                          Ano {f.taxYear} — {f.status}
                        </Link>
                        <span className="text-neutral-400">
                          (federal:{" "}
                          {f.federalDeadline
                            ? new Date(f.federalDeadline).toLocaleDateString(
                                "pt-BR"
                              )
                            : "—"}
                          )
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-neutral-500">
                    Nenhuma declaração.{" "}
                    <Link
                      href={`/client/${id}/llc/${llc.id}/filing/new`}
                      className="underline"
                    >
                      Criar declaração
                    </Link>
                  </p>
                )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

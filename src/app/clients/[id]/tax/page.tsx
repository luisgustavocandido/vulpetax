import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getBaseUrl } from "@/lib/api";
import { TaxForm } from "@/components/TaxForm";
import { TaxRemoveButton } from "@/components/tax/TaxRemoveButton";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientTaxPage({ params }: PageProps) {
  const { id } = await params;
  const base = getBaseUrl();
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";
  const res = await fetch(`${base}/api/clients/${id}/tax`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    if (res.status === 404) notFound();
    return (
      <div>
        <p className="text-red-600">Erro ao carregar dados fiscais.</p>
      </div>
    );
  }

  const data = await res.json();
  const { taxProfile, owners, client, computed } = data;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">TAX (Não Residentes)</h1>
        <div className="flex items-center gap-2">
          <TaxRemoveButton
            clientId={client.id}
            customerCode={client.customerCode}
            companyName={client.companyName}
            redirectOnSuccess
          />
          <Link
            href="/tax"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver todos os casos
          </Link>
        </div>
      </div>

      <TaxForm
        clientId={id}
        companyName={client.companyName}
        initialProfile={taxProfile}
        initialOwners={owners ?? []}
        status={computed.status}
        missingFields={computed.missingFields ?? []}
        alerts={computed.alerts ?? []}
      />
    </>
  );
}

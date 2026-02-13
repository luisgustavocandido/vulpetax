import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getBaseUrl } from "@/lib/api";
import { TaxForm } from "@/components/TaxForm";
import { TaxFormSelector } from "@/components/tax/TaxFormSelector";

type PageProps = {
  params: Promise<{ id: string; taxFormId: string }>;
};

export default async function ClientTaxFormPage({ params }: PageProps) {
  const { id, taxFormId } = await params;
  const base = getBaseUrl();
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${base}/api/clients/${id}/tax/forms/${taxFormId}`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    if (res.status === 404) notFound();
    return (
      <div>
        <p className="text-red-600">Erro ao carregar formulário TAX.</p>
      </div>
    );
  }

  const data = await res.json();
  const { taxForm, owners, client, computed } = data;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">TAX (Não Residentes)</h1>
          <p className="mt-1 text-sm text-slate-500">Ano fiscal: {taxForm.taxYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/tax"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver todos os casos
          </Link>
        </div>
      </div>

      <TaxFormSelector clientId={id} currentTaxFormId={taxFormId} />

      <div className="mt-6">
        <TaxForm
          clientId={id}
          taxFormId={taxFormId}
          companyName={client.companyName}
          initialProfile={taxForm}
          initialOwners={owners ?? []}
          status={computed.status}
          missingFields={computed.missingFields ?? []}
          alerts={computed.alerts ?? []}
        />
      </div>
    </>
  );
}

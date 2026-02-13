import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { getBaseUrl } from "@/lib/api";
import { ClientForm } from "@/components/ClientForm";
import { ClientDeleteButton } from "./ClientDeleteButton";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditClientPage({ params }: PageProps) {
  const { id } = await params;
  const base = getBaseUrl();
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";
  const res = await fetch(`${base}/api/clients/${id}`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    if (res.status === 404) notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-600">Erro ao carregar cliente.</p>
      </div>
    );
  }

  let client;
  try {
    const text = await res.text();
    if (!text) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-red-600">Resposta vazia do servidor.</p>
        </div>
      );
    }
    client = JSON.parse(text);
  } catch {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-600">Erro ao processar resposta do servidor.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Editar cliente</h1>
        <div className="flex gap-2">
          <Link
            href="/clients"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Voltar
          </Link>
          <ClientDeleteButton clientId={id} clientName={client.companyName} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <ClientForm
          initialData={{
            companyName: client.companyName,
            customerCode: client.customerCode,
            paymentDate: client.paymentDate ?? "",
            commercial: client.commercial ?? "",
            sdr: client.sdr ?? "",
            businessType: client.businessType ?? "",
            paymentMethod: client.paymentMethod ?? "",
            anonymous: client.anonymous ?? false,
            holding: client.holding ?? false,
            affiliate: client.affiliate ?? false,
            express: client.express ?? false,
            notes: client.notes ?? "",
            email: client.email ?? "",
            personalAddressLine1: client.personalAddressLine1 ?? "",
            personalAddressLine2: client.personalAddressLine2 ?? "",
            personalCity: client.personalCity ?? "",
            personalState: client.personalState ?? "",
            personalPostalCode: client.personalPostalCode ?? "",
            personalCountry: client.personalCountry ?? "",
            items: client.items ?? [],
            partners: client.partners ?? [],
          }}
          clientId={id}
        />
      </div>
    </>
  );
}

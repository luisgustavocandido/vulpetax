"use client";

import Link from "next/link";
import { ClientForm } from "@/components/ClientForm";
import { ClientDeleteButton } from "./ClientDeleteButton";
import { PdfPosVendaButton } from "@/components/PdfPosVendaButton";
import type { ClientFormData } from "@/components/ClientForm";
import type { InitialClientForEdit } from "@/lib/serialize/clientToInitialClient";

type ClientEditPageProps = {
  clientId: string;
  initialClient: InitialClientForEdit;
};

/**
 * Wrapper client para a tela de edição de cliente.
 * Concentra Link, botões e ClientForm em uma única árvore client,
 * evitando "Invalid hook call" / useContext null ao navegar após salvar.
 */
export function ClientEditPage({ clientId, initialClient }: ClientEditPageProps) {
  const initialData: Partial<ClientFormData> & {
    lineItems?: ClientFormData["lineItems"];
    partners?: ClientFormData["partners"];
  } = {
    companyName: initialClient.companyName,
    customerCode: initialClient.customerCode ?? "",
    paymentDate: initialClient.paymentDate ?? "",
    commercial: initialClient.commercial ?? "",
    sdr: initialClient.sdr ?? "",
    businessType: initialClient.businessType ?? "",
    paymentMethod: initialClient.paymentMethod ?? "",
    anonymous: initialClient.anonymous ?? false,
    holding: initialClient.holding ?? false,
    affiliate: initialClient.affiliate ?? false,
    express: initialClient.express ?? false,
    notes: initialClient.notes ?? "",
    email: initialClient.email ?? "",
    personalAddressLine1: initialClient.personalAddressLine1 ?? "",
    personalAddressLine2: initialClient.personalAddressLine2 ?? "",
    personalCity: initialClient.personalCity ?? "",
    personalState: initialClient.personalState ?? "",
    personalPostalCode: initialClient.personalPostalCode ?? "",
    personalCountry: initialClient.personalCountry ?? "",
    lineItems: initialClient.lineItems ?? [],
    partners: initialClient.partners ?? [],
  };

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Editar cliente</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/clients"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Voltar
          </Link>
          <PdfPosVendaButton clientId={clientId} />
          <ClientDeleteButton
            clientId={clientId}
            clientName={initialClient.companyName}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <ClientForm
          key={clientId}
          initialData={initialData}
          clientId={clientId}
        />
      </div>
    </>
  );
}

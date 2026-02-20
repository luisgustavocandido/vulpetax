/**
 * Server-only: do not render Link/hooks here.
 * This file must only fetch data and pass serializable props to ClientEditPage.
 * Do not import: next/link, useState, useEffect, or client-only UI (shadcn/radix).
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getBaseUrl } from "@/lib/api";
import { clientToInitialClient } from "@/lib/serialize/clientToInitialClient";
import { ClientEditPage } from "./ClientEditPage";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Server Component: apenas busca dados e repassa ao ClientEditPage.
 * initialClient é normalizado por clientToInitialClient (RSC-safe, sem Date/Decimal).
 */
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

  let raw: unknown;
  try {
    const text = await res.text();
    if (!text) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-red-600">Resposta vazia do servidor.</p>
        </div>
      );
    }
    raw = JSON.parse(text);
  } catch {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-600">Erro ao processar resposta do servidor.</p>
      </div>
    );
  }

  const initialClient = clientToInitialClient(raw);

  return <ClientEditPage clientId={id} initialClient={initialClient} />;
}

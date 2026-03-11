/**
 * Página somente leitura "Ver empresa". Busca dados e repassa ao ClientViewPage.
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getBaseUrl } from "@/lib/api";
import { clientToInitialClient } from "@/lib/serialize/clientToInitialClient";
import { ClientViewPage } from "@/app/clients/[id]/ClientViewPage";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmpresaVerPage({ params }: PageProps) {
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
        <p className="text-red-600">Erro ao carregar empresa.</p>
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

  return (
    <ClientViewPage
      clientId={id}
      initialClient={initialClient}
      basePath="/empresas"
    />
  );
}

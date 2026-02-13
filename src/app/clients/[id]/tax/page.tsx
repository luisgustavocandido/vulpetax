import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getBaseUrl } from "@/lib/api";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Rota de compatibilidade: /clients/[id]/tax
 * Redireciona para o TAX form padrão (draft mais recente ou mais recente de qualquer status)
 * Se não houver nenhum, redireciona para criar novo
 */
export default async function ClientTaxPage({ params }: PageProps) {
  const { id } = await params;
  const base = getBaseUrl();
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  // Tentar encontrar form padrão
  const defaultRes = await fetch(`${base}/api/clients/${id}/tax/default`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (defaultRes.ok) {
    const defaultData = await defaultRes.json();
    if (defaultData.taxFormId) {
      redirect(`/clients/${id}/tax/${defaultData.taxFormId}`);
      return null;
    }
  }

  // Se não houver form padrão, verificar se existe client_tax_profile (compatibilidade antiga)
  const legacyRes = await fetch(`${base}/api/clients/${id}/tax`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (legacyRes.ok) {
    // Se existe profile antigo, criar um form para o ano atual e migrar
    // Por enquanto, apenas redirecionar para criar novo
    redirect(`/clients/${id}/tax/new`);
    return null;
  }

  // Se não houver nada, criar novo
  redirect(`/clients/${id}/tax/new`);
  return null;
}

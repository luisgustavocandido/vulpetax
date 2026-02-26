import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string; taxFormId: string }>;
};

/**
 * Redirect legado: /clients/[id]/tax/[taxFormId] -> /empresas/[id]/tax/[taxFormId]
 */
export default async function ClientTaxFormPageRedirect({ params }: PageProps) {
  const { id, taxFormId } = await params;
  redirect(`/empresas/${id}/tax/${taxFormId}`);
}

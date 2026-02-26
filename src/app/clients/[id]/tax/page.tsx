import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Redirect legado: /clients/[id]/tax -> /empresas/[id]/tax
 */
export default async function ClientTaxPageRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/empresas/${id}/tax`);
}

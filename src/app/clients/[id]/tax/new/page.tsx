import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Redirect legado: /clients/[id]/tax/new -> /empresas/[id]/tax/new
 */
export default async function NewTaxFormPageRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/empresas/${id}/tax/new`);
}

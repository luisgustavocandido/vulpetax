import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Redirect legado: /clients/[id] -> /empresas/[id]
 */
export default async function ClientIdPageRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/empresas/${id}`);
}

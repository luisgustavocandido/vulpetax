import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ personGroupId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Redirect legado: /clients/person/[personGroupId] -> /empresas/person/[personGroupId]
 */
export default async function PersonGroupClientsPageRedirect({ params, searchParams }: PageProps) {
  const { personGroupId } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((val) => qs.append(k, val));
    } else {
      qs.set(k, v);
    }
  }
  const query = qs.toString();
  redirect(query ? `/empresas/person/${personGroupId}?${query}` : `/empresas/person/${personGroupId}`);
}

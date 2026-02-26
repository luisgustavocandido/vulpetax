import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Redirect legado: /clients -> /empresas (preserva query string).
 */
export default async function ClientsPageRedirect({ searchParams }: PageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((val) => qs.append(k, val));
    } else {
      qs.set(k, v);
    }
  }
  const query = qs.toString();
  redirect(query ? `/empresas?${query}` : "/empresas");
}

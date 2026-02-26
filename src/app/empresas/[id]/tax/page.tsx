import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getBaseUrl } from "@/lib/api";

type PageProps = {
  params: Promise<{ id: string }>;
};

const BASE_PATH = "/empresas";

export default async function EmpresaTaxPage({ params }: PageProps) {
  const { id } = await params;
  const base = getBaseUrl();
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const defaultRes = await fetch(`${base}/api/clients/${id}/tax/default`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (defaultRes.ok) {
    const defaultData = await defaultRes.json();
    if (defaultData.taxFormId) {
      redirect(`${BASE_PATH}/${id}/tax/${defaultData.taxFormId}`);
      return null;
    }
  }

  const legacyRes = await fetch(`${base}/api/clients/${id}/tax`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (legacyRes.ok) {
    redirect(`${BASE_PATH}/${id}/tax/new`);
    return null;
  }

  redirect(`${BASE_PATH}/${id}/tax/new`);
  return null;
}

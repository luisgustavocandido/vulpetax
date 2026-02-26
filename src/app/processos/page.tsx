import { headers } from "next/headers";
import { getBaseUrlFromHeaders } from "@/lib/api";
import ProcessesPageClient from "./ProcessesPageClient";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function ProcessosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  const keys = ["q", "status", "assignee", "department", "kind", "paymentDateFrom", "paymentDateTo", "sort", "page", "limit"] as const;
  for (const key of keys) {
    const v = params[key];
    if (v && typeof v === "string") sp.set(key, v);
  }

  const headersList = await headers();
  const base = getBaseUrlFromHeaders(headersList);
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${base}/api/processes?${sp.toString()}`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    let message = "Erro ao carregar processos.";
    try {
      const text = await res.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          message = json.error ?? message;
        } catch {
          message = text.length > 200 ? message : text;
        }
      }
    } catch {
      // ignore
    }
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{message}</p>
      </div>
    );
  }

  const json = await res.json();

  return (
    <ProcessesPageClient
      initialData={json}
      initialSearchParams={Object.fromEntries(sp.entries())}
    />
  );
}

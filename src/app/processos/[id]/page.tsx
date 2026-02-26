import { headers } from "next/headers";
import { getBaseUrlFromHeaders } from "@/lib/api";
import ProcessDetailClient from "./ProcessDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ProcessDetailPage({ params }: PageProps) {
  const { id } = await params;
  const headersList = await headers();
  const base = getBaseUrlFromHeaders(headersList);
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${base}/api/processes/${id}`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    let message = "Erro ao carregar processo.";
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
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{message}</p>
      </div>
    );
  }

  const json = await res.json();

  return <ProcessDetailClient data={json} />;
}


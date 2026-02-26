import Link from "next/link";
import { headers } from "next/headers";
import { getBaseUrlFromHeaders } from "@/lib/api";
import { Pagination } from "@/components/Pagination";

type PageProps = {
  params: Promise<{ personGroupId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ClientRow = { id: string; companyName: string; customerCode: string };

const LIMIT = 20;
const BASE_PATH = "/empresas";

export default async function EmpresasPersonGroupPage({ params, searchParams }: PageProps) {
  const { personGroupId } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.limit) || LIMIT));
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const searchParamsStr = new URLSearchParams();
  searchParamsStr.set("page", String(page));
  searchParamsStr.set("limit", String(limit));
  if (q) searchParamsStr.set("q", q);

  const headersList = await headers();
  const base = getBaseUrlFromHeaders(headersList);
  const apiUrl = `${base}/api/clients/by-person/${encodeURIComponent(personGroupId)}?${searchParamsStr.toString()}`;
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(apiUrl, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    if (res.status === 400) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-8">
          <p className="text-red-600">Grupo inválido.</p>
          <Link href={BASE_PATH} className="mt-2 inline-block text-indigo-600 hover:underline">
            Voltar para empresas
          </Link>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-red-600">Erro ao carregar empresas desta pessoa.</p>
        <Link href={BASE_PATH} className="mt-2 inline-block text-indigo-600 hover:underline">
          Voltar para empresas
        </Link>
      </div>
    );
  }

  const json = (await res.json()) as { data?: ClientRow[]; total?: number; page?: number; limit?: number };
  const data = json.data ?? [];
  const total = json.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Empresas desta pessoa</h1>
        <Link
          href={BASE_PATH}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Voltar para empresas
        </Link>
      </div>

      {data.length === 0 ? (
        <p className="text-gray-600">Nenhuma empresa encontrada para este grupo.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Empresa
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Código
                  </th>
                  <th scope="col" className="relative px-4 py-3">
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {row.companyName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {row.customerCode}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <Link href={`${BASE_PATH}/${row.id}`} className="font-medium text-indigo-600 hover:underline">
                        Ver empresa
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                page={page}
                total={total}
                limit={limit}
                basePath={`${BASE_PATH}/person/${personGroupId}`}
                searchParams={q ? { q } : {}}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

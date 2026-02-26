import Link from "next/link";
import { headers } from "next/headers";
import { getBaseUrlFromHeaders } from "@/lib/api";
import { ClientTable } from "@/components/ClientTable";
import { Pagination } from "@/components/Pagination";
import { ClientsFilters } from "@/components/ClientsFilters";

const FILTER_KEYS = [
  "q", "commercial", "sdr", "paymentDateFrom", "paymentDateTo",
  "paymentMethod", "anonymous", "holding", "affiliate", "express",
  "hasPartners", "orderPaymentDate", "customerId",
] as const;

const BASE_PATH = "/empresas";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmpresasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));

  const searchParamsStr = new URLSearchParams();
  searchParamsStr.set("page", String(page));
  searchParamsStr.set("limit", String(limit));
  for (const k of FILTER_KEYS) {
    const v = params[k];
    if (v && typeof v === "string") searchParamsStr.set(k, v);
  }

  const filterValues: Record<string, string> = {};
  for (const k of FILTER_KEYS) {
    const v = params[k];
    filterValues[k] = typeof v === "string" ? v : "";
  }
  filterValues.limit = String(limit);

  const headersList = await headers();
  const base = getBaseUrlFromHeaders(headersList);
  const apiUrl = `${base}/api/clients?${searchParamsStr.toString()}`;
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(apiUrl, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    let errorMessage = "Erro desconhecido";
    try {
      const text = await res.text();
      if (text) {
        try {
          const errorJson = JSON.parse(text);
          errorMessage = errorJson.error ?? errorMessage;
        } catch {
          errorMessage = text.length > 100 ? "Erro ao processar resposta do servidor" : text;
        }
      }
    } catch {
      // ignore
    }
    if (res.status === 401) {
      errorMessage = "Não autenticado. Faça login novamente.";
    } else if (res.status === 500) {
      errorMessage = errorMessage === "Erro desconhecido"
        ? "Erro interno do servidor. Verifique os logs."
        : errorMessage;
    }
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-red-800 font-medium">Erro ao carregar empresas</p>
          <p className="text-red-700 text-sm mt-1">{errorMessage}</p>
          {res.status === 401 && (
            <Link
              href={`/login?callbackUrl=${BASE_PATH}`}
              className="inline-block mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Ir para o login →
            </Link>
          )}
        </div>
      </div>
    );
  }

  let json;
  try {
    const text = await res.text();
    json = text ? JSON.parse(text) : { data: [], total: 0, page: 1 };
  } catch {
    return (
      <div className="p-6">
        <p className="text-red-600">Erro ao processar resposta do servidor.</p>
      </div>
    );
  }

  const { data, total, page: currentPage } = json;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Empresas</h1>
          <div className="flex gap-2">
            <Link
              href={`${BASE_PATH}/import`}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Importar
            </Link>
            <Link
              href={`${BASE_PATH}/new`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Nova empresa
            </Link>
          </div>
        </div>
      </div>

      <ClientsFilters values={filterValues} basePath={BASE_PATH} />

      <ClientTable
        clients={data}
        orderPaymentDate={filterValues.orderPaymentDate ?? null}
        searchParamsForSort={Object.fromEntries(searchParamsStr.entries())}
        basePath={BASE_PATH}
        emptyMessage="Nenhuma empresa encontrada."
      />

      <Pagination
        page={currentPage}
        total={total}
        limit={limit}
        basePath={BASE_PATH}
        searchParams={Object.fromEntries(searchParamsStr.entries())}
      />
    </div>
  );
}

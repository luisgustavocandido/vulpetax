import Link from "next/link";
import { headers } from "next/headers";
import { getBaseUrl } from "@/lib/api";
import { ClientTable } from "@/components/ClientTable";
import { Pagination } from "@/components/Pagination";
import { ClientsFilters } from "@/components/ClientsFilters";
import { ClientsSyncPanel } from "@/components/clients/ClientsSyncPanel";

const FILTER_KEYS = [
  "q", "commercial", "sdr", "paymentDateFrom", "paymentDateTo",
  "paymentMethod", "anonymous", "holding", "affiliate", "express",
  "hasPartners",
] as const;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Server: fetches da API (com cookies para auth), passa dados para ClientTable e Pagination.
 */
export default async function ClientsPage({ searchParams }: PageProps) {
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

  const base = getBaseUrl();
  const apiUrl = `${base}/api/clients?${searchParamsStr.toString()}`;
  const headersList = await headers();
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
          // Se não for JSON válido, usar o texto como mensagem
          errorMessage = text.length > 100 ? "Erro ao processar resposta do servidor" : text;
        }
      }
    } catch {
      // Ignore errors ao ler resposta
    }
    
    // Mensagens mais específicas baseadas no status
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
          <p className="text-red-800 font-medium">Erro ao carregar clientes</p>
          <p className="text-red-700 text-sm mt-1">{errorMessage}</p>
          {process.env.NODE_ENV === "development" && (
            <>
              <p className="text-red-600 text-xs mt-2">Status: {res.status}</p>
              {errorMessage.includes("conexão") && (
                <div className="mt-3 text-xs text-red-600 bg-red-100 p-2 rounded">
                  <p className="font-semibold">Soluções possíveis:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Verifique se o PostgreSQL está rodando: <code className="bg-red-200 px-1 rounded">brew services list</code> (se instalado via Homebrew)</li>
                    <li>Verifique a porta do banco: <code className="bg-red-200 px-1 rounded">lsof -i :5433</code></li>
                    <li>Execute as migrações: <code className="bg-red-200 px-1 rounded">npm run db:migrate</code></li>
                  </ul>
                </div>
              )}
              {errorMessage.includes("Tabelas não encontradas") && (
                <div className="mt-3 text-xs text-red-600 bg-red-100 p-2 rounded">
                  <p className="font-semibold">Execute as migrações:</p>
                  <code className="block bg-red-200 px-2 py-1 rounded mt-1">npm run db:migrate</code>
                </div>
              )}
            </>
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
          <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
          <div className="flex gap-2">
            <Link
              href="/clients/import"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Importar
            </Link>
            <Link
              href="/clients/new"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Novo cliente
            </Link>
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-medium uppercase text-gray-500">
            Sincronização Google Sheets (Pós-Venda LLC)
          </p>
          <ClientsSyncPanel />
        </div>
      </div>

      <ClientsFilters values={filterValues} />

      <ClientTable clients={data} />

      <Pagination
        page={currentPage}
        total={total}
        limit={limit}
        basePath="/clients"
        searchParams={Object.fromEntries(searchParamsStr.entries())}
      />
    </div>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { getBaseUrlFromHeaders } from "@/lib/api";
import { ClientesPagadoresTable } from "./ClientesPagadoresTable";
import { SociosTable } from "./SociosTable";
import { Pagination } from "@/components/Pagination";
import { ClientesTabsFilters } from "./ClientesTabsFilters";

const TAB_VALUES = ["customers", "partners"] as const;
type TabValue = (typeof TAB_VALUES)[number];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab: TabValue =
    params.tab === "partners" ? "partners" : "customers";
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const sort = typeof params.sort === "string" ? params.sort : "name_asc";

  const searchParamsStr = new URLSearchParams();
  searchParamsStr.set("tab", tab);
  searchParamsStr.set("page", String(page));
  searchParamsStr.set("limit", String(limit));
  if (q) searchParamsStr.set("q", q);
  if (sort && tab === "customers") searchParamsStr.set("sort", sort);

  const filterValues: Record<string, string> = {
    tab,
    q,
    sort: tab === "customers" ? sort : "",
    page: String(page),
    limit: String(limit),
  };

  const headersList = await headers();
  const base = getBaseUrlFromHeaders(headersList);
  const cookie = headersList.get("cookie") ?? "";

  let customersData: { items: Array<{ id: string; fullName: string; email: string | null; phone: string | null; addressLine1: string | null; city: string | null; country: string | null }>; total: number } = { items: [], total: 0 };
  let partnersData: { items: Array<{ id: string; fullName: string; email: string | null; phone: string | null; role: string; percentage: number; company: { id: string; name: string; code: string } }>; total: number } = { items: [], total: 0 };

  if (tab === "customers") {
    const apiUrl = `${base}/api/customers?page=${page}&limit=${limit}&sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    const res = await fetch(apiUrl, { cache: "no-store", headers: { cookie } });
    if (res.ok) {
      const json = await res.json();
      customersData = { items: json.items ?? [], total: json.total ?? 0 };
    }
  } else {
    const apiUrl = `${base}/api/partners?page=${page}&limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    const res = await fetch(apiUrl, { cache: "no-store", headers: { cookie } });
    if (res.ok) {
      const json = await res.json();
      partnersData = { items: json.items ?? [], total: json.total ?? 0 };
    }
  }

  const total = tab === "customers" ? customersData.total : partnersData.total;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-600">
            Clientes (pagadores) e Sócios (apenas sócios).
          </p>
        </div>
        <div className="shrink-0">
          <Link
            href="/clientes/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Cadastrar cliente
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Abas">
          <Link
            href={tab === "customers" ? "#" : "/clientes?tab=customers"}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              tab === "customers"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Clientes (Pagadores)
          </Link>
          <Link
            href={tab === "partners" ? "#" : "/clientes?tab=partners"}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              tab === "partners"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Sócios
          </Link>
        </nav>
      </div>

      <ClientesTabsFilters values={filterValues} tab={tab} />

      {tab === "customers" && (
        <ClientesPagadoresTable items={customersData.items} />
      )}
      {tab === "partners" && (
        <SociosTable items={partnersData.items} />
      )}

      <Pagination
        page={page}
        total={total}
        limit={limit}
        basePath="/clientes"
        searchParams={{
          tab,
          ...(q ? { q } : {}),
          ...(tab === "customers" && sort ? { sort } : {}),
        }}
      />
    </div>
  );
}

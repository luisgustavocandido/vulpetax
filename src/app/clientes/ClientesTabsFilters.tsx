"use client";

type TabValue = "customers" | "partners";

type ClientesTabsFiltersProps = {
  values: Record<string, string>;
  tab: TabValue;
};

export function ClientesTabsFilters({ values, tab }: ClientesTabsFiltersProps) {
  return (
    <form method="GET" action="/clientes" className="mb-4 space-y-4">
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="page" value="1" />
      <input type="hidden" name="limit" value={values.limit ?? "20"} />
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="q" className="block text-xs font-medium uppercase text-gray-500">
            Busca
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={values.q}
            placeholder={tab === "customers" ? "Nome, e-mail ou telefone" : "Nome, e-mail ou telefone"}
            className="mt-1 block w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {tab === "customers" && (
          <div>
            <label htmlFor="sort" className="block text-xs font-medium uppercase text-gray-500">
              Ordenar
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={values.sort || "name_asc"}
              className="mt-1 block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="name_asc">Nome A–Z</option>
              <option value="name_desc">Nome Z–A</option>
              <option value="recent">Mais recentes</option>
            </select>
          </div>
        )}
        <button
          type="submit"
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Filtrar
        </button>
        {(values.q ?? "").trim() && (
          <a
            href={`/clientes?tab=${tab}&page=1&limit=${values.limit ?? "20"}`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Limpar
          </a>
        )}
      </div>
    </form>
  );
}

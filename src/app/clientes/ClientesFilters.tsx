"use client";

type FilterValues = {
  q?: string;
  page?: string;
  limit?: string;
  sort?: string;
  order?: string;
};

type ClientesFiltersProps = {
  values: FilterValues;
};

export function ClientesFilters({ values }: ClientesFiltersProps) {
  return (
    <form method="GET" action="/clientes" className="mb-4 space-y-4">
      <input type="hidden" name="page" value="1" />
      <input type="hidden" name="limit" value={values.limit ?? "20"} />
      {values.sort && <input type="hidden" name="sort" value={values.sort} />}
      {values.order && <input type="hidden" name="order" value={values.order} />}

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
            placeholder="Nome, e-mail ou empresa"
            className="mt-1 block w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Filtrar
        </button>
        {(values.q ?? "").trim() && (
          <a
            href="/clientes?page=1&limit=20"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Limpar
          </a>
        )}
      </div>
    </form>
  );
}

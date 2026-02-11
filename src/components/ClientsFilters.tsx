type FilterValues = {
  q?: string;
  commercial?: string;
  sdr?: string;
  paymentDateFrom?: string;
  paymentDateTo?: string;
  paymentMethod?: string;
  anonymous?: string;
  holding?: string;
  affiliate?: string;
  express?: string;
  hasPartners?: string;
  page?: string;
  limit?: string;
};

type ClientsFiltersProps = {
  values: FilterValues;
};

const COMMERCIAL_OPTIONS = ["", "João", "Pablo", "Gabriel", "Gustavo"];
const PAYMENT_METHOD_OPTIONS = ["", "Stripe", "PIX", "Outro"];
const HAS_PARTNERS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "true", label: "Com sócios" },
  { value: "false", label: "Sem sócios" },
];

function hasAnyFilter(v: FilterValues): boolean {
  return !!(
    v.q ||
    v.commercial ||
    v.sdr ||
    v.paymentDateFrom ||
    v.paymentDateTo ||
    v.paymentMethod ||
    v.anonymous ||
    v.holding ||
    v.affiliate ||
    v.express ||
    v.hasPartners
  );
}

export function ClientsFilters({ values }: ClientsFiltersProps) {
  const anyFilter = hasAnyFilter(values);

  return (
    <form method="GET" action="/clients" className="mb-4 space-y-4">
      <input type="hidden" name="page" value="1" />
      <input type="hidden" name="limit" value={values.limit ?? "20"} />

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-gray-700">
            Busca
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={values.q}
            placeholder="Empresa ou código"
            className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="commercial" className="block text-sm font-medium text-gray-700">
            Comercial
          </label>
          <select
            id="commercial"
            name="commercial"
            defaultValue={values.commercial ?? ""}
            className="mt-1 block w-36 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {COMMERCIAL_OPTIONS.map((o) => (
              <option key={o || "_"} value={o}>
                {o || "—"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sdr" className="block text-sm font-medium text-gray-700">
            SDR
          </label>
          <select
            id="sdr"
            name="sdr"
            defaultValue={values.sdr ?? ""}
            className="mt-1 block w-36 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {COMMERCIAL_OPTIONS.map((o) => (
              <option key={o || "_"} value={o}>
                {o || "—"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="paymentDateFrom" className="block text-sm font-medium text-gray-700">
            Pagamento de
          </label>
          <input
            id="paymentDateFrom"
            name="paymentDateFrom"
            type="date"
            defaultValue={values.paymentDateFrom}
            className="mt-1 block w-36 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="paymentDateTo" className="block text-sm font-medium text-gray-700">
            até
          </label>
          <input
            id="paymentDateTo"
            name="paymentDateTo"
            type="date"
            defaultValue={values.paymentDateTo}
            className="mt-1 block w-36 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
            Método pagamento
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue={values.paymentMethod ?? ""}
            className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o || "_"} value={o}>
                {o || "—"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="hasPartners" className="block text-sm font-medium text-gray-700">
            Sócios
          </label>
          <select
            id="hasPartners"
            name="hasPartners"
            defaultValue={values.hasPartners ?? ""}
            className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {HAS_PARTNERS_OPTIONS.map((o) => (
              <option key={o.value || "_"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Filtrar
          </button>
          {anyFilter && (
            <a
              href="/clients?page=1&limit=20"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Limpar filtros
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-6 border-t border-gray-100 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Anônimo</span>
          <select
            name="anonymous"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            defaultValue={values.anonymous ?? ""}
          >
            <option value="">—</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Holding</span>
          <select
            name="holding"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            defaultValue={values.holding ?? ""}
          >
            <option value="">—</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Afiliado</span>
          <select
            name="affiliate"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            defaultValue={values.affiliate ?? ""}
          >
            <option value="">—</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Express</span>
          <select
            name="express"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            defaultValue={values.express ?? ""}
          >
            <option value="">—</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
      </div>
    </form>
  );
}

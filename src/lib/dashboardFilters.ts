/**
 * Filtros do dashboard - sem dependência de db (usável em client components).
 */

export const COMMERCIAL_OPTIONS = ["João", "Pablo", "Gabriel", "Gustavo"] as const;
export const PAYMENT_METHOD_OPTIONS = ["Stripe", "PIX", "Outro"] as const;

export type DashboardFilters = {
  dateFrom: string | null;
  dateTo: string | null;
  commercial: string | null;
  sdr: string | null;
  paymentMethod: string | null;
};

/** Valida e retorna filtros da querystring */
export function parseDashboardFilters(
  params: Record<string, string | string[] | undefined>
): DashboardFilters {
  const get = (k: string): string | null => {
    const v = params[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const dateFrom = get("dateFrom");
  const dateTo = get("dateTo");
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const validDateFrom = dateFrom && dateRegex.test(dateFrom) ? dateFrom : null;
  const validDateTo = dateTo && dateRegex.test(dateTo) ? dateTo : null;

  const commercial = get("commercial");
  const sdr = get("sdr");
  const paymentMethod = get("paymentMethod");

  const validCommercial = commercial && (COMMERCIAL_OPTIONS as readonly string[]).includes(commercial) ? commercial : null;
  const validSdr = sdr && (COMMERCIAL_OPTIONS as readonly string[]).includes(sdr) ? sdr : null;

  return {
    dateFrom: validDateFrom,
    dateTo: validDateTo,
    commercial: validCommercial,
    sdr: validSdr,
    paymentMethod: paymentMethod || null,
  };
}

/** Formata centavos para USD (usável em client components) */
export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

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
  preset?: PresetKey | null;
};

export const PRESET_KEYS = ["month", "last7", "previous_month", "year"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

/** Intervalo padrão: 1º dia do mês atual até hoje. Formato YYYY-MM-DD para API e inputs type="date". */
export function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m, now.getDate());
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

/** Retorna { from, to } para um preset de período (data local). */
export function getPresetRange(presetKey: PresetKey): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);

  switch (presetKey) {
    case "month": {
      const first = new Date(y, m, 1);
      const last = new Date(y, m, now.getDate());
      return { from: toIso(first), to: toIso(last) };
    }
    case "last7": {
      const to = new Date(y, m, now.getDate());
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      return { from: toIso(from), to: toIso(to) };
    }
    case "previous_month": {
      const prevFirst = new Date(y, m - 1, 1);
      const prevLast = new Date(y, m, 0);
      return { from: toIso(prevFirst), to: toIso(prevLast) };
    }
    case "year": {
      const first = new Date(y, 0, 1);
      const last = new Date(y, m, now.getDate());
      return { from: toIso(first), to: toIso(last) };
    }
    default:
      return getDefaultDateRange();
  }
}

/** Deriva o preset ativo quando dateFrom/dateTo batem exatamente com algum preset. */
export function getPresetFromRange(dateFrom: string, dateTo: string): PresetKey | "custom" {
  for (const key of PRESET_KEYS) {
    const r = getPresetRange(key);
    if (r.from === dateFrom && r.to === dateTo) return key;
  }
  return "custom";
}

/** Valida e retorna filtros da querystring. Aplica default (1º do mês → hoje) quando dateFrom/dateTo ausentes (defensivo no backend). */
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

  const defaultRange = getDefaultDateRange();
  const resolvedDateFrom = validDateFrom ?? defaultRange.from;
  const resolvedDateTo = validDateTo ?? defaultRange.to;

  const commercial = get("commercial");
  const sdr = get("sdr");
  const paymentMethod = get("paymentMethod");

  const validCommercial = commercial && (COMMERCIAL_OPTIONS as readonly string[]).includes(commercial) ? commercial : null;
  const validSdr = sdr && (COMMERCIAL_OPTIONS as readonly string[]).includes(sdr) ? sdr : null;

  const preset = get("preset");
  const validPreset =
    preset && (PRESET_KEYS as readonly string[]).includes(preset) ? (preset as PresetKey) : null;

  return {
    dateFrom: resolvedDateFrom,
    dateTo: resolvedDateTo,
    commercial: validCommercial,
    sdr: validSdr,
    paymentMethod: paymentMethod || null,
    preset: validPreset ?? null,
  };
}

/** Formata centavos para USD (usável em client components) */
export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

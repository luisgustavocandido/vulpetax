/**
 * Normalizadores para campos do CSV.
 */

/** Datas: dd/mm/aaaa ou yyyy-mm-dd -> ISO string ou null */
export function normalizeDate(s: string | undefined): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (yyyymmdd) return t;
  return null;
}

/** Dinheiro: "1.234,56" ou "1234.56" ou "$399,00" -> valueCents */
export function normalizeMoney(s: string | undefined): number {
  if (!s?.trim()) return 0;
  let t = s.trim().replace(/\s/g, "").replace(/[R$\s]/gi, "");
  const hasCommaDecimal = /,\d{2}$/.test(t) || /,\d{1,2}$/.test(t);
  if (hasCommaDecimal) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    t = t.replace(/,/g, "");
  }
  const n = parseFloat(t);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

/** Booleanos: sim/nao, true/false, 1/0, SIM/NÃO */
export function normalizeBool(s: string | undefined): boolean {
  if (!s?.trim()) return false;
  const t = s.trim().toLowerCase();
  if (["sim", "s", "yes", "y", "true", "1"].includes(t)) return true;
  if (["nao", "não", "no", "n", "false", "0", ""].includes(t)) return false;
  return false;
}

/**
 * Telefone:
 * - Se DDI e phone separados: "+<ddi><numero>" (numero só dígitos)
 * - Se só telefone: apenas dígitos (sem inventar DDI)
 */
export function normalizePhone(phone: string | undefined, ddi?: string | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (ddi?.trim()) {
    const ddiClean = ddi.replace(/\D/g, "");
    if (ddiClean) return `+${ddiClean}${digits}`;
  }
  return digits;
}

/** Commercial/SDR: aceitar variações e normalizar para enum */
const COMMERCIAL_MAP: Record<string, string> = {
  joao: "João",
  joa: "João",
  pablo: "Pablo",
  gabriel: "Gabriel",
  gustavo: "Gustavo",
};

export function normalizeCommercial(s: string | undefined): string | null {
  if (!s?.trim()) return null;
  const t = s.trim().toLowerCase();
  for (const [k, v] of Object.entries(COMMERCIAL_MAP)) {
    if (t.includes(k) || t === k) return v;
  }
  return null;
}

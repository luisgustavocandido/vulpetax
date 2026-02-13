/**
 * Helpers de formatação centralizados para o template Pós-Venda LLC.
 */

export const EMPTY = "—";

/**
 * Formata centavos como USD com 2 casas decimais.
 */
export function formatUsd(cents: number | null | undefined): string {
  if (cents == null || cents === 0) return EMPTY;
  return (cents / 100).toFixed(2);
}

/**
 * Formata data para dd/MM/yyyy.
 */
export function formatDate(
  d: string | Date | null | undefined
): string {
  if (!d) return EMPTY;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return EMPTY;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata boolean como Sim/Não.
 */
export function formatFlag(value: boolean | null | undefined): string {
  return value ? "Sim" : "Não";
}

/**
 * Formata percentual (basis points / 100 = %).
 */
export function formatPercent(pct: number | null | undefined): string {
  if (pct == null) return EMPTY;
  return `${Number(pct).toFixed(1)}%`;
}

/**
 * Garante que valor seja string, ou EMPTY se vazio.
 */
export function orEmpty(value: string | null | undefined): string {
  const s = typeof value === "string" ? value.trim() : "";
  return s || EMPTY;
}

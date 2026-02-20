/**
 * Soma 1 mês a uma data (UTC).
 * Ex.: 31/01 → 28/02 (ou 29/02 em ano bissexto); 31/03 → 30/04.
 */
export function addOneMonth(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const next = new Date(Date.UTC(y, m + 1, d));
  if (next.getUTCDate() !== d) {
    return new Date(Date.UTC(y, m + 2, 0));
  }
  return next;
}

/**
 * Soma 1 ano a uma data (sem deslocamentos de fuso).
 * Se a data for 29/02 e o ano seguinte não for bissexto, retorna 28/02.
 */
export function addOneYear(date: Date): Date {
  const y = date.getUTCFullYear() + 1;
  const m = date.getUTCMonth();
  const d = date.getUTCDate();

  const candidate = new Date(Date.UTC(y, m, d));
  if (candidate.getUTCMonth() !== m) {
    // Overflow (ex.: 29/02 -> 01/03). Ajusta para o último dia do mês.
    return new Date(Date.UTC(y, m + 1, 0));
  }
  return candidate;
}


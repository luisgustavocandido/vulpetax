/**
 * Normaliza header: trim, lowercase, remove acentos, substitui espaços por underscore.
 */
function removeAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

let _emptyColCounter = 0;
export function normalizeHeader(header: string): string {
  const out = removeAccents(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!out) return `_empty_${++_emptyColCounter}`;
  return out;
}

export function resetEmptyColCounter(): void {
  _emptyColCounter = 0;
}

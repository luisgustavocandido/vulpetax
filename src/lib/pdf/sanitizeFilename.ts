/**
 * Sanitiza nome do arquivo PDF para evitar caracteres perigosos / unicode estranho.
 */

const MAX_LENGTH = 50;
const FALLBACK = "Pos-Venda-LLC";

/**
 * Remove caracteres não ASCII perigosos e mantém apenas alfanuméricos, espaço e hífen.
 */
export function sanitizePdfFilename(empresa: string): string {
  if (!empresa || typeof empresa !== "string") return FALLBACK;
  const normalized = empresa
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (combining marks)
    .replace(/[^a-zA-Z0-9\s\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LENGTH);
  return normalized || FALLBACK;
}

export function getPosVendaPdfFilename(empresa: string): string {
  const safeName = sanitizePdfFilename(empresa);
  return `Pos-Venda-LLC-${safeName}.pdf`;
}

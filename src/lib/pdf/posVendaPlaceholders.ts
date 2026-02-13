/**
 * Contrato de placeholders para o template Pós-Venda LLC.
 * Todas as chaves devem existir no viewModel para evitar "undefined".
 */

export const EXPECTED_PLACEHOLDERS = [
  "empresa",
  "idioma", // opcional: "Português" (compatibilidade com template legado)
  "codigo_cliente",
  "data_pagamento",
  "comercial",
  "sdr",
  "tipo_negocio",
  "pagamento_via",
  "flag_anonimo",
  "flag_holding",
  "flag_afiliado",
  "flag_express",
  "observacao",
  ...Array.from({ length: 5 }, (_, i) => {
    const n = i + 1;
    return [
      `item_${n}_tipo`,
      `item_${n}_descricao`,
      `item_${n}_valor`,
      `item_${n}_sale_date`,
      `item_${n}_comercial`,
      `item_${n}_sdr`,
    ];
  }).flat(),
  ...Array.from({ length: 5 }, (_, i) => {
    const n = i + 1;
    return [`socio_${n}_nome`, `socio_${n}_papel`, `socio_${n}_pct`];
  }).flat(),
] as const;

export type PlaceholderKey = (typeof EXPECTED_PLACEHOLDERS)[number];

/**
 * Valida que o viewModel contém todas as chaves esperadas.
 * Retorna lista de chaves faltando (vazia = OK).
 */
export function validatePlaceholders(viewModel: Record<string, unknown>): string[] {
  const keys = new Set(Object.keys(viewModel));
  const missing: string[] = [];
  for (const p of EXPECTED_PLACEHOLDERS) {
    if (!keys.has(p)) missing.push(p);
  }
  return missing;
}

/**
 * Garante que expectedPlaceholders ⊆ Object.keys(viewModel).
 * Lança erro com keys faltantes e clientId se houver.
 */
export function assertPlaceholderCoverage(
  viewModel: Record<string, unknown>,
  clientId: string
): void {
  const missing = validatePlaceholders(viewModel);
  if (missing.length > 0) {
    throw new Error(
      `Placeholders faltando no viewModel para clientId=${clientId}: ${missing.join(", ")}`
    );
  }
}

/**
 * Categorias LLC disponíveis no formulário.
 * Ordem: categorias padrão primeiro, "Personalizado" no final.
 */
export const LLC_CATEGORIES = [
  "Silver",
  "Gold",
  "Platinum",
  "Tradicional",
  "Promo",
  "Holding",
  "Holding e Offshore",
  "Personalizado",
] as const;

export type LLCCategory = (typeof LLC_CATEGORIES)[number];

/**
 * Lista fixa de formas de pagamento disponíveis.
 * Ordenada alfabeticamente, exceto "Outro" que sempre fica no final.
 */
export const PAYMENT_METHODS = [
  "ACH",
  "Binance",
  "Paypal",
  "Pix",
  "Revolut",
  "Stripe",
  "USDT",
  "Wise",
  "Zelle",
  "Outro",
] as const;

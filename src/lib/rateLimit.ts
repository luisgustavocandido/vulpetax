/**
 * Rate limit in-memory (10 tentativas / 10 min por IP).
 * Pragmático para dev e MVP; em prod com múltiplas instâncias, considere Redis/Postgres.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 min
const MAX_ATTEMPTS = 10;

const store = new Map<string, { count: number; resetAt: number }>();

function getOrCreate(ip: string): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now >= entry.resetAt) {
    const newEntry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(ip, newEntry);
    return newEntry;
  }
  return entry;
}

/**
 * Verifica se o IP está dentro do limite. Retorna true se permitido.
 */
export function rateLimitCheck(ip: string): boolean {
  const entry = getOrCreate(ip);
  return entry.count < MAX_ATTEMPTS;
}

/**
 * Registra uma tentativa (chamar em falha de login).
 */
export function rateLimitConsume(ip: string): void {
  const entry = getOrCreate(ip);
  entry.count += 1;
}

/**
 * Reseta o contador (chamar em login bem-sucedido).
 */
export function rateLimitClear(ip: string): void {
  store.delete(ip);
}

// --- Rate limit para PDF (separado do login) ---
const PDF_WINDOW_MS = 10 * 60 * 1000; // 10 min
const PDF_MAX_ATTEMPTS = 30;

const pdfStore = new Map<string, { count: number; resetAt: number }>();

function getOrCreatePdf(ip: string): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = pdfStore.get(ip);
  if (!entry || now >= entry.resetAt) {
    const newEntry = { count: 0, resetAt: now + PDF_WINDOW_MS };
    pdfStore.set(ip, newEntry);
    return newEntry;
  }
  return entry;
}

/**
 * Verifica se o IP pode gerar mais PDFs. Retorna true se permitido.
 */
export function rateLimitPdfCheck(ip: string): boolean {
  const entry = getOrCreatePdf(ip);
  return entry.count < PDF_MAX_ATTEMPTS;
}

/**
 * Registra uma geração de PDF.
 */
export function rateLimitPdfConsume(ip: string): void {
  const entry = getOrCreatePdf(ip);
  entry.count += 1;
}

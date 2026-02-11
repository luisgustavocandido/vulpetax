/**
 * Rate limit para sync via UI: 1 request a cada 60s por IP.
 */

const WINDOW_MS = 60 * 1000; // 60s
const store = new Map<string, number>();

export function syncRateLimitCheck(ip: string | null): boolean {
  if (!ip) return true;
  const last = store.get(ip);
  const now = Date.now();
  if (!last) return true;
  return now - last >= WINDOW_MS;
}

export function syncRateLimitConsume(ip: string | null): void {
  if (ip) store.set(ip, Date.now());
}

/**
 * Rate limit para remover TAX: 5 requests por hora por IP.
 */
const TAX_REMOVE_WINDOW_MS = 60 * 60 * 1000; // 1h
const TAX_REMOVE_MAX = 5;
const taxRemoveStore = new Map<string, { count: number; resetAt: number }>();

export function taxRemoveRateLimitCheck(ip: string | null): boolean {
  if (!ip) return true;
  const now = Date.now();
  const entry = taxRemoveStore.get(ip);
  if (!entry || now >= entry.resetAt) {
    taxRemoveStore.set(ip, { count: 0, resetAt: now + TAX_REMOVE_WINDOW_MS });
    return true;
  }
  return entry.count < TAX_REMOVE_MAX;
}

export function taxRemoveRateLimitConsume(ip: string | null): void {
  if (!ip) return;
  const now = Date.now();
  const entry = taxRemoveStore.get(ip);
  if (!entry || now >= entry.resetAt) {
    taxRemoveStore.set(ip, { count: 1, resetAt: now + TAX_REMOVE_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/** Rate limit para preview/confirm sync TAX: 1 req/min por IP cada */
const TAX_SYNC_UI_WINDOW_MS = 60 * 1000;
const taxSyncPreviewStore = new Map<string, number>();
const taxSyncConfirmStore = new Map<string, number>();

export function taxSyncPreviewRateLimitCheck(ip: string | null): boolean {
  if (!ip) return true;
  const last = taxSyncPreviewStore.get(ip);
  if (!last) return true;
  return Date.now() - last >= TAX_SYNC_UI_WINDOW_MS;
}

export function taxSyncPreviewRateLimitConsume(ip: string | null): void {
  if (ip) taxSyncPreviewStore.set(ip, Date.now());
}

export function taxSyncConfirmRateLimitCheck(ip: string | null): boolean {
  if (!ip) return true;
  const last = taxSyncConfirmStore.get(ip);
  if (!last) return true;
  return Date.now() - last >= TAX_SYNC_UI_WINDOW_MS;
}

export function taxSyncConfirmRateLimitConsume(ip: string | null): void {
  if (ip) taxSyncConfirmStore.set(ip, Date.now());
}

/** Rate limit para preview/confirm sync Clientes (Pós-Venda): 1 req/min por IP cada */
const CLIENTS_SYNC_UI_WINDOW_MS = 60 * 1000;
const clientsSyncPreviewStore = new Map<string, number>();
const clientsSyncConfirmStore = new Map<string, number>();

export function clientsSyncPreviewRateLimitCheck(ip: string | null): boolean {
  if (!ip) return true;
  const last = clientsSyncPreviewStore.get(ip);
  if (!last) return true;
  return Date.now() - last >= CLIENTS_SYNC_UI_WINDOW_MS;
}

export function clientsSyncPreviewRateLimitConsume(ip: string | null): void {
  if (ip) clientsSyncPreviewStore.set(ip, Date.now());
}

export function clientsSyncConfirmRateLimitCheck(ip: string | null): boolean {
  if (!ip) return true;
  const last = clientsSyncConfirmStore.get(ip);
  if (!last) return true;
  return Date.now() - last >= CLIENTS_SYNC_UI_WINDOW_MS;
}

export function clientsSyncConfirmRateLimitConsume(ip: string | null): void {
  if (ip) clientsSyncConfirmStore.set(ip, Date.now());
}

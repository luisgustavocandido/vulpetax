/**
 * Postgres advisory lock para sync — evita execuções concorrentes.
 * Usa pg_try_advisory_lock com chaves fixas por tipo de sync.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Chaves numéricas únicas para cada tipo de sync (bigint) */
const LOCK_KEYS = {
  taxForm: 0x5441585f53594e43, // "TAX_SYNC"
  posvenda: 0x504f535653594e43, // "POSV_SYNC"
} as const;

export type LockKey = keyof typeof LOCK_KEYS;

/**
 * Tenta adquirir o lock. Retorna true se adquirido, false se outro processo já o tem.
 */
export async function tryAdvisoryLock(key: LockKey): Promise<boolean> {
  const lockId = LOCK_KEYS[key];
  const result = await db.execute(
    sql`SELECT pg_try_advisory_lock(${lockId}) as pg_try_advisory_lock`
  );
  const row = (result as { rows?: { pg_try_advisory_lock?: boolean }[] }).rows?.[0];
  return Boolean(row?.pg_try_advisory_lock);
}

/**
 * Libera o lock. Sempre chamar no finally.
 */
export async function releaseAdvisoryLock(key: LockKey): Promise<void> {
  const lockId = LOCK_KEYS[key];
  await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
}

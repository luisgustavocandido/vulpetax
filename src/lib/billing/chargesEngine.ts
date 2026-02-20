/**
 * Engine de cobranças: datas em UTC, geração determinística e atualização de status.
 */
import { db } from "@/db";
import { billingCharges } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { addOneMonth } from "@/lib/dates/addOneMonth";
import { addOneYear } from "@/lib/dates/addOneYear";
import {
  ensureChargesForAddressLineItems,
  type PeriodInfo,
} from "./generateAddressCharges";

/** Parse "YYYY-MM-DD" em Date UTC (meia-noite). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  if (y == null || m == null || d == null) return new Date(NaN);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Formata Date para "YYYY-MM-DD". */
export function formatISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Soma n meses (mantém dia quando possível; ex.: 31 → último dia do mês). */
export function addMonthsSafe(date: Date, n: number): Date {
  let out = new Date(date.getTime());
  for (let i = 0; i < n; i++) out = addOneMonth(out);
  return out;
}

/** Soma n anos (mantém dia quando possível). */
export function addYearsSafe(date: Date, n: number): Date {
  let out = new Date(date.getTime());
  for (let i = 0; i < n; i++) out = addOneYear(out);
  return out;
}

export type { PeriodInfo };

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/**
 * Atualiza status de cobranças pending → overdue quando dueDate < hoje.
 * Retorna quantidade atualizada.
 */
export async function updateChargesStatusOverdue(): Promise<number> {
  const today = TODAY_ISO();
  const result = await db
    .update(billingCharges)
    .set({ status: "overdue", updatedAt: new Date() })
    .where(
      and(
        eq(billingCharges.status, "pending"),
        sql`${billingCharges.dueDate}::text < ${today}`
      )
    );
  return result.rowCount ?? 0;
}

/**
 * Corrige cobranças marcadas overdue cujo due_date já é >= hoje (ex.: após backfill de due_date).
 * Retorna quantidade corrigida.
 */
export async function revertStaleOverdueToPending(): Promise<number> {
  const today = TODAY_ISO();
  const result = await db
    .update(billingCharges)
    .set({ status: "pending", updatedAt: new Date() })
    .where(
      and(
        eq(billingCharges.status, "overdue"),
        sql`${billingCharges.dueDate}::text >= ${today}`
      )
    );
  return result.rowCount ?? 0;
}

/**
 * Garante cobranças para itens Endereço (Mensal/Anual) e atualiza status (pending/overdue).
 * - Chama ensureChargesForAddressLineItems(windowDays)
 * - Corrige overdue com due_date >= hoje → pending
 * - Marca como overdue as pending com dueDate < hoje
 */
export async function ensureCharges(
  windowDays: number = 30
): Promise<{ created: number; updated: number }> {
  const { created } = await ensureChargesForAddressLineItems({ windowDays });
  await revertStaleOverdueToPending();
  const updated = await updateChargesStatusOverdue();
  return { created, updated };
}

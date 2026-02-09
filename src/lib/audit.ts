"use server";

import { db, auditLog } from "@/db";
import { generateId } from "@/lib/id";
import { cookies } from "next/headers";

export type AuditAction = "create" | "update" | "delete";

export type AuditPayload = {
  entityType: "clients" | "llcs" | "tax_filings" | "reportable_transactions" | "related_parties" | "filing_deliveries";
  entityId: string;
  action: AuditAction;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
};

/**
 * Obtém o ID do usuário atual (cookie de sessão interna).
 * Se não houver sessão, usa VULPETAX_DEFAULT_USER_ID ou null.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const uid = cookieStore.get("vulpetax_user_id")?.value;
  if (uid) return uid;
  return process.env.VULPETAX_DEFAULT_USER_ID ?? null;
}

/**
 * Registra uma entrada no audit log.
 * Chamar após create/update/delete nas entidades principais.
 */
export async function logAudit(payload: AuditPayload): Promise<void> {
  const userId = await getCurrentUserId();
  const id = generateId();
  await db.insert(auditLog).values({
    id,
    userId,
    entityType: payload.entityType,
    entityId: payload.entityId,
    action: payload.action,
    oldValues: payload.oldValues ? JSON.stringify(payload.oldValues) : null,
    newValues: payload.newValues ? JSON.stringify(payload.newValues) : null,
    createdAt: new Date(),
  });
}

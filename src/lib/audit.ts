import { auditLog } from "@/db/schema";
import type { RequestMeta } from "./requestMeta";

const TECHNICAL_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "createdBy",
  "updatedBy",
]);

export type AuditAction = "create" | "update" | "delete";

export type LogAuditPayload = {
  action: AuditAction;
  entity: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  meta: RequestMeta;
};

/**
 * Insere um registro em audit_log (uso dentro de transação).
 */
/** db ou tx do Drizzle (transaction) */
export async function logAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  payload: LogAuditPayload
) {
  const { action, entity, entityId, oldValues, newValues, meta } = payload;
  await db.insert(auditLog).values({
    action,
    entity,
    entityId,
    oldValues: oldValues ?? null,
    newValues: newValues ?? null,
    actor: meta.actor,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

/**
 * Campos "publicáveis" de um registro (exclui técnicos).
 */
function toPublicRecord<T extends Record<string, unknown>>(
  row: T,
  allowList?: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = allowList ?? Object.keys(row).filter((k) => !TECHNICAL_FIELDS.has(k));
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k) && !TECHNICAL_FIELDS.has(k)) {
      out[k] = row[k];
    }
  }
  return out;
}

/**
 * Retorna { oldValues, newValues } apenas com campos alterados (ou registro completo para create/delete).
 * Ignora campos técnicos: id, createdAt, updatedAt, deletedAt, createdBy, updatedBy.
 * - create: oldValues=null, newValues=registro publicável
 * - delete (soft): oldValues=registro completo publicável, newValues=null
 * - update: apenas campos que mudaram
 */
export function diffChangedFields<T extends Record<string, unknown>>(
  oldRow: T | null,
  newRow: T | null,
  allowList?: string[]
): { oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null } {
  if (oldRow == null && newRow == null) {
    return { oldValues: null, newValues: null };
  }
  if (oldRow == null) {
    return { oldValues: null, newValues: toPublicRecord(newRow!, allowList) };
  }
  if (newRow == null) {
    return { oldValues: toPublicRecord(oldRow, allowList), newValues: null };
  }

  const oldPub = toPublicRecord(oldRow, allowList);
  const newPub = toPublicRecord(newRow, allowList);
  const oldChanged: Record<string, unknown> = {};
  const newChanged: Record<string, unknown> = {};
  const keys = Array.from(new Set([...Object.keys(oldPub), ...Object.keys(newPub)]));

  for (const k of keys) {
    const o = oldPub[k];
    const n = newPub[k];
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      oldChanged[k] = o;
      newChanged[k] = n;
    }
  }

  if (Object.keys(oldChanged).length === 0) {
    return { oldValues: null, newValues: null };
  }
  return { oldValues: oldChanged, newValues: newChanged };
}

/*
  Exemplo de registro em audit_log (após create de um cliente):

  {
    "id": "uuid",
    "user_id": null,
    "action": "create",
    "entity": "clients",
    "entity_id": "uuid-do-cliente",
    "old_values": null,
    "new_values": {
      "name": "Empresa XYZ",
      "email": "contato@xyz.com",
      "cpfCnpj": "12345678000199",
      "phone": "11999999999",
      "status": "ativo",
      "notes": null
    },
    "actor": "internal",
    "ip": "192.168.1.1",
    "user_agent": "Mozilla/5.0 ...",
    "created_at": "2025-02-10T14:00:00.000Z"
  }
*/

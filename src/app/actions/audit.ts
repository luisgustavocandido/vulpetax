"use server";

import { eq, desc } from "drizzle-orm";
import { db, auditLog, users } from "@/db";

export async function getRecentAuditLog(limit = 50) {
  const entries = await db
    .select({
      id: auditLog.id,
      userId: auditLog.userId,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      action: auditLog.action,
      oldValues: auditLog.oldValues,
      newValues: auditLog.newValues,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  const userIds = [...new Set(entries.map((e) => e.userId).filter(Boolean))] as string[];
  const userMap = new Map<string, { name: string; email: string }>();
  if (userIds.length > 0) {
    const userRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
    userRows.forEach((u) => userMap.set(u.id, { name: u.name, email: u.email }));
  }

  return entries.map((e) => ({
    ...e,
    user: e.userId ? userMap.get(e.userId) ?? null : null,
  }));
}

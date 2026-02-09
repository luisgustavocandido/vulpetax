"use server";

import { eq, desc } from "drizzle-orm";
import { db, filingDeliveries, taxFilings } from "@/db";
import { generateId } from "@/lib/id";
import { logAudit } from "@/lib/audit";
import { getCurrentUserId } from "@/lib/audit";
import type { FilingDeliveryMethod } from "@/db";

export type CreateFilingDeliveryInput = {
  taxFilingId: string;
  filingMethod: FilingDeliveryMethod;
  sentAt: Date;
  deliveredAt?: Date | null;
  shippingTracking?: string | null;
  faxConfirmation?: string | null;
};

export async function createFilingDelivery(input: CreateFilingDeliveryInput) {
  const userId = await getCurrentUserId();
  const now = new Date();
  const id = generateId();

  await db.insert(filingDeliveries).values({
    id,
    taxFilingId: input.taxFilingId,
    filingMethod: input.filingMethod,
    sentAt: input.sentAt,
    deliveredAt: input.deliveredAt ?? null,
    shippingTracking: input.shippingTracking?.trim() || null,
    faxConfirmation: input.faxConfirmation?.trim() || null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .update(taxFilings)
    .set({ status: "filed", filedAt: input.sentAt, updatedAt: now })
    .where(eq(taxFilings.id, input.taxFilingId));

  await logAudit({
    entityType: "filing_deliveries",
    entityId: id,
    action: "create",
    newValues: { ...input },
  });

  return { id };
}

export async function getDeliveriesByFiling(taxFilingId: string) {
  return db
    .select()
    .from(filingDeliveries)
    .where(eq(filingDeliveries.taxFilingId, taxFilingId))
    .orderBy(desc(filingDeliveries.sentAt));
}

export async function deleteFilingDelivery(id: string) {
  const [row] = await db
    .select()
    .from(filingDeliveries)
    .where(eq(filingDeliveries.id, id));
  if (!row) return;

  await db.delete(filingDeliveries).where(eq(filingDeliveries.id, id));

  const remaining = await db
    .select()
    .from(filingDeliveries)
    .where(eq(filingDeliveries.taxFilingId, row.taxFilingId));
  if (remaining.length === 0) {
    const now = new Date();
    await db
      .update(taxFilings)
      .set({ status: "ready_to_file", filedAt: null, updatedAt: now })
      .where(eq(taxFilings.id, row.taxFilingId));
  }

  await logAudit({
    entityType: "filing_deliveries",
    entityId: id,
    action: "delete",
    oldValues: { filingMethod: row.filingMethod, sentAt: row.sentAt?.toISOString() },
  });
}

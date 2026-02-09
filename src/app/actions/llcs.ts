"use server";

import { eq } from "drizzle-orm";
import { db, llcs } from "@/db";
import { generateId } from "@/lib/id";
import { logAudit } from "@/lib/audit";

export type CreateLLCInput = {
  clientId: string;
  name: string;
  ein: string;
  state: string;
  formationDate: Date;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateAddress?: string;
  zip?: string;
  businessActivity?: string;
  formationCostUsd?: number | null;
};

export async function createLLC(input: CreateLLCInput) {
  const now = new Date();
  const id = generateId();
  await db.insert(llcs).values({
    id,
    clientId: input.clientId,
    name: input.name,
    ein: input.ein,
    state: input.state,
    formationDate: input.formationDate,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    stateAddress: input.stateAddress ?? null,
    zip: input.zip ?? null,
    businessActivity: input.businessActivity ?? null,
    formationCostUsd: input.formationCostUsd ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await logAudit({
    entityType: "llcs",
    entityId: id,
    action: "create",
    newValues: { ...input },
  });
  return { id };
}

export async function getLLCsByClient(clientId: string) {
  return db
    .select()
    .from(llcs)
    .where(eq(llcs.clientId, clientId))
    .orderBy(llcs.formationDate);
}

export async function getLLC(id: string) {
  const [row] = await db.select().from(llcs).where(eq(llcs.id, id));
  return row ?? null;
}

export async function deleteLLC(id: string) {
  const llc = await getLLC(id);
  if (!llc) return;
  const oldValues = { name: llc.name, ein: llc.ein };
  await db.delete(llcs).where(eq(llcs.id, id));
  await logAudit({
    entityType: "llcs",
    entityId: id,
    action: "delete",
    oldValues,
  });
}

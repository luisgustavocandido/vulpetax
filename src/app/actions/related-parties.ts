"use server";

import { eq } from "drizzle-orm";
import { db, relatedParties } from "@/db";
import { generateId } from "@/lib/id";
import { logAudit } from "@/lib/audit";

type CreateRelatedPartyInput = {
  taxFilingId: string;
  name: string;
  partyType: string;
  address?: string;
  country: string;
  tin?: string;
};

export async function createRelatedParty(input: CreateRelatedPartyInput) {
  const now = new Date();
  const id = generateId();
  await db.insert(relatedParties).values({
    id,
    taxFilingId: input.taxFilingId,
    name: input.name,
    partyType: input.partyType,
    address: input.address ?? null,
    country: input.country,
    tin: input.tin ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await logAudit({
    entityType: "related_parties",
    entityId: id,
    action: "create",
    newValues: { ...input },
  });
  return { id };
}

export async function getRelatedPartiesByFiling(taxFilingId: string) {
  return db
    .select()
    .from(relatedParties)
    .where(eq(relatedParties.taxFilingId, taxFilingId));
}

export async function deleteRelatedParty(id: string) {
  const [row] = await db
    .select()
    .from(relatedParties)
    .where(eq(relatedParties.id, id));
  await db.delete(relatedParties).where(eq(relatedParties.id, id));
  if (row) {
    await logAudit({
      entityType: "related_parties",
      entityId: id,
      action: "delete",
      oldValues: { taxFilingId: row.taxFilingId, name: row.name },
    });
  }
}

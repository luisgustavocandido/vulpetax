"use server";

import { eq } from "drizzle-orm";
import { db, clients, llcs } from "@/db";
import { generateId } from "@/lib/id";
import { logAudit } from "@/lib/audit";

export type CreateClientInput = {
  fullName: string;
  email: string;
  phone?: string;
  country: string;
  citizenshipCountry?: string;
  address?: string;
  addressDifferentFromLLC?: boolean;
  usTin?: string;
  foreignTin?: string;
  idType?: string;
  idNumber?: string;
};

export async function createClient(input: CreateClientInput) {
  const now = new Date();
  const id = generateId();
  await db.insert(clients).values({
    id,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    country: input.country,
    citizenshipCountry: input.citizenshipCountry ?? null,
    address: input.address ?? null,
    addressDifferentFromLLC: input.addressDifferentFromLLC ?? null,
    usTin: input.usTin ?? null,
    foreignTin: input.foreignTin ?? null,
    idType: input.idType ?? null,
    idNumber: input.idNumber ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await logAudit({
    entityType: "clients",
    entityId: id,
    action: "create",
    newValues: { ...input },
  });
  return { id };
}

export async function getClients() {
  return db.select().from(clients).orderBy(clients.updatedAt);
}

export async function getClient(id: string) {
  const [row] = await db.select().from(clients).where(eq(clients.id, id));
  return row ?? null;
}

export async function getClientWithLlcs(id: string) {
  const client = await getClient(id);
  if (!client) return null;
  const clientLlcs = await db
    .select()
    .from(llcs)
    .where(eq(llcs.clientId, id))
    .orderBy(llcs.formationDate);
  return { ...client, llcs: clientLlcs };
}

export async function deleteClient(id: string) {
  const client = await getClient(id);
  if (!client) return;
  const oldValues = { fullName: client.fullName, email: client.email };
  await db.delete(clients).where(eq(clients.id, id));
  await logAudit({
    entityType: "clients",
    entityId: id,
    action: "delete",
    oldValues,
  });
}

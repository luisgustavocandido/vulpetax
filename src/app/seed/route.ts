import { NextResponse } from "next/server";
import { db, clients, llcs, taxFilings, users } from "@/db";
import { generateId } from "@/lib/id";

/** POST /api/seed - só para desenvolvimento. Cria 1 usuário admin, 1 cliente, 1 LLC e 1 tax filing. */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const now = new Date();
  const existingUsers = await db.select().from(users);
  let userId: string | undefined;
  if (existingUsers.length === 0) {
    userId = generateId();
    await db.insert(users).values({
      id: userId,
      email: "admin@vulpeinc.com",
      name: "Vulpeinc Admin",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });
  } else {
    userId = existingUsers[0]!.id;
  }

  const clientId = generateId();
  const llcId = generateId();
  const filingId = generateId();

  await db.insert(clients).values({
    id: clientId,
    fullName: "João Silva",
    email: "joao@exemplo.com",
    phone: "+55 11 99999-9999",
    country: "Brasil",
    address: "Rua Exemplo, 123, São Paulo",
    foreignTin: "123.456.789-00",
    idType: "national_id",
    idNumber: "12345678900",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(llcs).values({
    id: llcId,
    clientId,
    name: "Silva Holdings LLC",
    ein: "12-3456789",
    state: "WY",
    formationDate: new Date("2024-03-15"),
    addressLine1: "123 Main St",
    city: "Cheyenne",
    stateAddress: "WY",
    zip: "82001",
    businessActivity: "Consulting",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(taxFilings).values({
    id: filingId,
    llcId,
    taxYear: 2024,
    status: "draft",
    federalDeadline: new Date("2025-04-15"),
    stateDeadline: new Date("2025-03-15"),
    filedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({
    ok: true,
    userId,
    clientId,
    llcId,
    filingId,
  });
}

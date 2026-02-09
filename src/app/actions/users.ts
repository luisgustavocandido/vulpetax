"use server";

import { eq } from "drizzle-orm";
import { db, users } from "@/db";

export async function getUsers() {
  return db.select({ id: users.id, email: users.email, name: users.name, role: users.role }).from(users);
}

export async function getUser(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

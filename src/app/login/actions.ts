"use server";

import { cookies } from "next/headers";

export async function setSessionUser(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set("vulpetax_user_id", userId, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("vulpetax_user_id");
}

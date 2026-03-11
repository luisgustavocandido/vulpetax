import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getFinanceSessionCookieName,
  verifyFinanceSessionValue,
} from "@/lib/financeDashboardSession";

/** Garante sessão CEO; redireciona para login se inválida. Usar em Server Components. */
export async function requireFinanceSession(): Promise<void> {
  const store = await cookies();
  const cookie = store.get(getFinanceSessionCookieName())?.value;
  const session = await verifyFinanceSessionValue(cookie);
  if (!session) {
    redirect("/dashboard-financeiro/login");
  }
}

/** Retorna true se houver sessão válida. */
export async function hasFinanceSession(): Promise<boolean> {
  const store = await cookies();
  const cookie = store.get(getFinanceSessionCookieName())?.value;
  const session = await verifyFinanceSessionValue(cookie);
  return !!session;
}

/** Para uso em API routes: retorna sessão ou null. */
export async function getFinanceSessionIfValid(): Promise<Awaited<
  ReturnType<typeof verifyFinanceSessionValue>
> | null> {
  const store = await cookies();
  const cookie = store.get(getFinanceSessionCookieName())?.value;
  return verifyFinanceSessionValue(cookie);
}

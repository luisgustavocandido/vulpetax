/**
 * Log do DATABASE_URL efetivo em runtime (server-only).
 * Usado para comparar com o script de migration e garantir mesmo banco.
 */

let logged = false;

export function debugDbInfo(): void {
  if (process.env.NODE_ENV === "production") return;
  if (logged) return;
  logged = true;

  const url = process.env.DATABASE_URL ?? "";
  const safe = url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
  console.log("[DB] DATABASE_URL =", safe);

  try {
    const u = new URL(url);
    console.log("[DB] host =", u.hostname, "| port =", u.port || "(default)", "| db =", u.pathname?.replace(/^\//, "") || "(default)");
  } catch {
    console.log("[DB] (URL inválida, host/port/db não parseados)");
  }
}

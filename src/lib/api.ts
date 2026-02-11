/**
 * Base URL para fetch nas API routes (Server Components).
 */
export function getBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  const host = process.env.VERCEL_URL ?? process.env.HOST ?? "localhost:3000";
  const protocol = process.env.VERCEL ? "https" : "http";
  return `${protocol}://${host}`;
}

/**
 * Base URL para fetch nas API routes (Server Components).
 * Preferir getBaseUrlFromHeaders() nas páginas para usar o mesmo host do request (evita 401 por cookie/contexto).
 */
export function getBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  const host = process.env.VERCEL_URL ?? process.env.HOST ?? "localhost:3000";
  const protocol = process.env.VERCEL ? "https" : "http";
  return `${protocol}://${host}`;
}

/**
 * Base URL a partir dos headers da request — usa o mesmo host que o usuário acessou.
 * Evita 401 quando o usuário acessa por domínio customizado ou URL diferente de VERCEL_URL.
 */
export function getBaseUrlFromHeaders(headers: Headers): string {
  if (typeof window !== "undefined") return "";
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? null;
  const proto = headers.get("x-forwarded-proto");
  if (host) {
    const protocol = proto === "https" || (process.env.VERCEL && proto !== "http") ? "https" : "http";
    return `${protocol}://${host}`;
  }
  return getBaseUrl();
}

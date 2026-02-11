import type { NextRequest } from "next/server";

const ACTOR = "internal";

/**
 * Obtém IP do request: x-forwarded-for (primeiro da lista) > x-real-ip > req.ip.
 * Normaliza removendo espaços; suporta IPv6.
 */
function getIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? null;
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const reqIp = (req as NextRequest & { ip?: string }).ip?.trim();
  if (reqIp) return reqIp;
  return null;
}

export type RequestMeta = {
  actor: string;
  ip: string | null;
  userAgent: string | null;
};

/**
 * Metadados do request para auditoria: actor fixo "internal", IP e User-Agent.
 */
export function getRequestMeta(req: NextRequest): RequestMeta {
  return {
    actor: ACTOR,
    ip: getIp(req),
    userAgent: req.headers.get("user-agent") ?? null,
  };
}

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
 * URL base (origem) que o cliente usou, para redirects e cookies.
 * Usa Host + x-forwarded-proto para que, na intranet (http://192.168.0.17:3000),
 * o redirect não vá para localhost e o cookie seja enviado no host correto.
 */
export function getRequestOrigin(req: NextRequest): string {
  const host = req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto");
  const protocol =
    proto === "https"
      ? "https"
      : (() => {
          try {
            return new URL(req.url).protocol.replace(":", "");
          } catch {
            return "http";
          }
        })();
  return `${protocol}://${host}`;
}

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

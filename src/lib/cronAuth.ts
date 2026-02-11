/**
 * Autenticação dos endpoints de cron.
 * Aceita x-cron-secret (testes locais) ou Authorization: Bearer (Vercel Cron).
 */

import type { NextRequest } from "next/server";

/**
 * Extrai e valida o secret do cron.
 * Aceita:
 * - x-cron-secret: valor direto (testes locais)
 * - Authorization: Bearer <secret> (Vercel Cron)
 */
export function getCronSecret(request: NextRequest): string | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) return null;

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === expected) return headerSecret;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const bearer = auth.slice(7).trim();
    if (bearer === expected) return bearer;
  }

  return null;
}

/**
 * Sanitização de erros para produção — evita vazamento de stack trace e env.
 */

const isProd = process.env.NODE_ENV === "production";

/**
 * Retorna mensagem de erro segura para resposta HTTP.
 * Em produção: mensagem genérica; em dev: mensagem real.
 */
export function sanitizeErrorMessage(err: unknown): string {
  if (isProd) {
    return "Erro interno. Verifique os logs.";
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Nunca logar secrets — remove valores sensíveis de objetos antes de logar.
 */
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitive = ["password", "secret", "token", "key", "authorization", "cookie"];
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const lower = k.toLowerCase();
    if (sensitive.some((s) => lower.includes(s))) {
      out[k] = "[REDACTED]";
    }
  }
  return out;
}

/**
 * Função segura para fazer parse de JSON de uma Response.
 * Retorna null se a resposta estiver vazia, ou um objeto com os dados parseados.
 * Em caso de erro de parse, retorna { _raw: string } com o texto original.
 */
export async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

/**
 * Extrai mensagem de erro de uma resposta HTTP.
 * Tenta usar payload.error, depois payload._raw, depois statusText.
 */
export function extractErrorMessage(
  res: Response,
  payload: unknown
): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String(payload.error);
  }
  if (payload && typeof payload === "object" && "_raw" in payload) {
    return String(payload._raw);
  }
  return res.statusText || `HTTP ${res.status}`;
}

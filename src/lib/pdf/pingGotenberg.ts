/**
 * Healthcheck opcional: ping Gotenberg (apenas em dev).
 */

export async function pingGotenberg(): Promise<{ ok: boolean; ms?: number; error?: string }> {
  const url = process.env.GOTENBERG_URL?.trim();
  if (!url) {
    return { ok: false, error: "GOTENBERG_URL não configurado" };
  }

  const base = url.replace(/\/$/, "");
  // Gotenberg expõe health em /health ou responde no root
  const healthUrl = `${base}/health`;
  const start = Date.now();

  try {
    const res = await fetch(healthUrl, { method: "GET" });
    const ms = Date.now() - start;

    if (res.ok) {
      return { ok: true, ms };
    }

    const text = await res.text();
    return { ok: false, ms, error: `status ${res.status}: ${text.slice(0, 200)}` };
  } catch (err) {
    const ms = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, ms, error: errorMsg };
  }
}

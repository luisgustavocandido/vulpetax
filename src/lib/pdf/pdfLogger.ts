/**
 * Logs estruturados para geração de PDF.
 * Não imprimir viewModel ou dados sensíveis.
 */

type PdfLogEvent =
  | { event: "pdf_generation_started"; clientId: string; provider: string }
  | { event: "pdf_generation_success"; clientId: string; ms: number }
  | { event: "pdf_generation_failed"; clientId: string; provider: string; ms: number; error: string };

function logEvent(payload: PdfLogEvent): void {
  const isDev = process.env.NODE_ENV === "development";
  const line = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });
  if (payload.event === "pdf_generation_failed") {
    console.error(line);
  } else if (isDev) {
    console.log(line);
  }
}

export function logPdfStarted(clientId: string, provider: string): void {
  logEvent({ event: "pdf_generation_started", clientId, provider });
}

export function logPdfSuccess(clientId: string, ms: number): void {
  logEvent({ event: "pdf_generation_success", clientId, ms });
}

export function logPdfFailed(
  clientId: string,
  provider: string,
  ms: number,
  error: string
): void {
  logEvent({ event: "pdf_generation_failed", clientId, provider, ms, error });
}

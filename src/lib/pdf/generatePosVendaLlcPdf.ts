import { generatePosVendaLlcDocx } from "./generatePosVendaLlcDocx";
import { convertDocxToPdf, getPdfConverterProvider } from "./convertDocxToPdf";
import { getPosVendaPdfFilename } from "./sanitizeFilename";
import {
  logPdfStarted,
  logPdfSuccess,
  logPdfFailed,
} from "./pdfLogger";

/**
 * Gera PDF Pós-Venda LLC via DOCX template + conversão online (Gotenberg/CloudConvert).
 */
export async function generatePosVendaLlcPdf(input: {
  clientId: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  const { clientId } = input;
  const provider = getPdfConverterProvider();
  const start = Date.now();

  logPdfStarted(clientId, provider);

  try {
    const docxBuffer = await generatePosVendaLlcDocx({ clientId });
    const pdfBuffer = await convertDocxToPdf(docxBuffer);
    const empresa = await getEmpresaForFilename(clientId);
    const filename = getPosVendaPdfFilename(empresa);

    logPdfSuccess(clientId, Date.now() - start);
    return { buffer: pdfBuffer, filename };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logPdfFailed(clientId, provider, Date.now() - start, errorMsg);

    const g = globalThis as unknown as { Sentry?: { captureException?: (e: unknown, ctx?: object) => void } };
    if (g?.Sentry?.captureException) {
      try {
        g.Sentry.captureException(err, {
          tags: { provider, clientId, feature: "pdf_pos_venda_llc" },
        });
      } catch {
        // ignore
      }
    }

    throw err;
  }
}

async function getEmpresaForFilename(clientId: string): Promise<string> {
  const { db } = await import("@/db");
  const { clients } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select({ companyName: clients.companyName })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return row?.companyName?.trim() ?? "";
}

export { getPosVendaPdfFilename };

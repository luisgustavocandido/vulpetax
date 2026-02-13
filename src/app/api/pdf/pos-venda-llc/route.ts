import { NextRequest, NextResponse } from "next/server";
import { generatePosVendaLlcPdf } from "@/lib/pdf/generatePosVendaLlcPdf";
import { isValidUuid } from "@/lib/pdf/uuid";
import { getRequestMeta } from "@/lib/requestMeta";
import { rateLimitPdfCheck, rateLimitPdfConsume } from "@/lib/rateLimit";

export const runtime = "nodejs";

function errorResponse(
  error: string,
  status: number,
  options?: { code?: string; details?: string }
) {
  return NextResponse.json(
    {
      error,
      ...(options?.code && { code: options.code }),
      ...(options?.details && { details: options.details }),
    },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId || typeof clientId !== "string") {
    return errorResponse("clientId é obrigatório", 400, { code: "MISSING_CLIENT_ID" });
  }

  const trimmedId = clientId.trim();
  if (!isValidUuid(trimmedId)) {
    return errorResponse("clientId inválido (deve ser UUID)", 400, {
      code: "INVALID_CLIENT_ID",
    });
  }

  const { ip } = getRequestMeta(request);
  if (ip && !rateLimitPdfCheck(ip)) {
    return errorResponse(
      "Limite de geração de PDFs excedido. Tente novamente em alguns minutos.",
      429,
      { code: "RATE_LIMIT_EXCEEDED" }
    );
  }

  try {
    const { buffer, filename } = await generatePosVendaLlcPdf({
      clientId: trimmedId,
    });

    if (ip) rateLimitPdfConsume(ip);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar PDF";

    if (
      message.includes("não encontrado") ||
      message === "Cliente não encontrado"
    ) {
      return errorResponse("Cliente não encontrado", 404, {
        code: "CLIENT_NOT_FOUND",
      });
    }

    if (message.includes("Placeholders faltando")) {
      return errorResponse(
        "Erro interno: placeholders do template incompatíveis",
        500,
        {
          code: "PLACEHOLDER_MISMATCH",
          details:
            process.env.NODE_ENV === "development" && err instanceof Error
              ? err.message
              : undefined,
        }
      );
    }

    const isDev = process.env.NODE_ENV === "development";
    if (isDev && err instanceof Error && err.stack) {
      console.error("[pdf/pos-venda-llc]", err.stack);
    }

    return errorResponse(message, 500, {
      code: "PDF_GENERATION_FAILED",
      details: isDev && err instanceof Error ? err.stack : undefined,
    });
  }
}

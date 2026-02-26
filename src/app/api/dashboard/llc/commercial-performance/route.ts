import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCommercialPerformance } from "@/lib/dashboard/llcCommercialRepo";
import { getDefaultDateRange } from "@/lib/dashboardFilters";

export const dynamic = "force-dynamic";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD");

const querySchema = z.object({
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  commercial: z.string().max(50).optional(),
  sdr: z.string().max(50).optional(),
  paymentMethod: z.string().max(100).optional(),
});

/**
 * GET /api/dashboard/llc/commercial-performance?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 * Retorna performance por comercial (LLCs, receita, metas, MoM) no período.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = {
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      commercial: searchParams.get("commercial") ?? undefined,
      sdr: searchParams.get("sdr") ?? undefined,
      paymentMethod: searchParams.get("paymentMethod") ?? undefined,
    };
    const parsed = querySchema.parse(raw);
    const defaultRange = getDefaultDateRange();
    const from = parsed.dateFrom ?? defaultRange.from;
    const to = parsed.dateTo ?? defaultRange.to;
    const result = await getCommercialPerformance({
      from,
      to,
      commercial: parsed.commercial ?? null,
      sdr: parsed.sdr ?? null,
      paymentMethod: parsed.paymentMethod ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error("[GET /api/dashboard/llc/commercial-performance]", err);
    return NextResponse.json(
      { error: "Erro ao buscar performance por comercial" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLlcExecutiveKpis } from "@/lib/dashboard/llcExecutiveRepo";
import { executiveKpisQuerySchema } from "@/lib/dashboard/executiveKpisSchema";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/llc/executive-kpis?from=YYYY-MM-DD&to=YYYY-MM-DD
 * KPIs executivos: receita do período, metas do mês, deltas MoM.
 * Default: mês atual (from/to omitidos).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      timezone: searchParams.get("timezone") ?? undefined,
    };
    const parsed = executiveKpisQuerySchema.parse(raw);

    const result = await getLlcExecutiveKpis({
      from: parsed.from,
      to: parsed.to,
      timezone: parsed.timezone,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error("[GET /api/dashboard/llc/executive-kpis]", err);
    return NextResponse.json(
      { error: "Erro ao buscar KPIs executivos" },
      { status: 500 }
    );
  }
}

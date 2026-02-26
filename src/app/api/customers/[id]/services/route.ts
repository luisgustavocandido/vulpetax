import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCustomerServices } from "@/lib/customers/overviewRepo";
import { listCustomerServicesQuerySchema } from "@/lib/customers/overviewSchemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/customers/[id]/services
 * Lista serviços (line_items) das empresas do cliente pagador (paginação e filtros server-side).
 */
export async function GET(request: NextRequest, context: Params) {
  try {
    const { id: customerId } = await context.params;
    if (!customerId) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const raw = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      kind: searchParams.get("kind") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      saleFrom: searchParams.get("saleFrom") ?? undefined,
      saleTo: searchParams.get("saleTo") ?? undefined,
      minValue: searchParams.get("minValue") ?? undefined,
      maxValue: searchParams.get("maxValue") ?? undefined,
      companyId: searchParams.get("companyId") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
    };
    const parsed = listCustomerServicesQuerySchema.parse(raw);

    const result = await listCustomerServices({
      customerId,
      page: parsed.page,
      limit: parsed.limit,
      q: parsed.q,
      kind: parsed.kind,
      state: parsed.state,
      saleFrom: parsed.saleFrom,
      saleTo: parsed.saleTo,
      minValue: parsed.minValue,
      maxValue: parsed.maxValue,
      companyId: parsed.companyId,
      sort: parsed.sort,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error("[GET /api/customers/[id]/services]", err);
    return NextResponse.json(
      { error: "Erro ao listar serviços do cliente" },
      { status: 500 }
    );
  }
}

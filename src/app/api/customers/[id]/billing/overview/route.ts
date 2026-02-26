import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerBillingOverview } from "@/lib/customers/billingOverviewRepo";
import { billingOverviewQuerySchema } from "@/lib/customers/billingSchemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/customers/[id]/billing/overview
 * Métricas de cobrança do cliente pagador (charges das empresas vinculadas).
 * Query opcional: dueFrom, dueTo, createdFrom, createdTo (ISO date/datetime).
 */
export async function GET(request: NextRequest, context: Params) {
  try {
    const { id: customerId } = await context.params;
    if (!customerId) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const raw = {
      dueFrom: searchParams.get("dueFrom") ?? undefined,
      dueTo: searchParams.get("dueTo") ?? undefined,
      createdFrom: searchParams.get("createdFrom") ?? undefined,
      createdTo: searchParams.get("createdTo") ?? undefined,
    };
    const filters = billingOverviewQuerySchema.safeParse(raw);
    const parsedFilters = filters.success ? filters.data : undefined;

    const overview = await getCustomerBillingOverview(customerId, parsedFilters);
    if (!overview) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    return NextResponse.json(overview);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error("[GET /api/customers/[id]/billing/overview]", err);
    return NextResponse.json(
      { error: "Erro ao buscar visão de cobranças" },
      { status: 500 }
    );
  }
}

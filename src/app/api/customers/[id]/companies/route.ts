import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCustomerCompanies } from "@/lib/customers/overviewRepo";
import { listCustomerCompaniesQuerySchema } from "@/lib/customers/overviewSchemas";
import { resolveToCustomerId } from "@/lib/customers/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/customers/[id]/companies
 * Lista empresas vinculadas ao cliente pagador. [id] pode ser personGroupId ou customerId.
 */
export async function GET(request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    }
    const customerId = await resolveToCustomerId(id);
    if (!customerId) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const raw = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
    };
    const parsed = listCustomerCompaniesQuerySchema.parse(raw);

    const result = await listCustomerCompanies({
      customerId,
      page: parsed.page,
      limit: parsed.limit,
      q: parsed.q,
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
    console.error("[GET /api/customers/[id]/companies]", err);
    return NextResponse.json(
      { error: "Erro ao listar empresas do cliente" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCustomerCharges } from "@/lib/customers/billingOverviewRepo";
import { chargeListQuerySchema } from "@/lib/customers/billingSchemas";
import { resolveToCustomerId } from "@/lib/customers/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/customers/[id]/billing/charges
 * Lista cobranças do cliente pagador. [id] pode ser personGroupId ou customerId.
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
      status: searchParams.get("status") ?? undefined,
      dueFrom: searchParams.get("dueFrom") ?? undefined,
      dueTo: searchParams.get("dueTo") ?? undefined,
      paidFrom: searchParams.get("paidFrom") ?? undefined,
      paidTo: searchParams.get("paidTo") ?? undefined,
      minValue: searchParams.get("minValue") ?? undefined,
      maxValue: searchParams.get("maxValue") ?? undefined,
      companyId: searchParams.get("companyId") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
    };
    const parsed = chargeListQuerySchema.parse(raw);

    const result = await listCustomerCharges({
      customerId,
      page: parsed.page,
      limit: parsed.limit,
      q: parsed.q,
      status: parsed.status,
      dueFrom: parsed.dueFrom,
      dueTo: parsed.dueTo,
      paidFrom: parsed.paidFrom,
      paidTo: parsed.paidTo,
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
    console.error("[GET /api/customers/[id]/billing/charges]", err);
    return NextResponse.json(
      { error: "Erro ao listar cobranças" },
      { status: 500 }
    );
  }
}

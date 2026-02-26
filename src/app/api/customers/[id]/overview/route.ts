import { NextRequest, NextResponse } from "next/server";
import { getCustomerOverview } from "@/lib/customers/overviewRepo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/customers/[id]/overview
 * Retorna visão completa do cliente pagador: dados, totais e breakdown.
 */
export async function GET(_request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    }
    const overview = await getCustomerOverview(id);
    if (!overview) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    return NextResponse.json(overview);
  } catch (err) {
    const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Tabela não encontrada. Execute: npm run db:migrate" },
        { status: 503 }
      );
    }
    console.error("[GET /api/customers/[id]/overview]", err);
    return NextResponse.json(
      { error: "Erro ao buscar visão do cliente" },
      { status: 500 }
    );
  }
}

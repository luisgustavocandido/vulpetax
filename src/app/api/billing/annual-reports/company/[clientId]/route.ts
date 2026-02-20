import { NextRequest, NextResponse } from "next/server";
import { listCompanyObligations } from "@/lib/billing/annualReportRepo";
import { ensureAnnualReportObligations } from "@/lib/billing/annualReportEngine";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params;

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId é obrigatório" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state")?.trim() || undefined;
    const year = searchParams.get("year")?.trim() || undefined;
    const status = searchParams.get("status")?.trim() || undefined;
    const windowMonths = Math.min(24, Math.max(0, Number(searchParams.get("windowMonths")) || 12));

    // Garantir obrigações atualizadas
    await ensureAnnualReportObligations({ windowMonths });

    const { companyName, obligations } = await listCompanyObligations(clientId, {
      state,
      year,
      status,
    });

    return NextResponse.json({
      clientId,
      companyName,
      obligations,
    });
  } catch (err) {
    console.error("[GET /api/billing/annual-reports/company/:clientId]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao buscar obrigações da empresa" },
      { status: 500 }
    );
  }
}

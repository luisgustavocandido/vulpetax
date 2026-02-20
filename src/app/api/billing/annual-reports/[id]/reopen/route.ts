import { NextRequest, NextResponse } from "next/server";
import { reopenAnnualReport } from "@/lib/billing/annualReportRepo";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID da obrigação é obrigatório" }, { status: 400 });
    }

    const ok = await reopenAnnualReport(id);
    if (!ok) {
      return NextResponse.json({ error: "Obrigação não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/annual-reports/:id/reopen]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao reabrir obrigação" },
      { status: 500 }
    );
  }
}

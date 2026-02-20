import { NextRequest, NextResponse } from "next/server";
import { markAnnualReportCanceled } from "@/lib/billing/annualReportRepo";

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

    const body = await _request.json().catch(() => ({}));
    const notes = body.notes !== undefined ? (body.notes == null ? null : String(body.notes)) : undefined;

    const ok = await markAnnualReportCanceled(id, notes);
    if (!ok) {
      return NextResponse.json({ error: "Obrigação não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/annual-reports/:id/cancel]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao cancelar obrigação" },
      { status: 500 }
    );
  }
}

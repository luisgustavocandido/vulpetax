import { NextRequest, NextResponse } from "next/server";
import { markAnnualReportDone } from "@/lib/billing/annualReportRepo";

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
    const doneAt = typeof body.doneAt === "string" && body.doneAt.trim()
      ? body.doneAt.trim().slice(0, 10)
      : undefined;

    const ok = await markAnnualReportDone(id, doneAt);
    if (!ok) {
      return NextResponse.json({ error: "Obrigação não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/annual-reports/:id/done]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao marcar como concluído" },
      { status: 500 }
    );
  }
}

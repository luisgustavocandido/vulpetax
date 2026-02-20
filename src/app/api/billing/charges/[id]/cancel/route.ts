import { NextRequest, NextResponse } from "next/server";
import { getCharge, markCanceled } from "@/lib/billing/chargesRepo";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const notes = typeof body.notes === "string" ? body.notes : undefined;

    const existing = await getCharge(id);
    if (!existing) {
      return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    }
    if (existing.billingCharges.status === "paid") {
      return NextResponse.json(
        { error: "Não é possível cancelar cobrança já paga" },
        { status: 409 }
      );
    }

    const ok = await markCanceled({ chargeId: id, notes });
    if (!ok) {
      return NextResponse.json({ error: "Falha ao cancelar" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/charges/:id/cancel]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao cancelar" },
      { status: 500 }
    );
  }
}

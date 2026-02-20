import { NextRequest, NextResponse } from "next/server";
import { getCharge, markPaid } from "@/lib/billing/chargesRepo";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const paidAt =
      typeof body.paidAt === "string" && body.paidAt
        ? body.paidAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const paidMethod =
      typeof body.paidMethod === "string" ? body.paidMethod : undefined;
    const notes = typeof body.notes === "string" ? body.notes : undefined;

    const existing = await getCharge(id);
    if (!existing) {
      return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    }
    const { billingCharges: charge } = existing;
    if (charge.status === "paid") {
      return NextResponse.json(
        { error: "Esta cobrança já foi paga" },
        { status: 409 }
      );
    }
    if (charge.status === "canceled") {
      return NextResponse.json(
        { error: "Cobrança cancelada" },
        { status: 409 }
      );
    }

    const ok = await markPaid({
      chargeId: id,
      paidAt: paidAt.length === 10 ? `${paidAt}T12:00:00.000Z` : paidAt,
      paidMethod: paidMethod ?? existing.client.paymentMethod ?? "Manual",
      provider: "manual",
      notes: notes ?? null,
    });
    if (!ok) {
      return NextResponse.json({ error: "Falha ao atualizar" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/charges/:id/pay]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao marcar como pago" },
      { status: 500 }
    );
  }
}

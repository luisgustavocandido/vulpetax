import { NextRequest, NextResponse } from "next/server";
import { getCharge, reopenCharge } from "@/lib/billing/chargesRepo";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await getCharge(id);
    if (!existing) {
      return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    }
    if (existing.billingCharges.status === "paid") {
      return NextResponse.json(
        { error: "Não é possível reabrir cobrança paga" },
        { status: 409 }
      );
    }
    if (existing.billingCharges.status !== "canceled") {
      return NextResponse.json(
        { error: "Só é possível reabrir cobrança cancelada" },
        { status: 400 }
      );
    }

    const ok = await reopenCharge(id);
    if (!ok) {
      return NextResponse.json({ error: "Falha ao reabrir" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/charges/:id/reopen]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao reabrir" },
      { status: 500 }
    );
  }
}

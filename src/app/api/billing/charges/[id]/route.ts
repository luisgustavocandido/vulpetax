import { NextRequest, NextResponse } from "next/server";
import { updateCharge, deleteCharge } from "@/lib/billing/chargesRepo";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID da cobrança é obrigatório" }, { status: 400 });
    }
    const ok = await deleteCharge(id);
    if (!ok) {
      return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/billing/charges/:id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao excluir cobrança" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID da cobrança é obrigatório" }, { status: 400 });
    }
    const body = await _request.json().catch(() => ({}));
    const amountCents = typeof body.amountCents === "number" ? body.amountCents : undefined;
    const dueDate = typeof body.dueDate === "string" && body.dueDate.trim() ? body.dueDate.trim().slice(0, 10) : undefined;
    const notes = body.notes !== undefined ? (body.notes == null ? null : String(body.notes)) : undefined;
    const paidAt = body.paidAt !== undefined ? (body.paidAt == null ? null : String(body.paidAt).trim().slice(0, 10)) : undefined;

    if (amountCents !== undefined && (amountCents < 0 || !Number.isInteger(amountCents))) {
      return NextResponse.json({ error: "Valor (amountCents) deve ser um inteiro não negativo" }, { status: 400 });
    }
    if (dueDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return NextResponse.json({ error: "Data de vencimento inválida (use YYYY-MM-DD)" }, { status: 400 });
    }
    if (paidAt !== undefined && paidAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      return NextResponse.json({ error: "Data de pagamento inválida (use YYYY-MM-DD)" }, { status: 400 });
    }

    const ok = await updateCharge(id, { amountCents, dueDate, notes, paidAt });
    if (!ok && (amountCents !== undefined || dueDate !== undefined || notes !== undefined)) {
      return NextResponse.json({ error: "Cobrança não encontrada ou nenhum campo alterado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/billing/charges/:id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao atualizar cobrança" },
      { status: 500 }
    );
  }
}

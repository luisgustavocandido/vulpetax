import { NextRequest, NextResponse } from "next/server";
import { listCharges, getChargesSummary } from "@/lib/billing/chargesRepo";
import { ensureCharges } from "@/lib/billing/chargesEngine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "pending,overdue";
    const period = searchParams.get("period") ?? "all";
    const from = searchParams.get("from")?.trim() || searchParams.get("dueFrom")?.trim() || undefined;
    const to = searchParams.get("to")?.trim() || searchParams.get("dueTo")?.trim() || undefined;
    const q = searchParams.get("q")?.trim() || undefined;
    const clientId = searchParams.get("clientId")?.trim() || undefined;
    const state = searchParams.get("state")?.trim() || undefined;
    const sort = searchParams.get("sort")?.trim() || undefined;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const windowDays = Math.min(90, Math.max(0, Number(searchParams.get("windowDays")) || 60));

    await ensureCharges(windowDays);

    const filters = {
      status: status as "all" | "pending" | "overdue" | "paid" | "canceled" | "pending,overdue",
      period: period as "all" | "Mensal" | "Anual",
      from,
      to,
      q,
      clientId,
      state,
      sort: sort as "dueDateAsc" | "dueDateDesc" | "companyAsc" | "companyDesc" | undefined,
      page,
      limit,
    };

    const { data, total } = await listCharges(filters);

    // Summary com filtros aplicados (exceto paginação)
    const summary = await getChargesSummary({
      status: filters.status,
      period: filters.period,
      from: filters.from,
      to: filters.to,
      q: filters.q,
      clientId: filters.clientId,
      state: filters.state,
    });

    return NextResponse.json({
      data,
      meta: {
        page,
        limit,
        total,
        totals: {
          pendingCents: summary.pending.totalCents,
          overdueCents: summary.overdue.totalCents,
          paidCents: summary.paidThisMonth.totalCents,
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/billing/charges]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar cobranças" },
      { status: 500 }
    );
  }
}

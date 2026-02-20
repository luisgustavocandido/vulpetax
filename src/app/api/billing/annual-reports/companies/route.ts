import { NextRequest, NextResponse } from "next/server";
import { listAnnualReportCompanies, getCompanySummary } from "@/lib/billing/annualReportRepo";
import { ensureAnnualReportObligations } from "@/lib/billing/annualReportEngine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "pending,overdue";
    const frequency = searchParams.get("frequency")?.trim() || undefined;
    const state = searchParams.get("state")?.trim() || undefined;
    const year = searchParams.get("year")?.trim() || undefined;
    const q = searchParams.get("q")?.trim() || undefined;
    const from = searchParams.get("from")?.trim() || searchParams.get("dueFrom")?.trim() || undefined;
    const to = searchParams.get("to")?.trim() || searchParams.get("dueTo")?.trim() || undefined;
    const sort = searchParams.get("sort")?.trim() || undefined;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const windowMonths = Math.min(24, Math.max(0, Number(searchParams.get("windowMonths")) || 12));

    // Garantir obrigações atualizadas
    await ensureAnnualReportObligations({ windowMonths });

    const filters = {
      status: status as "all" | "pending" | "overdue" | "done" | "canceled" | "pending,overdue",
      frequency: frequency as "all" | "Anual" | "Bienal" | undefined,
      state,
      year,
      q,
      from,
      to,
      sort: sort as "dueDateAsc" | "dueDateDesc" | "companyAsc" | "companyDesc" | undefined,
      page,
      limit,
    };

    const { data, total } = await listAnnualReportCompanies(filters);

    // Summary de obrigações (count total de obrigações por status)
    const summary = await getCompanySummary({
      frequency: filters.frequency,
      state: filters.state,
      year: filters.year,
      from: filters.from,
      to: filters.to,
      q: filters.q,
    });

    return NextResponse.json({
      data,
      meta: {
        page,
        limit,
        total,
        totals: {
          pending: summary.pending,
          overdue: summary.overdue,
          done: summary.done,
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/billing/annual-reports/companies]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar empresas" },
      { status: 500 }
    );
  }
}

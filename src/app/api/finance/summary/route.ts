import { NextRequest, NextResponse } from "next/server";
import { getFinanceSessionIfValid } from "@/lib/financeDashboardAuth";
import { getFinanceSummary } from "@/lib/financeDashboardQueries";

export const dynamic = "force-dynamic";

function getMonthFromRequest(request: NextRequest): string {
  const month = request.nextUrl.searchParams.get("month");
  if (month && /^\d{4}-\d{2}$/.test(month)) return month;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const session = await getFinanceSessionIfValid();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const month = getMonthFromRequest(request);
  const summary = await getFinanceSummary(month);
  return NextResponse.json({ month, ...summary });
}

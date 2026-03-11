import { NextRequest, NextResponse } from "next/server";
import { getFinanceSessionIfValid } from "@/lib/financeDashboardAuth";
import { getFinanceRevenueSeries } from "@/lib/financeDashboardQueries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getFinanceSessionIfValid();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const monthsParam = request.nextUrl.searchParams.get("months");
  const months = monthsParam ? Math.min(24, Math.max(1, parseInt(monthsParam, 10) || 12)) : 12;
  const series = await getFinanceRevenueSeries(months);
  return NextResponse.json({ series });
}

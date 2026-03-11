import { NextRequest, NextResponse } from "next/server";
import { getFinanceSessionIfValid } from "@/lib/financeDashboardAuth";
import { getTopOverdueCharges } from "@/lib/financeDashboardQueries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getFinanceSessionIfValid();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(50, Math.max(1, parseInt(limitParam, 10) || 10)) : 10;
  const items = await getTopOverdueCharges(limit);
  return NextResponse.json({ items });
}

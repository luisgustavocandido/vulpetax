import { NextRequest, NextResponse } from "next/server";
import { getFinanceSessionCookieName } from "@/lib/financeDashboardSession";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const url = new URL("/dashboard-financeiro/login", request.url);
  const res = NextResponse.redirect(url);
  res.cookies.set(getFinanceSessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import {
  createFinanceSessionValue,
  validateFinancePassword,
  getFinanceSessionCookieName,
} from "@/lib/financeDashboardSession";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";

    if (!password) {
      return NextResponse.json(
        { error: "Senha é obrigatória" },
        { status: 400 }
      );
    }

    if (!validateFinancePassword(password)) {
      return NextResponse.json(
        { error: "Senha incorreta" },
        { status: 401 }
      );
    }

    const sessionValue = await createFinanceSessionValue();
    const cookieName = getFinanceSessionCookieName();
    const isProd = process.env.NODE_ENV === "production";

    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieName, sessionValue, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[POST /api/finance/auth]", err);
    return NextResponse.json(
      { error: "Erro ao autenticar" },
      { status: 500 }
    );
  }
}

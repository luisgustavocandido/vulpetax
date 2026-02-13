import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getSessionCookieName,
  verifySessionValue,
} from "@/lib/passcodeSession";
import { getRequestOrigin } from "@/lib/requestMeta";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bloquear rotas de debug fora de development (intranet)
  if (pathname.startsWith("/api/debug") && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Bloquear DISABLE_AUTH em produção (segurança intranet)
  if (process.env.NODE_ENV === "production" && process.env.DISABLE_AUTH === "true") {
    return NextResponse.json(
      { error: "DISABLE_AUTH não é permitido em produção. Remova DISABLE_AUTH do .env e reinicie o app." },
      { status: 503 }
    );
  }

  // Bypass temporário: DISABLE_AUTH=true desliga a checagem de sessão (apenas desenvolvimento)
  const authDisabled = process.env.DISABLE_AUTH === "true";
  if (authDisabled) {
    const res = NextResponse.next();
    if (
      pathname === "/clients" ||
      pathname.startsWith("/clients/") ||
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/tax" ||
      pathname.startsWith("/tax/")
    ) {
      res.headers.set("Cache-Control", "no-store");
    }
    return res;
  }

  const cookieValue = request.cookies.get(getSessionCookieName())?.value;
  const session = await verifySessionValue(cookieValue);

  // /login é público, mas se já houver sessão válida, redireciona para /clients
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (session) {
      const destination =
        request.nextUrl.searchParams.get("callbackUrl") || "/clients";
      return NextResponse.redirect(new URL(destination, getRequestOrigin(request)));
    }
    return NextResponse.next();
  }

  // Endpoints públicos (login, logout)
  if (pathname === "/api/passcode-login" || pathname === "/api/logout") {
    return NextResponse.next();
  }

  // Sync endpoints: bypass de sessão via x-cron-secret ou Authorization: Bearer
  if (pathname === "/api/sync/tax-form" || pathname === "/api/sync/posvenda-llc") {
    const { getCronSecret } = await import("@/lib/cronAuth");
    if (getCronSecret(request)) {
      return NextResponse.next();
    }
  }

  const isProtectedClients =
    pathname === "/clients" || pathname.startsWith("/clients/");
  const isProtectedDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isProtectedTax =
    pathname === "/tax" || pathname.startsWith("/tax/");
  const isApi = pathname.startsWith("/api/");

  if (isProtectedClients || isProtectedDashboard || isProtectedTax || isApi) {
    if (!session) {
      if (isApi) {
        return NextResponse.json(
          { error: "Não autenticado" },
          { status: 401 }
        );
      }
      const loginUrl = new URL("/login", getRequestOrigin(request));
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const res = NextResponse.next();
  if (isProtectedClients || isProtectedDashboard || isProtectedTax) {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}

export const config = {
  matcher: ["/login", "/login/:path*", "/clients", "/clients/:path*", "/dashboard", "/dashboard/:path*", "/tax", "/tax/:path*", "/api/:path*"],
};


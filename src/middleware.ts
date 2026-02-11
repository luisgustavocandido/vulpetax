import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getSessionCookieName,
  verifySessionValue,
} from "@/lib/passcodeSession";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const cookieValue = request.cookies.get(getSessionCookieName())?.value;
  const session = await verifySessionValue(cookieValue);

  // /login é público, mas se já houver sessão válida, redireciona para /clients
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (session) {
      const destination =
        request.nextUrl.searchParams.get("callbackUrl") || "/clients";
      return NextResponse.redirect(new URL(destination, request.url));
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
      const loginUrl = new URL("/login", request.url);
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


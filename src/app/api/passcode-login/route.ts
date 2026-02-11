import { NextRequest, NextResponse } from "next/server";
import { getRequestMeta } from "@/lib/requestMeta";
import {
  createSessionValue,
  getSessionCookieName,
  validatePasscode,
} from "@/lib/passcodeSession";
import {
  rateLimitCheck,
  rateLimitConsume,
  rateLimitClear,
} from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/logger";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const ip = meta.ip ?? "unknown";

  if (!rateLimitCheck(ip)) {
    logSecurityEvent("login_rate_limited", { ip });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "rate_limit");
    return NextResponse.redirect(loginUrl);
  }

  const formData = await request.formData();
  const passcode = (formData.get("passcode") || "").toString();
  const callbackUrl =
    (formData.get("callbackUrl") || "/clients").toString() || "/clients";

  if (!validatePasscode(passcode)) {
    rateLimitConsume(ip);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "invalid");
    if (callbackUrl && callbackUrl !== "/clients") {
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
    }
    return NextResponse.redirect(loginUrl);
  }

  rateLimitClear(ip);

  const sessionValue = await createSessionValue();
  const response = NextResponse.redirect(new URL(callbackUrl, request.url));
  response.cookies.set(getSessionCookieName(), sessionValue, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}

export function GET() {
  return NextResponse.redirect("/login");
}


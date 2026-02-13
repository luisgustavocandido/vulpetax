import { NextRequest, NextResponse } from "next/server";
import { getRequestMeta, getRequestOrigin } from "@/lib/requestMeta";
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

function isSecureRequest(request: NextRequest): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "https") return true;
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const ip = meta.ip ?? "unknown";

  if (!rateLimitCheck(ip)) {
    logSecurityEvent("login_rate_limited", { ip });
    const loginUrl = new URL("/login", getRequestOrigin(request));
    loginUrl.searchParams.set("error", "rate_limit");
    return NextResponse.redirect(loginUrl);
  }

  const formData = await request.formData();
  const passcode = (formData.get("passcode") || "").toString();
  const callbackUrl =
    (formData.get("callbackUrl") || "/clients").toString() || "/clients";

  if (!validatePasscode(passcode)) {
    rateLimitConsume(ip);
    const loginUrl = new URL("/login", getRequestOrigin(request));
    loginUrl.searchParams.set("error", "invalid");
    if (callbackUrl && callbackUrl !== "/clients") {
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
    }
    return NextResponse.redirect(loginUrl);
  }

  rateLimitClear(ip);

  const sessionValue = await createSessionValue();
  const origin = getRequestOrigin(request);
  const response = NextResponse.redirect(new URL(callbackUrl, origin));
  response.cookies.set(getSessionCookieName(), sessionValue, {
    ...COOKIE_OPTIONS,
    secure: isSecureRequest(request),
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}

export function GET() {
  return NextResponse.redirect("/login");
}


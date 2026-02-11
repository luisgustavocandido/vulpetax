import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/passcodeSession";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 0,
};

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(getSessionCookieName(), "", COOKIE_OPTIONS);
  return response;
}

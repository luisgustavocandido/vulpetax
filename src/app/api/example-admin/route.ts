import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

/**
 * Exemplo: exigir role admin em uma API route.
 * GET /api/example-admin — só admin acessa (401/403 caso contrário).
 */
export async function GET() {
  try {
    const user = await requireRole(["admin"]);
    return NextResponse.json({
      message: "Acesso admin permitido",
      userId: user.id,
      role: user.role,
    });
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }
}

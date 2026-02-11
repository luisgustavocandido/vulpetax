import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Exemplo: obter usuário atual em uma API route.
 * GET /api/auth/me — retorna o usuário da sessão (protegido pelo middleware).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

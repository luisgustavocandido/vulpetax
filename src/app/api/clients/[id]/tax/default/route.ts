import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientTaxForms } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/clients/[id]/tax/default
 * Retorna o ID do TAX form padrão para um cliente:
 * - O mais recente (por createdAt) com status='draft', OU
 * - O mais recente de qualquer status, OU
 * - null se não houver nenhum
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!client || client.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  // Tentar encontrar draft mais recente
  const [draftForm] = await db
    .select({ id: clientTaxForms.id })
    .from(clientTaxForms)
    .where(and(eq(clientTaxForms.clientId, id), eq(clientTaxForms.status, "draft")))
    .orderBy(desc(clientTaxForms.createdAt))
    .limit(1);

  if (draftForm) {
    return NextResponse.json({ taxFormId: draftForm.id });
  }

  // Se não houver draft, pegar o mais recente de qualquer status
  const [latestForm] = await db
    .select({ id: clientTaxForms.id })
    .from(clientTaxForms)
    .where(eq(clientTaxForms.clientId, id))
    .orderBy(desc(clientTaxForms.createdAt))
    .limit(1);

  if (latestForm) {
    return NextResponse.json({ taxFormId: latestForm.id });
  }

  return NextResponse.json({ taxFormId: null });
}

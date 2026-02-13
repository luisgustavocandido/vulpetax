import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRequestMeta } from "@/lib/requestMeta";
import { logAudit, diffChangedFields } from "@/lib/audit";
import { randomBytes } from "crypto";
import { normalizeCompanyName } from "@/lib/clientDedupe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error("[POST clients/provisional] Invalid JSON body");
    return NextResponse.json(
      { error: "Corpo da requisição inválido (JSON esperado)" },
      { status: 400 }
    );
  }

  const taxYear = (body && typeof body === "object" && "taxYear" in body)
    ? Number(body.taxYear) || new Date().getFullYear()
    : new Date().getFullYear();
  const meta = getRequestMeta(request);

  try {
    // Criar cliente provisório
    const provisionalCode = `TAX-MANUAL-${randomBytes(4).toString("hex").toUpperCase()}`;
    const companyName = `(Novo TAX - manual ${taxYear})`;
    const companyNameNormalized = normalizeCompanyName(companyName);

    const [inserted] = await db
      .insert(clients)
      .values({
        companyName,
        companyNameNormalized,
        customerCode: provisionalCode,
        notes: `Cliente criado automaticamente para formulário TAX manual (ano fiscal ${taxYear}). Consolidar dados quando possível.`,
      })
      .returning({ id: clients.id });

    if (!inserted) {
      return NextResponse.json({ error: "Erro ao criar cliente provisório" }, { status: 500 });
    }

    const [full] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, inserted.id))
      .limit(1);

    const { oldValues, newValues } = diffChangedFields(null, full as Record<string, unknown>);
    await logAudit(db, {
      action: "create",
      entity: "clients",
      entityId: inserted.id,
      oldValues,
      newValues: { ...newValues, provisional: true },
      meta,
    });

    return NextResponse.json(
      { clientId: inserted.id, customerCode: provisionalCode },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("[POST clients/provisional] Error", {
      taxYear,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Erro interno ao criar cliente provisório" },
      { status: 500 }
    );
  }
}

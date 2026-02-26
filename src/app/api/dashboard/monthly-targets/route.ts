import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { monthlyTargets } from "@/db/schema";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
  llcTarget: z.number().int().min(0),
  revenueTargetCents: z.number().int().min(0),
});

/**
 * POST /api/dashboard/monthly-targets
 * Cria ou atualiza meta do mês (upsert por month).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.parse(body);

    await db
      .insert(monthlyTargets)
      .values({
        month: parsed.month,
        llcTarget: parsed.llcTarget,
        revenueTargetCents: parsed.revenueTargetCents,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: monthlyTargets.month,
        set: {
          llcTarget: parsed.llcTarget,
          revenueTargetCents: parsed.revenueTargetCents,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true, month: parsed.month });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: err.flatten() },
        { status: 400 }
      );
    }
    const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Tabela de metas não existe. Execute: npm run db:ensure-monthly-targets" },
        { status: 503 }
      );
    }
    console.error("[POST /api/dashboard/monthly-targets]", err);
    return NextResponse.json(
      { error: "Erro ao salvar meta" },
      { status: 500 }
    );
  }
}

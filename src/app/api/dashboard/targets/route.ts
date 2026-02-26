import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { monthlyTargets } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM");
const bodySchema = z.object({
  month: monthSchema,
  llcTarget: z.number().int().min(0),
  revenueTargetCents: z.number().int().min(0),
});

/**
 * GET /api/dashboard/targets?month=YYYY-MM
 * Retorna meta do mês (ou vazio se não existir).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const parsed = monthSchema.safeParse(month ?? "");
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parâmetro month obrigatório (YYYY-MM)" },
        { status: 400 }
      );
    }
    const monthKey = parsed.data;

    try {
      const [row] = await db
        .select({
          month: monthlyTargets.month,
          llcTarget: monthlyTargets.llcTarget,
          revenueTargetCents: monthlyTargets.revenueTargetCents,
        })
        .from(monthlyTargets)
        .where(eq(monthlyTargets.month, monthKey))
        .limit(1);

      if (!row) {
        return NextResponse.json({ month: monthKey, llcTarget: 0, revenueTargetCents: 0 });
      }
      return NextResponse.json({
        month: row.month,
        llcTarget: row.llcTarget,
        revenueTargetCents: row.revenueTargetCents,
      });
    } catch (err: unknown) {
      const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
      if (code === "42P01") {
        return NextResponse.json({ month: monthKey, llcTarget: 0, revenueTargetCents: 0 });
      }
      throw err;
    }
  } catch (err) {
    console.error("[GET /api/dashboard/targets]", err);
    return NextResponse.json(
      { error: "Erro ao buscar meta" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/targets
 * Body: { month: 'YYYY-MM', llcTarget: number, revenueTargetCents: number }
 * Upsert por month.
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
    console.error("[POST /api/dashboard/targets]", err);
    return NextResponse.json(
      { error: "Erro ao salvar meta" },
      { status: 500 }
    );
  }
}

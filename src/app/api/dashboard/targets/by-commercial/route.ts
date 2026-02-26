import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { monthlyTargetsByCommercial } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM");
const itemSchema = z.object({
  commercial: z.string().min(1).max(50),
  llcTarget: z.number().int().min(0),
  revenueTargetCents: z.number().int().min(0),
});
const bodySchema = z.object({
  month: monthSchema,
  items: z.array(itemSchema),
});

/**
 * GET /api/dashboard/targets/by-commercial?month=YYYY-MM
 * Retorna Array<{ commercial, llcTarget, revenueTargetCents }>. Sem linha = 0. 42P01 → [].
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
      const rows = await db
        .select({
          commercial: monthlyTargetsByCommercial.commercial,
          llcTarget: monthlyTargetsByCommercial.llcTarget,
          revenueTargetCents: monthlyTargetsByCommercial.revenueTargetCents,
        })
        .from(monthlyTargetsByCommercial)
        .where(eq(monthlyTargetsByCommercial.month, monthKey));

      return NextResponse.json(
        rows.map((r) => ({
          commercial: r.commercial,
          llcTarget: r.llcTarget,
          revenueTargetCents: r.revenueTargetCents,
        }))
      );
    } catch (err: unknown) {
      const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
      if (code === "42P01") {
        return NextResponse.json([]);
      }
      throw err;
    }
  } catch (err) {
    console.error("[GET /api/dashboard/targets/by-commercial]", err);
    return NextResponse.json(
      { error: "Erro ao buscar metas por comercial" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/targets/by-commercial
 * Body: { month: 'YYYY-MM', items: Array<{ commercial, llcTarget, revenueTargetCents }> }
 * Bulk upsert: ON CONFLICT (month, commercial) DO UPDATE.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.parse(body);
    const { month, items } = parsed;

    if (items.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const now = new Date();
    const values = items.map((i) => ({
      month,
      commercial: i.commercial,
      llcTarget: i.llcTarget,
      revenueTargetCents: i.revenueTargetCents,
      updatedAt: now,
    }));

    await db
      .insert(monthlyTargetsByCommercial)
      .values(values)
      .onConflictDoUpdate({
        target: [
          monthlyTargetsByCommercial.month,
          monthlyTargetsByCommercial.commercial,
        ],
        set: {
          llcTarget: sql.raw("excluded.llc_target"),
          revenueTargetCents: sql.raw("excluded.revenue_target_cents"),
          updatedAt: now,
        },
      });

    return NextResponse.json({ ok: true, count: items.length });
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
        { error: "Tabela de metas por comercial não existe. Execute o script de criação." },
        { status: 503 }
      );
    }
    console.error("[POST /api/dashboard/targets/by-commercial]", err);
    return NextResponse.json(
      { error: "Erro ao salvar metas" },
      { status: 500 }
    );
  }
}

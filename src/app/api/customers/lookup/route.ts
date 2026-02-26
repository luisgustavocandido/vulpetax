import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lookupCustomers } from "@/lib/customers/repo";

const querySchema = z.object({
  q: z.string().trim().optional().default(""),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      q: searchParams.get("q") ?? "",
      limit: searchParams.get("limit"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", items: [] },
        { status: 400 }
      );
    }

    const qTrim = parsed.data.q.trim();
    const limit = parsed.data.limit;
    if (qTrim.length < 2) {
      return NextResponse.json({ items: [] });
    }
    const raw = await lookupCustomers(qTrim, limit);
    const byId = new Map(raw.map((r) => [r.id, r]));
    const items = Array.from(byId.values());
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[GET /api/customers/lookup]", err);
    return NextResponse.json(
      { error: "Erro ao buscar clientes", items: [] },
      { status: 500 }
    );
  }
}

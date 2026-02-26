import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { and, isNull, or, ilike, desc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(2, "Mínimo 2 caracteres"),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      q: searchParams.get("q") ?? "",
      limit: searchParams.get("limit"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { q, limit } = parsed.data;
    const term = q.trim();
    if (term.length < 2) {
      return NextResponse.json({ items: [] });
    }

    const pattern = `%${term.replace(/%/g, "\\%")}%`;

    const results = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        email: clients.email,
      })
      .from(clients)
      .where(
        and(
          isNull(clients.deletedAt),
          or(
            ilike(clients.companyName, pattern),
            ilike(clients.companyNameNormalized, pattern),
            clients.email ? ilike(clients.email, pattern) : undefined
          )
        )
      )
      .orderBy(desc(clients.createdAt))
      .limit(limit);

    const items = results.map((r) => ({
      id: r.id,
      companyName: r.companyName,
      personalEmail: r.email ?? null,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[GET /api/clients/lookup]", err);
    return NextResponse.json(
      { error: "Erro ao buscar clientes", items: [] },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { and, isNull, ilike, or, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim();
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));

    if (!query || query.length < 2) {
      return NextResponse.json({ clients: [] });
    }

    const searchPattern = `%${query}%`;

    const results = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        customerCode: clients.customerCode,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(
        and(
          isNull(clients.deletedAt),
          or(
            ilike(clients.companyName, searchPattern),
            ilike(clients.companyNameNormalized, searchPattern),
            clients.customerCode ? ilike(clients.customerCode, searchPattern) : undefined
          )
        )
      )
      .orderBy(desc(clients.createdAt))
      .limit(limit);

    return NextResponse.json({ clients: results });
  } catch (error: unknown) {
    console.error("Erro ao buscar clientes:", error);
    return NextResponse.json(
      { error: "Erro ao buscar clientes", clients: [] },
      { status: 500 }
    );
  }
}

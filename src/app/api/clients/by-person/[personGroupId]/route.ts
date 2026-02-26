import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personGroupId: string }> }
) {
  const { personGroupId } = await params;
  if (!personGroupId) {
    return NextResponse.json({ error: "personGroupId é obrigatório" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const offset = (page - 1) * limit;
  const q = searchParams.get("q")?.trim();

  const conditions = [isNull(clients.deletedAt), eq(clients.personGroupId, personGroupId)];
  if (q) {
    const term = `%${q}%`;
    conditions.push(
      sql`(${clients.companyName} ilike ${term} or ${clients.customerCode} ilike ${term})`
    );
  }
  const where = and(...conditions);

  const list = await db
    .select({
      id: clients.id,
      companyName: clients.companyName,
      customerCode: clients.customerCode,
    })
    .from(clients)
    .where(where)
    .orderBy(asc(clients.companyName))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients)
    .where(where);

  const total = totalRow?.count ?? 0;
  return NextResponse.json({
    data: list,
    total,
    page,
    limit,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientPartners, clients } from "@/db/schema";
import { and, eq, ilike, or, sql, isNull, desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export type PartnerListItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  percentage: number;
  company: { id: string; name: string; code: string };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const companyId = searchParams.get("companyId")?.trim();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;
    const sort = searchParams.get("sort") === "name_desc" ? "name_desc" : "name_asc";

    const conditions = [
      eq(clientPartners.isPayer, false),
      isNull(clients.deletedAt),
    ];
    if (companyId) {
      conditions.push(eq(clientPartners.clientId, companyId));
    }
    if (q.length >= 1) {
      const pattern = `%${q.replace(/%/g, "\\%")}%`;
      const digitsOnly = q.replace(/\D/g, "");
      const phonePattern = digitsOnly.length >= 2 ? `%${digitsOnly}%` : null;
      const qConditions = [
        ilike(clientPartners.fullName, pattern),
        ilike(clientPartners.email, pattern),
      ];
      if (phonePattern) {
        qConditions.push(ilike(clientPartners.phone, phonePattern));
      }
      conditions.push(or(...qConditions)!);
    }
    const where = and(...conditions);
    const orderBy = sort === "name_desc"
      ? desc(clientPartners.fullName)
      : asc(clientPartners.fullName);

    const [totalRow, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(clientPartners)
        .innerJoin(clients, eq(clients.id, clientPartners.clientId))
        .where(where),
      db
        .select({
          id: clientPartners.id,
          fullName: clientPartners.fullName,
          email: clientPartners.email,
          phone: clientPartners.phone,
          role: clientPartners.role,
          percentageBasisPoints: clientPartners.percentageBasisPoints,
          clientId: clients.id,
          companyName: clients.companyName,
          customerCode: clients.customerCode,
        })
        .from(clientPartners)
        .innerJoin(clients, eq(clients.id, clientPartners.clientId))
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(totalRow[0]?.count ?? 0);
    const items: PartnerListItem[] = rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      email: r.email ?? null,
      phone: r.phone ?? null,
      role: r.role,
      percentage: r.percentageBasisPoints / 100,
      company: { id: r.clientId, name: r.companyName, code: r.customerCode },
    }));

    return NextResponse.json({ items, total, page, limit });
  } catch (err) {
    console.error("[GET /api/partners]", err);
    return NextResponse.json(
      { error: "Erro ao listar sócios", items: [], total: 0, page: 1, limit: 20 },
      { status: 500 }
    );
  }
}

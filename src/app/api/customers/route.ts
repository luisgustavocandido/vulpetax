import { NextRequest, NextResponse } from "next/server";
import { createCustomerSchema } from "@/lib/customers/validators";
import { createCustomer, listCustomers } from "@/lib/customers/repo";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const sort = (searchParams.get("sort") as "name_asc" | "name_desc" | "recent") || "name_asc";
    const result = await listCustomers({ q, page, limit, sort });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/customers]", err);
    return NextResponse.json(
      { error: "Erro ao listar clientes pagadores", items: [], total: 0, page: 1, limit: 20 },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await createCustomer(parsed.data);
    return NextResponse.json({ id: result.id, reused: result.reused === true });
  } catch (err) {
    console.error("[POST /api/customers]", err);
    return NextResponse.json(
      { error: "Erro ao cadastrar cliente pagador" },
      { status: 500 }
    );
  }
}

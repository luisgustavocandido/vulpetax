import { NextRequest, NextResponse } from "next/server";
import { getCustomerFullById, updateCustomer } from "@/lib/customers/repo";
import { updateCustomerSchema } from "@/lib/customers/validators";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/customers/[id]
 * Retorna o customer completo (todos os campos) para exibir no formulário quando o pagador é cliente existente.
 */
export async function GET(_request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    }
    const customer = await getCustomerFullById(id);
    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    return NextResponse.json(customer);
  } catch (err) {
    const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Tabela 'customers' não existe. Execute: npm run db:migrate" },
        { status: 503 }
      );
    }
    console.error("[GET /api/customers/[id]]", err);
    return NextResponse.json(
      { error: "Erro ao buscar cliente" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/customers/[id]
 * Atualiza o customer. Body: updateCustomerSchema (full payload). Email é normalizado (trim + lower).
 */
export async function PATCH(request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    }
    const body = await request.json();
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const customer = await updateCustomer(id, parsed.data);
    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    return NextResponse.json(customer);
  } catch (err) {
    const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Tabela 'customers' não existe. Execute: npm run db:migrate" },
        { status: 503 }
      );
    }
    if (code === "23505") {
      return NextResponse.json(
        { error: "E-mail já cadastrado para outro cliente" },
        { status: 409 }
      );
    }
    console.error("[PATCH /api/customers/[id]]", err);
    return NextResponse.json(
      { error: "Erro ao atualizar cliente" },
      { status: 500 }
    );
  }
}

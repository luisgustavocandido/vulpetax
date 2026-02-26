import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCustomerFromPersonGroup } from "@/lib/customers/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ personGroupId: string }> };

/**
 * GET /api/customers/by-person/[personGroupId]
 * Retorna o customer (id, fullName, email, phone) para usar como pagador.
 * Se a pessoa já tiver customer com mesmo e-mail, retorna esse; senão cria um customer a partir dos dados da pessoa.
 */
export async function GET(request: NextRequest, context: Params) {
  try {
    const { personGroupId } = await context.params;
    if (!personGroupId) {
      return NextResponse.json(
        { error: "personGroupId obrigatório" },
        { status: 400 }
      );
    }
    const customer = await getOrCreateCustomerFromPersonGroup(personGroupId);
    if (!customer) {
      return NextResponse.json(
        { error: "Pessoa não encontrada" },
        { status: 404 }
      );
    }
    return NextResponse.json(customer);
  } catch (err) {
    const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
    if (code === "42P01") {
      return NextResponse.json(
        {
          error: "Tabela 'customers' não existe no banco. Execute as migrações: npm run db:migrate",
          code: "MIGRATION_REQUIRED",
        },
        { status: 503 }
      );
    }
    console.error("[GET /api/customers/by-person/[personGroupId]]", err);
    return NextResponse.json(
      { error: "Erro ao obter cliente pagador" },
      { status: 500 }
    );
  }
}

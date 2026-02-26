import { NextRequest, NextResponse } from "next/server";
import { getProcessById } from "@/lib/processes/repo";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, ctx: RouteParams) {
  try {
    const { id } = await ctx.params;
    const { process, steps } = await getProcessById(id);
    if (!process) {
      return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ process, steps });
  } catch (err) {
    console.error("[GET /api/processes/:id]", err);
    return NextResponse.json(
      { error: "Erro ao carregar processo" },
      { status: 500 }
    );
  }
}


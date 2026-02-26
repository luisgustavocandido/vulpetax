import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateStepStatus } from "@/lib/processes/repo";
import { updateStepStatusSchema } from "@/lib/processes/schemas";

type RouteParams = {
  params: Promise<{ id: string; stepId: string }>;
};

export async function PATCH(request: NextRequest, ctx: RouteParams) {
  try {
    const { id, stepId } = await ctx.params;
    const json = await request.json();
    const body = updateStepStatusSchema.parse(json);

    const result = await updateStepStatus({
      processId: id,
      stepId,
      status: body.status,
    });

    if (!result.ok || !result.process) {
      return NextResponse.json(
        { error: "Processo ou etapa não encontrados" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      process: result.process,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Payload inválido", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error("[PATCH /api/processes/:id/steps/:stepId]", err);
    return NextResponse.json(
      { error: "Erro ao atualizar etapa do processo" },
      { status: 500 }
    );
  }
}


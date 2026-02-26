import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProcessWithTemplate, listProcesses, getStageSummary } from "@/lib/processes/repo";
import { ensureLlcProcessesForAllClients } from "@/lib/processes/engine";
import {
  createProcessSchema,
  listProcessesQuerySchema,
} from "@/lib/processes/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureLlcProcessesForAllClients();

    const { searchParams } = new URL(request.url);
    const raw = {
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      assignee: searchParams.get("assignee") ?? undefined,
      department: searchParams.get("department") ?? undefined,
      kind: searchParams.get("kind") ?? undefined,
      paymentDateFrom: searchParams.get("paymentDateFrom") ?? undefined,
      paymentDateTo: searchParams.get("paymentDateTo") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    };

    const parsed = listProcessesQuerySchema.parse(raw);
    const [listResult, stageResult] = await Promise.all([
      listProcesses(parsed),
      getStageSummary(parsed),
    ]);
    const { items, total, summary } = listResult;
    const { stageSummary, doneCount } = stageResult;

    return NextResponse.json({
      items,
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total,
      },
      summary,
      stageSummary,
      doneCount,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error("[GET /api/processes]", err);
    return NextResponse.json(
      { error: "Erro ao listar processos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = createProcessSchema.parse(json);
    const { id } = await createProcessWithTemplate(input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    // Erros de validação
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Payload inválido", details: err.flatten() },
        { status: 400 }
      );
    }
    // Erros de regra de negócio (line item / duplicidade)
    if (err && typeof err === "object") {
      const anyErr = err as { code?: string; message?: string; existingProcessId?: string };
      if (anyErr.code === "LINE_ITEM_NOT_FOUND") {
        return NextResponse.json(
          { error: anyErr.message ?? "Line item não encontrado" },
          { status: 404 }
        );
      }
      if (anyErr.code === "LINE_ITEM_CLIENT_MISMATCH") {
        return NextResponse.json(
          { error: anyErr.message ?? "Line item não pertence ao cliente informado" },
          { status: 400 }
        );
      }
      if (anyErr.code === "INVALID_LINE_ITEM_KIND") {
        return NextResponse.json(
          { error: anyErr.message ?? "Tipo de processo incompatível com o serviço" },
          { status: 400 }
        );
      }
      if (anyErr.code === "PROCESS_DUPLICATE") {
        return NextResponse.json(
          {
            error: anyErr.message ?? "Já existe um processo para este serviço e tipo",
            existingProcessId: anyErr.existingProcessId,
          },
          { status: 409 }
        );
      }
    }
    console.error("[POST /api/processes]", err);
    return NextResponse.json(
      { error: "Erro ao criar processo" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, processes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureLlcProcessForClient } from "@/lib/processes/engine";

type RouteParams = { params: Promise<{ clientId: string }> };

export const dynamic = "force-dynamic";

/**
 * Garante que o cliente tenha processo LLC e retorna o id.
 * Usado pelo botão "Abrir processo LLC" na tela do cliente.
 */
export async function GET(_request: NextRequest, ctx: RouteParams) {
  try {
    const { clientId } = await ctx.params;

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    await ensureLlcProcessForClient(clientId);

    const [process] = await db
      .select({ id: processes.id })
      .from(processes)
      .where(
        and(
          eq(processes.clientId, clientId),
          eq(processes.kind, "LLC_PROCESS")
        )
      )
      .limit(1);

    if (!process) {
      return NextResponse.json(
        { error: "Processo LLC não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: process.id });
  } catch (err) {
    console.error("[GET /api/processes/by-client/:clientId]", err);
    return NextResponse.json(
      { error: "Erro ao obter processo do cliente" },
      { status: 500 }
    );
  }
}

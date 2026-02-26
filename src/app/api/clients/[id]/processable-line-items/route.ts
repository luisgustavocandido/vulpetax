import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientLineItems, processes } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getStateByCode } from "@/constants/usStates";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: RouteParams) {
  try {
    const { id } = await ctx.params;

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (!client || client.deletedAt) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const lineItems = await db
      .select()
      .from(clientLineItems)
      .where(eq(clientLineItems.clientId, id));

    const lineItemIds = lineItems.map((li) => li.id);

    // Processo LLC por cliente (1 por cliente; lineItemId pode ser null)
    const [llcProcess] = await db
      .select({ id: processes.id })
      .from(processes)
      .where(
        and(
          eq(processes.clientId, id),
          eq(processes.kind, "LLC_PROCESS")
        )
      )
      .limit(1);

    const processesByLineItem = new Map<string, string>();
    if (llcProcess) {
      for (const li of lineItems) {
        if (li.kind === "LLC") processesByLineItem.set(li.id, llcProcess.id);
      }
    }
    if (lineItemIds.length > 0) {
      const rows = await db
        .select({
          id: processes.id,
          lineItemId: processes.lineItemId,
          kind: processes.kind,
        })
        .from(processes)
        .where(
          and(
            eq(processes.clientId, id),
            inArray(processes.lineItemId, lineItemIds)
          )
        );

      for (const p of rows) {
        if (p.lineItemId && p.kind === "LLC_PROCESS") {
          processesByLineItem.set(p.lineItemId, p.id);
        }
      }
    }

    const toIso = (d: Date | string | null) => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      const s = String(d);
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
    };

    const makeLabel = (li: (typeof clientLineItems.$inferSelect)) => {
      if (li.kind === "LLC") {
        const state = li.llcState ? getStateByCode(li.llcState) : null;
        const stateLabel = state?.name ?? li.llcState ?? "";
        let category = li.llcCategory ?? "";
        if (category === "Personalizado" && li.llcCustomCategory) {
          category = li.llcCustomCategory;
        }
        const parts = ["LLC"];
        if (stateLabel) parts.push(stateLabel);
        if (category) parts.push(category);
        return parts.join(" · ");
      }

      const base = li.kind ?? "Serviço";
      const desc = li.description?.trim();
      return desc ? `${base} · ${desc}` : base;
    };

    const result = lineItems.map((li) => {
      const existingProcessId = processesByLineItem.get(li.id) ?? null;
      return {
        id: li.id,
        kind: li.kind,
        label: makeLabel(li),
        saleDate: toIso(li.saleDate),
        hasProcess: existingProcessId != null,
        existingProcessId,
      };
    });

    return NextResponse.json({ lineItems: result });
  } catch (err) {
    console.error("[GET /api/clients/:id/processable-line-items]", err);
    return NextResponse.json(
      { error: "Erro ao listar serviços processáveis do cliente" },
      { status: 500 }
    );
  }
}


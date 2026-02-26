import { db } from "@/db";
import { clients, processes } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createProcessWithTemplate } from "./repo";

const LLC_KIND = "LLC_PROCESS" as const;

/**
 * Garante que o cliente tenha um processo LLC (1 por cliente).
 * Idempotente: se já existir, não faz nada.
 */
export async function ensureLlcProcessForClient(clientId: string): Promise<void> {
  const [existing] = await db
    .select({ id: processes.id })
    .from(processes)
    .where(
      and(eq(processes.clientId, clientId), eq(processes.kind, LLC_KIND))
    )
    .limit(1);

  if (existing) return;

  await createProcessWithTemplate({
    clientId,
    kind: LLC_KIND,
  });
}

/**
 * Garante que todos os clientes (não deletados) tenham processo LLC.
 * Idempotente: cria apenas os que faltam.
 */
export async function ensureLlcProcessesForAllClients(): Promise<void> {
  const allClientIds = await db
    .select({ id: clients.id })
    .from(clients)
    .where(isNull(clients.deletedAt));

  const clientIdsWithLlc = await db
    .selectDistinct({ clientId: processes.clientId })
    .from(processes)
    .where(eq(processes.kind, LLC_KIND));

  const setWithLlc = new Set(
    clientIdsWithLlc.map((r) => r.clientId)
  );

  const missing = allClientIds.filter((r) => !setWithLlc.has(r.id));

  for (const { id } of missing) {
    await ensureLlcProcessForClient(id);
  }
}

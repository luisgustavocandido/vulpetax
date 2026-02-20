/**
 * Lógica reutilizável do sync Pós-Venda LLC via Google Sheets.
 * Usado por /api/sync/posvenda-llc (cron), /api/clients/sync/preview e /api/clients/sync/confirm.
 */

import { db } from "@/db";
import {
  clients,
  clientLineItems,
  clientPartners,
  importHistory,
  syncState,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { CommercialSdr, LineItemKind, PartnerRole } from "@/db/schema";
import { logAudit, diffChangedFields } from "@/lib/audit";
import { percentToBasisPoints } from "@/lib/clientSchemas";
import { resolveNameDuplicates } from "@/lib/clientDedupe";
import {
  parsePosVendaRow,
  getPosVendaDeterministicCustomerCode,
  type ParsedPosVendaRow,
} from "@/lib/sync/posVendaMapper";
import { getPosVendaSheetRows } from "@/lib/google/sheets";

const SYNC_KEY = "posvenda_llc";

const META_SYSTEM = {
  actor: "system",
  ip: null as string | null,
  userAgent: null as string | null,
};

/** Verifica e adquire lock (RUNNING). Retorna true se lock adquirido, false se já em execução. */
export async function acquirePosVendaSyncLock(): Promise<boolean> {
  const [existing] = await db
    .select({ lastRunStatus: syncState.lastRunStatus })
    .from(syncState)
    .where(eq(syncState.key, SYNC_KEY))
    .limit(1);
  if (existing?.lastRunStatus === "RUNNING") return false;
  await updateSyncState("RUNNING", null);
  return true;
}

/** Atualiza sync_state (exportado para uso em caso de erro no confirm) */
export async function updateSyncState(status: string, error: string | null) {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(syncState)
    .where(eq(syncState.key, SYNC_KEY))
    .limit(1);
  if (existing) {
    await db
      .update(syncState)
      .set({
        lastSyncedAt: now,
        lastRunStatus: status,
        lastRunError: error,
        updatedAt: now,
      })
      .where(eq(syncState.key, SYNC_KEY));
  } else {
    await db.insert(syncState).values({
      key: SYNC_KEY,
      lastSyncedAt: now,
      lastRunStatus: status,
      lastRunError: error,
      updatedAt: now,
    });
  }
}

/** Lê planilha Pós-Venda e retorna linhas normalizadas */
export async function fetchPosVendaRows(): Promise<{
  rows: Record<string, string>[];
}> {
  const { rows } = await getPosVendaSheetRows();
  return { rows };
}

/** Objeto canônico para comparação (incoming) */
function toComparable(parsed: ParsedPosVendaRow): string {
  const c = parsed.clientPatch;
  const clientSnap = {
    companyName: c.companyName,
    paymentDate: c.paymentDate ?? "",
    commercial: c.commercial ?? "",
    sdr: c.sdr ?? "",
    businessType: c.businessType ?? "",
    paymentMethod: c.paymentMethod ?? "",
    anonymous: c.anonymous,
    holding: c.holding,
    affiliate: c.affiliate,
    express: c.express,
    notes: c.notes ?? "",
  };
  const partnersSnap = [...parsed.partners]
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((p) => ({
      fullName: p.fullName,
      role: p.role,
      percentageBasisPoints: percentToBasisPoints(p.percentage),
      phone: p.phone ?? "",
    }));
  const itemsSnap = [...parsed.items]
    .sort((a, b) => `${a.kind}-${a.description}`.localeCompare(`${b.kind}-${b.description}`))
    .map((it) => ({
      kind: it.kind,
      description: it.description,
      valueCents: it.valueCents,
      meta: JSON.stringify(it.meta ?? {}),
    }));
  return JSON.stringify({ client: clientSnap, partners: partnersSnap, items: itemsSnap });
}

/** Objeto canônico para comparação (existente no banco) */
function existingToComparable(
  client: {
    companyName: string | null;
    paymentDate: string | null;
    commercial: string | null;
    sdr: string | null;
    businessType: string | null;
    paymentMethod: string | null;
    anonymous: boolean | null;
    holding: boolean | null;
    affiliate: boolean | null;
    express: boolean | null;
    notes: string | null;
  },
  partners: Array<{ fullName: string; role: string; percentageBasisPoints: number; phone: string | null }>,
  items: Array<{ kind: string; description: string; valueCents: number; meta: unknown }>
): string {
  const clientSnap = {
    companyName: client.companyName ?? "",
    paymentDate: client.paymentDate ?? "",
    commercial: client.commercial ?? "",
    sdr: client.sdr ?? "",
    businessType: client.businessType ?? "",
    paymentMethod: client.paymentMethod ?? "",
    anonymous: client.anonymous ?? false,
    holding: client.holding ?? false,
    affiliate: client.affiliate ?? false,
    express: client.express ?? false,
    notes: client.notes ?? "",
  };
  const partnersSnap = [...partners]
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((p) => ({
      fullName: p.fullName,
      role: p.role,
      percentageBasisPoints: p.percentageBasisPoints,
      phone: p.phone ?? "",
    }));
  const itemsSnap = [...items]
    .sort((a, b) => `${a.kind}-${a.description}`.localeCompare(`${b.kind}-${b.description}`))
    .map((it) => ({
      kind: it.kind,
      description: it.description,
      valueCents: it.valueCents,
      meta: JSON.stringify(it.meta ?? {}),
    }));
  return JSON.stringify({ client: clientSnap, partners: partnersSnap, items: itemsSnap });
}

export type PosVendaPreview = {
  fetchedRows: number;
  validRows: number;
  invalidRows: number;
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkip: number;
  errors: { row: number; field?: string; message: string }[];
  sample: Array<{
    row: number;
    companyName: string;
    customerCode: string | null;
    action: "create" | "update" | "skip";
  }>;
};

/** Constrói preview sem gravar */
export async function buildPosVendaPreview(
  rows: Record<string, string>[]
): Promise<PosVendaPreview> {
  const errors: { row: number; field?: string; message: string }[] = [];
  const validParsed: { rowIndex: number; parsed: ParsedPosVendaRow }[] = [];
  let wouldCreate = 0;
  let wouldUpdate = 0;
  let wouldSkip = 0;
  const sample: PosVendaPreview["sample"] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2;
    const parsed = parsePosVendaRow(rows[i]!);
    if (!parsed) {
      errors.push({ row: rowIndex, message: "Empresa ausente" });
      continue;
    }
    validParsed.push({ rowIndex, parsed });
  }

  for (const { rowIndex, parsed } of validParsed) {
    const { clientPatch } = parsed;
    const companyNameNormalized = clientPatch.companyNameNormalized;
    const customerCodeFromSheet = clientPatch.customerCode;

    let existingClient:
      | {
          id: string;
          companyName: string | null;
          paymentDate: string | null;
          commercial: string | null;
          sdr: string | null;
          businessType: string | null;
          paymentMethod: string | null;
          anonymous: boolean | null;
          holding: boolean | null;
          affiliate: boolean | null;
          express: boolean | null;
          notes: string | null;
        }
      | null = null;

    if (customerCodeFromSheet) {
      const [found] = await db
        .select({
          id: clients.id,
          companyName: clients.companyName,
          paymentDate: clients.paymentDate,
          commercial: clients.commercial,
          sdr: clients.sdr,
          businessType: clients.businessType,
          paymentMethod: clients.paymentMethod,
          anonymous: clients.anonymous,
          holding: clients.holding,
          affiliate: clients.affiliate,
          express: clients.express,
          notes: clients.notes,
        })
        .from(clients)
        .where(
          and(
            eq(clients.customerCode, customerCodeFromSheet),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);
      if (found) existingClient = found;
    }

    if (!existingClient) {
      const { findBestClientByName } = await import("@/lib/clientDedupe");
      const best = await findBestClientByName(db, companyNameNormalized);
      if (best) {
        const [c] = await db
          .select({
            id: clients.id,
            companyName: clients.companyName,
            paymentDate: clients.paymentDate,
            commercial: clients.commercial,
            sdr: clients.sdr,
            businessType: clients.businessType,
            paymentMethod: clients.paymentMethod,
            anonymous: clients.anonymous,
            holding: clients.holding,
            affiliate: clients.affiliate,
            express: clients.express,
            notes: clients.notes,
          })
          .from(clients)
          .where(eq(clients.id, best.id))
          .limit(1);
        if (c) existingClient = c;
      }
    }

    let action: "create" | "update" | "skip" = "create";
    if (existingClient) {
      const partnersRows = await db
        .select({
          fullName: clientPartners.fullName,
          role: clientPartners.role,
          percentageBasisPoints: clientPartners.percentageBasisPoints,
          phone: clientPartners.phone,
        })
        .from(clientPartners)
        .where(eq(clientPartners.clientId, existingClient.id));
      const itemsRows = await db
        .select({
          kind: clientLineItems.kind,
          description: clientLineItems.description,
          valueCents: clientLineItems.valueCents,
          meta: clientLineItems.meta,
        })
        .from(clientLineItems)
        .where(eq(clientLineItems.clientId, existingClient.id));

      const incoming = toComparable(parsed);
      const existing = existingToComparable(
        existingClient,
        partnersRows,
        itemsRows
      );
      if (incoming === existing) {
        action = "skip";
        wouldSkip++;
      } else {
        action = "update";
        wouldUpdate++;
      }
    } else {
      wouldCreate++;
    }

    if (sample.length < 3) {
      const displayCode =
        customerCodeFromSheet ??
        getPosVendaDeterministicCustomerCode(companyNameNormalized);
      sample.push({
        row: rowIndex,
        companyName: clientPatch.companyName,
        customerCode: displayCode,
        action,
      });
    }
  }

  return {
    fetchedRows: rows.length,
    validRows: validParsed.length,
    invalidRows: errors.length,
    wouldCreate,
    wouldUpdate,
    wouldSkip,
    errors: errors.slice(0, 10),
    sample,
  };
}

export type PosVendaSyncResult = {
  rowsTotal: number;
  rowsImported: number;
  rowsErrors: number;
  status: "ok" | "error";
  error?: string;
  errors: { row: number; message: string }[];
  importHistoryId?: string;
};

/** Aplica sync gravando no banco */
export async function applyPosVendaSync(
  rows: Record<string, string>[]
): Promise<PosVendaSyncResult> {
  let rowsImported = 0;
  const errors: { row: number; message: string }[] = [];
  const startTime = Date.now();
  const logInterval = Math.max(1, Math.floor(rows.length / 10)); // Log a cada 10% do progresso

  console.log(`[applyPosVendaSync] Iniciando processamento de ${rows.length} linhas`);

  for (let i = 0; i < rows.length; i++) {
    if (i % logInterval === 0 || i === rows.length - 1) {
      const elapsed = Date.now() - startTime;
      const progress = ((i + 1) / rows.length * 100).toFixed(1);
      console.log(`[applyPosVendaSync] Progresso: ${i + 1}/${rows.length} (${progress}%) - ${elapsed}ms - Importadas: ${rowsImported}, Erros: ${errors.length}`);
    }
    const rowIndex = i + 2;
    const row = rows[i]!;
    try {
      const parsed = parsePosVendaRow(row);
      if (!parsed) {
        errors.push({ row: rowIndex, message: "Empresa ausente" });
        continue;
      }

      const { clientPatch, partners, items } = parsed;
      const companyNameNormalized = clientPatch.companyNameNormalized;
      const customerCodeFromSheet = clientPatch.customerCode;
      const now = new Date();

      await db.transaction(async (tx) => {
        let clientId: string;
        let existingClient: typeof clients.$inferSelect | undefined;

        try {
          if (customerCodeFromSheet) {
            const [found] = await tx
              .select()
              .from(clients)
              .where(
                and(
                  eq(clients.customerCode, customerCodeFromSheet),
                  isNull(clients.deletedAt)
                )
              )
              .limit(1);
            existingClient = found;
          }

          if (!existingClient) {
            const winnerId = await resolveNameDuplicates(
              tx,
              companyNameNormalized,
              META_SYSTEM
            );
            if (winnerId) {
              const [w] = await tx
                .select()
                .from(clients)
                .where(eq(clients.id, winnerId))
                .limit(1);
              existingClient = w ?? undefined;
            }
          }
        } catch (txErr) {
          console.error(`[applyPosVendaSync] Erro ao buscar cliente existente (linha ${rowIndex}):`, txErr);
          throw txErr;
        }

        if (existingClient) {
          clientId = existingClient.id;
          const oldRec = existingClient as Record<string, unknown>;
          await tx
            .update(clients)
            .set({
              companyName: clientPatch.companyName,
              companyNameNormalized,
              paymentDate: clientPatch.paymentDate,
              commercial: clientPatch.commercial as CommercialSdr | null,
              sdr: clientPatch.sdr as CommercialSdr | null,
              businessType: clientPatch.businessType,
              paymentMethod: clientPatch.paymentMethod,
              anonymous: clientPatch.anonymous,
              holding: clientPatch.holding,
              affiliate: clientPatch.affiliate,
              express: clientPatch.express,
              notes: clientPatch.notes,
              updatedAt: now,
            })
            .where(eq(clients.id, clientId));
          const [updated] = await tx
            .select()
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);
          const { oldValues, newValues } = diffChangedFields(
            oldRec,
            updated as Record<string, unknown>
          );
          if (oldValues !== null || newValues !== null) {
            await logAudit(tx, {
              action: "update",
              entity: "clients",
              entityId: clientId,
              oldValues,
              newValues,
              meta: META_SYSTEM,
            });
          }
        } else {
          const customerCode =
            customerCodeFromSheet ||
            getPosVendaDeterministicCustomerCode(companyNameNormalized);
          const [inserted] = await tx
            .insert(clients)
            .values({
              companyName: clientPatch.companyName,
              companyNameNormalized,
              customerCode,
              paymentDate: clientPatch.paymentDate,
              commercial: clientPatch.commercial as CommercialSdr | null,
              sdr: clientPatch.sdr as CommercialSdr | null,
              businessType: clientPatch.businessType,
              paymentMethod: clientPatch.paymentMethod,
              anonymous: clientPatch.anonymous,
              holding: clientPatch.holding,
              affiliate: clientPatch.affiliate,
              express: clientPatch.express,
              notes: clientPatch.notes,
            })
            .returning({ id: clients.id });
          if (!inserted) throw new Error("Insert client failed");
          clientId = inserted.id;
          const [full] = await tx
            .select()
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);
          const { oldValues, newValues } = diffChangedFields(
            null,
            full as Record<string, unknown>
          );
          await logAudit(tx, {
            action: "create",
            entity: "clients",
            entityId: clientId,
            oldValues,
            newValues,
            meta: META_SYSTEM,
          });
        }

        if (items.length > 0) {
          await tx.delete(clientLineItems).where(eq(clientLineItems.clientId, clientId));
          for (const it of items) {
            await tx.insert(clientLineItems).values({
              clientId,
              kind: it.kind as LineItemKind,
              description: it.description,
              valueCents: it.valueCents,
              meta: it.meta ?? null,
              billingPeriod: it.kind === "Endereco" ? "Mensal" : null,
              expirationDate: null,
            });
          }
        }

        if (partners.length > 0) {
          await tx.delete(clientPartners).where(eq(clientPartners.clientId, clientId));
          for (const p of partners) {
            await tx.insert(clientPartners).values({
              clientId,
              fullName: p.fullName,
              role: p.role as PartnerRole,
              percentageBasisPoints: percentToBasisPoints(p.percentage),
              phone: p.phone,
            });
          }
        }
      });

      rowsImported++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorDetails = err instanceof Error ? err.stack : undefined;
      console.error(`[applyPosVendaSync] Erro ao processar linha ${rowIndex}:`, msg, errorDetails);
      errors.push({ row: rowIndex, message: msg });
      
      // Se houver muitos erros consecutivos, pode indicar um problema maior
      if (errors.length > 10 && errors.length % 10 === 0) {
        console.warn(`[applyPosVendaSync] Muitos erros acumulados: ${errors.length} erros em ${i + 1} linhas processadas`);
      }
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`[applyPosVendaSync] Processamento concluído: ${rowsImported} importadas, ${errors.length} erros em ${totalTime}ms`);

  const [imported] = await db
    .insert(importHistory)
    .values({
      filename: "google_sheets:posvenda_llc",
      rowsTotal: rows.length,
      rowsImported,
      rowsErrors: errors.length,
      errorsJson: errors.slice(0, 100),
      actor: "system",
    })
    .returning({ id: importHistory.id });

  await updateSyncState("ok", null);
  return {
    rowsTotal: rows.length,
    rowsImported,
    rowsErrors: errors.length,
    status: "ok",
    errors: errors.slice(0, 100),
    importHistoryId: imported?.id,
  };
}

/** Função principal para cron (sync direto) */
export async function runPosVendaSync(options?: {
  dryRun?: boolean;
}): Promise<PosVendaSyncResult> {
  const dryRun = options?.dryRun ?? false;

  try {
    const { rows } = await fetchPosVendaRows();

    if (rows.length === 0) {
      await updateSyncState("ok", null);
      return {
        rowsTotal: 0,
        rowsImported: 0,
        rowsErrors: 0,
        status: "ok",
        errors: [],
      };
    }

    if (dryRun) {
      const preview = await buildPosVendaPreview(rows);
      const errors = preview.errors.map((e) => ({ row: e.row, message: e.message }));
      return {
        rowsTotal: rows.length,
        rowsImported: preview.validRows,
        rowsErrors: preview.invalidRows,
        status: "ok",
        errors,
      };
    }

    return applyPosVendaSync(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSyncState("error", msg);
    return {
      rowsTotal: 0,
      rowsImported: 0,
      rowsErrors: 0,
      status: "error",
      error: msg,
      errors: [],
    };
  }
}

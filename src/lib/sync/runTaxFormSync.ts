/**
 * Lógica reutilizável do sync TAX Form via Google Sheets.
 * Usado por /api/sync/tax-form (cron), /api/tax/sync (UI), /api/tax/sync/preview e /api/tax/sync/confirm.
 */

import { db } from "@/db";
import {
  clients,
  clientTaxProfile,
  clientTaxOwners,
  importHistory,
  syncState,
} from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { logAudit, diffChangedFields } from "@/lib/audit";
import { resolveNameDuplicates, findBestClientByName } from "@/lib/clientDedupe";
import { parseTaxFormRow, getDeterministicCustomerCode } from "@/lib/sync/taxFormMapper";
import type { ParsedTaxFormRow } from "@/lib/sync/taxFormMapper";
import { getSheetRows } from "@/lib/google/sheets";

const SYNC_KEY = "tax_form_2026";
const SOURCE = "google_sheets_tax_form";

const META_SYSTEM = {
  actor: "system",
  ip: null as string | null,
  userAgent: null as string | null,
};

function parseDate(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  const ddmmyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (ddmmyy) {
    const [, day, month, year] = ddmmyy;
    return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Verifica e adquire lock (RUNNING). Retorna true se lock adquirido, false se já em execução. */
export async function acquireTaxFormSyncLock(): Promise<boolean> {
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

/** Lê planilha e retorna linhas normalizadas */
export async function fetchTaxFormRows(): Promise<{ rows: Record<string, string>[] }> {
  const { rows } = await getSheetRows();
  return { rows };
}

/** Objeto canônico para comparação */
function toComparable(parsed: ParsedTaxFormRow): string {
  const profile = { ...parsed.taxProfile };
  if (profile.formationDate && typeof profile.formationDate === "string") {
    profile.formationDate = parseDate(profile.formationDate) ?? profile.formationDate;
  }
  const clientSnap = {
    companyName: parsed.client.companyName,
    notes: parsed.client.notes ?? "",
  };
  const ownersSnap = [...parsed.owners].sort((a, b) => a.ownerIndex - b.ownerIndex).map((o) => ({
    ownerIndex: o.ownerIndex,
    email: o.email ?? "",
    fullLegalName: o.fullLegalName ?? "",
    residenceCountry: o.residenceCountry ?? "",
    citizenshipCountry: o.citizenshipCountry ?? "",
    homeAddressDifferent: o.homeAddressDifferent ?? false,
    usTaxId: o.usTaxId ?? "",
    foreignTaxId: o.foreignTaxId ?? "",
  }));
  return JSON.stringify({ client: clientSnap, profile, owners: ownersSnap });
}

function existingToComparable(
  client: { companyName: string | null; notes: string | null },
  profile: Record<string, unknown> | null,
  owners: Array<Record<string, unknown>>
): string {
  const clientSnap = {
    companyName: client.companyName ?? "",
    notes: client.notes ?? "",
  };
  const profileSnap = profile
    ? Object.fromEntries(
        Object.entries(profile).filter(
          (k) =>
            !["id", "clientId", "createdAt", "updatedAt", "declarationAcceptedAt"].includes(k[0])
        )
      )
    : {};
  const ownersSnap = owners
    .sort((a, b) => (a.ownerIndex as number) - (b.ownerIndex as number))
    .map((o) => ({
      ownerIndex: o.ownerIndex,
      email: o.email ?? "",
      fullLegalName: o.fullLegalName ?? "",
      residenceCountry: o.residenceCountry ?? "",
      citizenshipCountry: o.citizenshipCountry ?? "",
      homeAddressDifferent: o.homeAddressDifferent ?? false,
      usTaxId: o.usTaxId ?? "",
      foreignTaxId: o.foreignTaxId ?? "",
    }));
  return JSON.stringify({ client: clientSnap, profile: profileSnap, owners: ownersSnap });
}

export type TaxFormPreview = {
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
export async function buildTaxFormPreview(
  rows: Record<string, string>[]
): Promise<TaxFormPreview> {
  const errors: { row: number; field?: string; message: string }[] = [];
  const validParsed: { rowIndex: number; parsed: ParsedTaxFormRow }[] = [];
  let wouldCreate = 0;
  let wouldUpdate = 0;
  let wouldSkip = 0;
  const sample: TaxFormPreview["sample"] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2;
    const parsed = parseTaxFormRow(rows[i]!);
    if (!parsed) {
      errors.push({ row: rowIndex, message: "Nome da empresa ausente" });
      continue;
    }
    validParsed.push({ rowIndex, parsed });
  }

  for (const { rowIndex, parsed } of validParsed) {
    const { client: clientData } = parsed;
    const companyNameNormalized = clientData.companyNameNormalized;
    const customerCodeFromSheet = clientData.customerCode;

    let existingClient: { id: string; companyName: string | null; notes: string | null } | null =
      null;

    if (customerCodeFromSheet) {
      const [found] = await db
        .select({ id: clients.id, companyName: clients.companyName, notes: clients.notes })
        .from(clients)
        .where(
          and(eq(clients.customerCode, customerCodeFromSheet), isNull(clients.deletedAt))
        )
        .limit(1);
      if (found) existingClient = found;
    }
    if (!existingClient) {
      const best = await findBestClientByName(db, companyNameNormalized);
      if (best) existingClient = { id: best.id, companyName: best.companyName, notes: null };
    }

    let action: "create" | "update" | "skip" = "create";
    if (existingClient) {
      const [profile] = await db
        .select()
        .from(clientTaxProfile)
        .where(eq(clientTaxProfile.clientId, existingClient.id))
        .limit(1);
      const ownersRows = await db
        .select()
        .from(clientTaxOwners)
        .where(eq(clientTaxOwners.clientId, existingClient.id))
        .orderBy(asc(clientTaxOwners.ownerIndex));

      const incoming = toComparable(parsed);
      const existing = existingToComparable(
        existingClient,
        profile as Record<string, unknown> | null,
        ownersRows as Array<Record<string, unknown>>
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
        customerCodeFromSheet ?? getDeterministicCustomerCode(companyNameNormalized);
      sample.push({
        row: rowIndex,
        companyName: clientData.companyName,
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

export type TaxFormSyncResult = {
  rowsTotal: number;
  rowsImported: number;
  rowsErrors: number;
  status: "ok" | "error";
  error?: string;
  errors: { row: number; message: string }[];
  importHistoryId?: string;
};

/** Aplica sync gravando no banco */
export async function applyTaxFormSync(
  rows: Record<string, string>[]
): Promise<TaxFormSyncResult> {
  let rowsImported = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2;
    const row = rows[i]!;
    try {
      const parsed = parseTaxFormRow(row);
      if (!parsed) {
        errors.push({ row: rowIndex, message: "Nome da empresa ausente" });
        continue;
      }

      const { client: clientData, taxProfile: profileData, owners } = parsed;
      const companyNameNormalized = clientData.companyNameNormalized;
      const customerCodeFromSheet = clientData.customerCode;
      const now = new Date();

      await db.transaction(async (tx) => {
        let clientId: string;
        let existingClient: typeof clients.$inferSelect | undefined;

        if (customerCodeFromSheet) {
          const [found] = await tx
            .select()
            .from(clients)
            .where(
              and(eq(clients.customerCode, customerCodeFromSheet), isNull(clients.deletedAt))
            )
            .limit(1);
          existingClient = found;
        }

        if (!existingClient) {
          const winnerId = await resolveNameDuplicates(tx, companyNameNormalized, META_SYSTEM);
          if (winnerId) {
            const [w] = await tx.select().from(clients).where(eq(clients.id, winnerId)).limit(1);
            existingClient = w ?? undefined;
          }
        }

        if (existingClient) {
          clientId = existingClient.id;
          const oldRec = existingClient as Record<string, unknown>;
          await tx
            .update(clients)
            .set({
              companyName: clientData.companyName,
              companyNameNormalized,
              notes: clientData.notes ?? existingClient.notes,
              taxFormSource: SOURCE,
              taxFormSubmittedAt: now,
              updatedAt: now,
            })
            .where(eq(clients.id, clientId));
          const [updated] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
          const { oldValues, newValues } = diffChangedFields(oldRec, updated as Record<string, unknown>);
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
            customerCodeFromSheet || getDeterministicCustomerCode(companyNameNormalized);
          const [inserted] = await tx
            .insert(clients)
            .values({
              companyName: clientData.companyName,
              companyNameNormalized,
              customerCode,
              notes: clientData.notes,
              taxFormSource: SOURCE,
              taxFormSubmittedAt: now,
            })
            .returning({ id: clients.id });
          if (!inserted) throw new Error("Insert client failed");
          clientId = inserted.id;
          const [full] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
          const { oldValues, newValues } = diffChangedFields(null, full as Record<string, unknown>);
          await logAudit(tx, {
            action: "create",
            entity: "clients",
            entityId: clientId,
            oldValues,
            newValues,
            meta: META_SYSTEM,
          });
        }

        const profileValues: Record<string, unknown> = {
          clientId,
          updatedAt: now,
        };
        const profileFields = [
          "llcName",
          "formationDate",
          "activitiesDescription",
          "einNumber",
          "llcUsAddressLine1",
          "llcUsAddressLine2",
          "llcUsCity",
          "llcUsState",
          "llcUsZip",
          "ownerEmail",
          "ownerFullLegalName",
          "ownerResidenceCountry",
          "ownerCitizenshipCountry",
          "ownerHomeAddressDifferent",
          "ownerUsTaxId",
          "ownerForeignTaxId",
          "llcFormationCostUsdCents",
          "hasAdditionalOwners",
          "totalAssetsUsdCents",
          "hasUsBankAccounts",
          "aggregateBalanceOver10k",
          "totalWithdrawalsUsdCents",
          "totalTransferredToLlcUsdCents",
          "totalWithdrawnFromLlcUsdCents",
          "personalExpensesPaidByCompanyUsdCents",
          "businessExpensesPaidPersonallyUsdCents",
          "passportCopiesProvided",
          "articlesOfOrganizationProvided",
          "einLetterProvided",
          "additionalDocumentsProvided",
          "additionalDocumentsNotes",
          "declarationAccepted",
        ];
        for (const f of profileFields) {
          const v = (profileData as Record<string, unknown>)[f];
          if (v !== undefined) profileValues[f] = v;
        }
        if (profileValues.formationDate && typeof profileValues.formationDate === "string") {
          profileValues.formationDate =
            parseDate(profileValues.formationDate as string) ?? profileValues.formationDate;
        }

        const [existingProfile] = await tx
          .select()
          .from(clientTaxProfile)
          .where(eq(clientTaxProfile.clientId, clientId))
          .limit(1);

        if (existingProfile) {
          const oldProfile = existingProfile as Record<string, unknown>;
          await tx
            .update(clientTaxProfile)
            .set(profileValues as typeof clientTaxProfile.$inferInsert)
            .where(eq(clientTaxProfile.clientId, clientId));
          const [updated] = await tx
            .select()
            .from(clientTaxProfile)
            .where(eq(clientTaxProfile.clientId, clientId))
            .limit(1);
          const { oldValues, newValues } = diffChangedFields(
            oldProfile,
            updated as Record<string, unknown>
          );
          if (oldValues !== null || newValues !== null) {
            await logAudit(tx, {
              action: "update",
              entity: "client_tax_profile",
              entityId: clientId,
              oldValues,
              newValues,
              meta: META_SYSTEM,
            });
          }
        } else {
          await tx
            .insert(clientTaxProfile)
            .values(profileValues as typeof clientTaxProfile.$inferInsert);
          const [inserted] = await tx
            .select()
            .from(clientTaxProfile)
            .where(eq(clientTaxProfile.clientId, clientId))
            .limit(1);
          if (inserted) {
            const { oldValues, newValues } = diffChangedFields(
              null,
              inserted as Record<string, unknown>
            );
            await logAudit(tx, {
              action: "create",
              entity: "client_tax_profile",
              entityId: clientId,
              oldValues,
              newValues,
              meta: META_SYSTEM,
            });
          }
        }

        await tx.delete(clientTaxOwners).where(eq(clientTaxOwners.clientId, clientId));
        for (const o of owners) {
          await tx.insert(clientTaxOwners).values({
            clientId,
            ownerIndex: o.ownerIndex,
            email: o.email ?? null,
            fullLegalName: o.fullLegalName ?? null,
            residenceCountry: o.residenceCountry ?? null,
            citizenshipCountry: o.citizenshipCountry ?? null,
            homeAddressDifferent: o.homeAddressDifferent ?? false,
            usTaxId: o.usTaxId ?? null,
            foreignTaxId: o.foreignTaxId ?? null,
          });
        }
      });

      rowsImported++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ row: rowIndex, message: msg });
    }
  }

  const [imported] = await db
    .insert(importHistory)
    .values({
      filename: "google_sheets:tax_form_2026",
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

/** Função principal para cron e UI antiga (sync direto) */
export async function runTaxFormSync(options?: {
  dryRun?: boolean;
}): Promise<TaxFormSyncResult> {
  const dryRun = options?.dryRun ?? false;

  try {
    const { rows } = await fetchTaxFormRows();

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
      const preview = await buildTaxFormPreview(rows);
      const errors = preview.errors.map((e) => ({ row: e.row, message: e.message }));
      return {
        rowsTotal: rows.length,
        rowsImported: preview.validRows,
        rowsErrors: preview.invalidRows,
        status: "ok",
        errors,
      };
    }

    return applyTaxFormSync(rows);
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

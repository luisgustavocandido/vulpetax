"use server";

import { eq } from "drizzle-orm";
import {
  db,
  llcs,
  taxFilings,
  reportableTransactions,
  type ReportableTransactionType,
} from "@/db";
import { generateId } from "@/lib/id";
import { logAudit } from "@/lib/audit";

export type CreateTaxFilingInput = {
  llcId: string;
  taxYear: number;
};

/** Retorna 15 de abril do ano seguinte ao taxYear; extensão 15/10. */
function federalDeadlineForYear(year: number): Date {
  return new Date(year + 1, 3, 15); // abril 15
}

/** Wyoming: aniversário da formação. Delaware: 1º de junho. Simplificado: uso 1/6 para DE e aniversário para WY. */
function stateDeadlineForYear(
  year: number,
  formationDate: Date,
  state: string
): Date {
  if (state === "DE") return new Date(year + 1, 5, 1); // 1 junho
  // WY, NM, FL, TX: annual report due on anniversary of formation
  const d = new Date(formationDate);
  d.setFullYear(year + 1);
  return d;
}

export async function createTaxFiling(input: CreateTaxFilingInput) {
  const now = new Date();
  const id = generateId();
  const [llc] = await db.select().from(llcs).where(eq(llcs.id, input.llcId));
  const formationDate = llc ? new Date(llc.formationDate) : new Date();
  const state = llc?.state ?? "WY";

  await db.insert(taxFilings).values({
    id,
    llcId: input.llcId,
    taxYear: input.taxYear,
    status: "draft",
    federalDeadline: federalDeadlineForYear(input.taxYear),
    stateDeadline: stateDeadlineForYear(input.taxYear, formationDate, state),
    filedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await logAudit({
    entityType: "tax_filings",
    entityId: id,
    action: "create",
    newValues: { llcId: input.llcId, taxYear: input.taxYear },
  });
  return { id };
}

export async function getTaxFilingsByLLC(llcId: string) {
  return db
    .select()
    .from(taxFilings)
    .where(eq(taxFilings.llcId, llcId))
    .orderBy(taxFilings.taxYear);
}

export async function getTaxFiling(id: string) {
  const [row] = await db
    .select()
    .from(taxFilings)
    .where(eq(taxFilings.id, id));
  return row ?? null;
}

export async function getTaxFilingWithTransactions(id: string) {
  const filing = await getTaxFiling(id);
  if (!filing) return null;
  const transactions = await db
    .select()
    .from(reportableTransactions)
    .where(eq(reportableTransactions.taxFilingId, id));
  return { ...filing, transactions };
}

export type AddTransactionInput = {
  taxFilingId: string;
  relatedPartyId?: string | null;
  transactionType: ReportableTransactionType;
  description?: string;
  amountUsd: number;
  amountOriginal?: number | null;
  currency?: string | null;
  fxRate?: number | null;
  fxSource?: string | null;
  transactionDate?: Date;
  documentationStatus?: string | null;
};

export async function addReportableTransaction(input: AddTransactionInput) {
  const now = new Date();
  const id = generateId();
  await db.insert(reportableTransactions).values({
    id,
    taxFilingId: input.taxFilingId,
    relatedPartyId: input.relatedPartyId ?? null,
    transactionType: input.transactionType,
    description: input.description ?? null,
    amountUsd: input.amountUsd,
    amountOriginal: input.amountOriginal ?? null,
    currency: input.currency ?? null,
    fxRate: input.fxRate ?? null,
    fxSource: input.fxSource ?? null,
    transactionDate: input.transactionDate ?? null,
    documentationStatus: input.documentationStatus ?? "pending",
    createdAt: now,
    updatedAt: now,
  });
  await logAudit({
    entityType: "reportable_transactions",
    entityId: id,
    action: "create",
    newValues: { ...input },
  });
  return { id };
}

export async function removeReportableTransaction(transactionId: string) {
  const [row] = await db
    .select()
    .from(reportableTransactions)
    .where(eq(reportableTransactions.id, transactionId));
  await db
    .delete(reportableTransactions)
    .where(eq(reportableTransactions.id, transactionId));
  if (row) {
    await logAudit({
      entityType: "reportable_transactions",
      entityId: transactionId,
      action: "delete",
      oldValues: {
        taxFilingId: row.taxFilingId,
        transactionType: row.transactionType,
        amountUsd: row.amountUsd,
      },
    });
  }
}

export async function updateTaxFilingStatus(
  id: string,
  status: "draft" | "ready_to_file" | "filed" | "extension"
) {
  const [prev] = await db.select().from(taxFilings).where(eq(taxFilings.id, id));
  const now = new Date();
  await db
    .update(taxFilings)
    .set({ status, updatedAt: now, ...(status === "filed" ? { filedAt: now } : {}) })
    .where(eq(taxFilings.id, id));
  if (prev) {
    await logAudit({
      entityType: "tax_filings",
      entityId: id,
      action: "update",
      oldValues: { status: prev.status },
      newValues: { status },
    });
  }
}

export type UpdateTaxFilingFormDataInput = {
  totalAssetsYearEndUsd?: number | null;
  hasUsBankAccounts?: boolean | null;
  aggregateBalanceOver10k?: boolean | null;
};

export async function updateTaxFilingFormData(
  id: string,
  input: UpdateTaxFilingFormDataInput
) {
  const now = new Date();
  await db
    .update(taxFilings)
    .set({
      totalAssetsYearEndUsd: input.totalAssetsYearEndUsd ?? null,
      hasUsBankAccounts: input.hasUsBankAccounts ?? null,
      aggregateBalanceOver10k: input.aggregateBalanceOver10k ?? null,
      updatedAt: now,
    })
    .where(eq(taxFilings.id, id));
  await logAudit({
    entityType: "tax_filings",
    entityId: id,
    action: "update",
    newValues: input,
  });
}

export async function acceptDeclaration(id: string) {
  const { getCurrentUserId } = await import("@/lib/audit");
  const userId = await getCurrentUserId();
  const now = new Date();
  await db
    .update(taxFilings)
    .set({
      declarationAcceptedAt: now,
      declarationAcceptedBy: userId,
      updatedAt: now,
    })
    .where(eq(taxFilings.id, id));
  await logAudit({
    entityType: "tax_filings",
    entityId: id,
    action: "update",
    newValues: { declarationAcceptedAt: now.toISOString(), declarationAcceptedBy: userId },
  });
}

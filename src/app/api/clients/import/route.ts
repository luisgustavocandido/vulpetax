import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  clients,
  clientLineItems,
  clientPartners,
  importHistory,
  type ClientInsert,
  type CommercialSdr,
  type LineItemKind,
  type PartnerRole,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRequestMeta } from "@/lib/requestMeta";
import { logAudit, diffChangedFields } from "@/lib/audit";
import { percentToBasisPoints } from "@/lib/clientSchemas";
import { normalizeCompanyName, resolveNameDuplicates } from "@/lib/clientDedupe";
import {
  detectDelimiter,
  detectEncoding,
  normalizeHeader,
  parseCsv,
  mapHeadersFromCsv,
  parseRow,
  resetEmptyColCounter,
} from "@/lib/importCsv";
import { logSecurityEvent } from "@/lib/logger";

const BATCH_SIZE = 100;
const MAX_ERRORS_DISPLAY = 100;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 20_000;

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type deve ser multipart/form-data" },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const meta = getRequestMeta(request);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Arquivo CSV é obrigatório" }, { status: 400 });
  }
  const filename = file.name;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Erro ao ler arquivo" }, { status: 400 });
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  const encoding = detectEncoding(buffer);
  const content = buffer.toString(encoding === "utf-8-bom" ? "utf-8" : "utf-8").replace(/^\uFEFF/, "");
  const firstLines = content.split(/\r?\n/).slice(0, 5).join("\n");
  const delimiter = detectDelimiter(firstLines);

  const rows = parseCsv(content, delimiter);
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV vazio ou sem dados" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS + 1) {
    return NextResponse.json(
      { error: `CSV excede ${MAX_ROWS} linhas de dados` },
      { status: 413 }
    );
  }

  resetEmptyColCounter();
  const rawHeaders = rows[0]!;
  const normalizedHeaders = rawHeaders.map((h) => normalizeHeader(h));
  const headerMap = mapHeadersFromCsv(normalizedHeaders);

  const dataRows = rows.slice(1);
  const errors: { row: number; field: string; message: string }[] = [];
  const validSamples: { clientPatch: Record<string, unknown>; partners: unknown[]; items: unknown[] }[] = [];

  for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
    const batch = dataRows.slice(batchStart, batchStart + BATCH_SIZE);
    for (let i = 0; i < batch.length; i++) {
      const rowIndex = batchStart + i + 2;
      const rawRow = batch[i]!;
      const row: Record<string, string> = {};
      normalizedHeaders.forEach((h, j) => {
        row[h] = rawRow[j] ?? "";
      });

      const parsed = parseRow(rowIndex, row, headerMap);
      if (parsed.errors.length > 0) {
        errors.push(...parsed.errors);
        continue;
      }

      const { clientPatch, partners, items } = parsed;

      if (dryRun) {
        if (validSamples.length < 3) {
          validSamples.push({
            clientPatch: { ...clientPatch, customerCode: "(gerado na importação)" },
            partners,
            items,
          });
        }
        continue;
      }

      const companyNameNormalized = normalizeCompanyName(clientPatch.companyName);
      const customerCode = `CLI-${randomBytes(4).toString("hex").toUpperCase()}`;

      try {
        await db.transaction(async (tx) => {
          const winnerId = await resolveNameDuplicates(tx, companyNameNormalized, meta);

          if (winnerId) {
            const [existing] = await tx.select().from(clients).where(eq(clients.id, winnerId)).limit(1);
            if (!existing || existing.deletedAt) throw new Error("Winner not found");

            await tx
              .update(clients)
              .set({
                companyName: clientPatch.companyName,
                companyNameNormalized,
                paymentDate: clientPatch.paymentDate,
                commercial: (clientPatch.commercial as CommercialSdr) ?? null,
                sdr: (clientPatch.sdr as CommercialSdr) ?? null,
                businessType: clientPatch.businessType,
                paymentMethod: clientPatch.paymentMethod,
                notes: clientPatch.notes,
                anonymous: clientPatch.anonymous,
                holding: clientPatch.holding,
                affiliate: clientPatch.affiliate,
                express: clientPatch.express,
                updatedAt: new Date(),
              })
              .where(eq(clients.id, winnerId));

            const [updated] = await tx.select().from(clients).where(eq(clients.id, winnerId)).limit(1);
            const { oldValues, newValues } = diffChangedFields(
              existing as Record<string, unknown>,
              updated as Record<string, unknown>
            );
            if (oldValues !== null || newValues !== null) {
              await logAudit(tx, {
                action: "update",
                entity: "clients",
                entityId: winnerId,
                oldValues,
                newValues,
                meta,
              });
            }

            for (const p of partners) {
              await tx.insert(clientPartners).values({
                clientId: winnerId,
                fullName: p.fullName,
                role: p.role as PartnerRole,
                percentageBasisPoints: percentToBasisPoints(p.percentage),
                phone: p.phone,
              });
            }
            for (const it of items) {
              await tx.insert(clientLineItems).values({
                clientId: winnerId,
                kind: it.kind as LineItemKind,
                description: it.description,
                valueCents: it.valueCents,
              billingPeriod: null,
              expirationDate: null,
              });
            }
            return;
          }

          const clientValues: ClientInsert = {
            companyName: clientPatch.companyName,
            companyNameNormalized,
            customerCode,
            paymentDate: clientPatch.paymentDate,
            commercial: (clientPatch.commercial as CommercialSdr) ?? null,
            sdr: (clientPatch.sdr as CommercialSdr) ?? null,
            businessType: clientPatch.businessType,
            paymentMethod: clientPatch.paymentMethod,
            notes: clientPatch.notes,
            anonymous: clientPatch.anonymous,
            holding: clientPatch.holding,
            affiliate: clientPatch.affiliate,
            express: clientPatch.express,
          };

          const [inserted] = await tx.insert(clients).values(clientValues).returning({ id: clients.id });
          if (!inserted) throw new Error("Insert failed");
          const clientId = inserted.id;

          const [full] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
          const { oldValues, newValues } = diffChangedFields(null, full as Record<string, unknown>);
          await logAudit(tx, {
            action: "create",
            entity: "clients",
            entityId: clientId,
            oldValues,
            newValues,
            meta,
          });

          for (const p of partners) {
            await tx.insert(clientPartners).values({
              clientId,
              fullName: p.fullName,
              role: p.role as PartnerRole,
              percentageBasisPoints: percentToBasisPoints(p.percentage),
              phone: p.phone,
            });
          }
          for (const it of items) {
            await tx.insert(clientLineItems).values({
              clientId,
              kind: it.kind as LineItemKind,
              description: it.description,
              valueCents: it.valueCents,
              billingPeriod: null,
              expirationDate: null,
            });
          }
        });
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
        const msg =
          code === "23505"
            ? "Código do cliente já existe (duplicado)"
            : err instanceof Error
              ? err.message
              : "Erro ao processar linha";
        errors.push({ row: rowIndex, field: "general", message: msg });
      }
    }
  }

  if (dryRun) {
    const invalidRows = new Set(errors.map((e) => e.row));
    const rowsValid = dataRows.length - invalidRows.size;
    const rowsInvalid = invalidRows.size;
    return NextResponse.json({
      dryRun: true,
      rowsTotal: dataRows.length,
      rowsValid,
      rowsInvalid,
      sample: validSamples,
      errors: errors.slice(0, MAX_ERRORS_DISPLAY),
    });
  }

  const invalidRows = new Set(errors.map((e) => e.row));
  const imported = dataRows.length - invalidRows.size;
  if (errors.length > 0) {
    logSecurityEvent("import_failed", {
      filename,
      rowsErrors: errors.length,
      rowsTotal: dataRows.length,
      ip: meta.ip,
    });
  }
  await db.insert(importHistory).values({
    filename,
    rowsTotal: dataRows.length,
    rowsImported: imported,
    rowsErrors: errors.length,
    errorsJson: errors.slice(0, MAX_ERRORS_DISPLAY),
    actor: meta.actor,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({
    rowsTotal: dataRows.length,
    rowsImported: imported,
    rowsErrors: errors.length,
    errors: errors.slice(0, MAX_ERRORS_DISPLAY),
  });
}

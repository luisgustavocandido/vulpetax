import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { sql, and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  clientLineItems,
  clientPartners,
  type ClientInsert,
  type CommercialSdr,
  type LineItemKind,
  type PartnerRole,
} from "@/db/schema";
import { isNull } from "drizzle-orm";
import { getRequestMeta } from "@/lib/requestMeta";
import { logAudit, diffChangedFields } from "@/lib/audit";
import {
  createClientSchema,
  percentToBasisPoints,
} from "@/lib/clientSchemas";
import {
  normalizeCompanyName,
  resolveNameDuplicates,
} from "@/lib/clientDedupe";

const COMMERCIAL_VALUES = ["João", "Pablo", "Gabriel", "Gustavo"] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const offset = (page - 1) * limit;

    const q = searchParams.get("q")?.trim();
    const commercial = searchParams.get("commercial")?.trim();
    const sdr = searchParams.get("sdr")?.trim();
    const paymentDateFrom = searchParams.get("paymentDateFrom")?.trim();
    const paymentDateTo = searchParams.get("paymentDateTo")?.trim();
    const paymentMethod = searchParams.get("paymentMethod")?.trim();
    const anonymous = searchParams.get("anonymous");
    const holding = searchParams.get("holding");
    const affiliate = searchParams.get("affiliate");
    const express = searchParams.get("express");
    const hasPartners = searchParams.get("hasPartners");
    const orderPaymentDate = searchParams.get("orderPaymentDate")?.toLowerCase();

    const conditions = [isNull(clients.deletedAt)];

    if (q) {
      const term = `%${q}%`;
      conditions.push(
        sql`(${clients.companyName} ilike ${term} or ${clients.customerCode} ilike ${term})`
      );
    }
    if (commercial && COMMERCIAL_VALUES.includes(commercial as (typeof COMMERCIAL_VALUES)[number])) {
      conditions.push(eq(clients.commercial, commercial as (typeof COMMERCIAL_VALUES)[number]));
    }
    if (sdr && COMMERCIAL_VALUES.includes(sdr as (typeof COMMERCIAL_VALUES)[number])) {
      conditions.push(eq(clients.sdr, sdr as (typeof COMMERCIAL_VALUES)[number]));
    }
    if (paymentDateFrom) {
      conditions.push(sql`${clients.paymentDate} >= ${paymentDateFrom}::date`);
    }
    if (paymentDateTo) {
      conditions.push(sql`${clients.paymentDate} <= ${paymentDateTo}::date`);
    }
    if (paymentMethod) {
      conditions.push(eq(clients.paymentMethod, paymentMethod));
    }
    if (anonymous === "true") conditions.push(eq(clients.anonymous, true));
    else if (anonymous === "false") conditions.push(eq(clients.anonymous, false));
    if (holding === "true") conditions.push(eq(clients.holding, true));
    else if (holding === "false") conditions.push(eq(clients.holding, false));
    if (affiliate === "true") conditions.push(eq(clients.affiliate, true));
    else if (affiliate === "false") conditions.push(eq(clients.affiliate, false));
    if (express === "true") conditions.push(eq(clients.express, true));
    else if (express === "false") conditions.push(eq(clients.express, false));
    if (hasPartners === "true") {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM client_partners cp WHERE cp.client_id = ${clients.id})`
      );
    } else if (hasPartners === "false") {
      conditions.push(
        sql`NOT EXISTS (SELECT 1 FROM client_partners cp WHERE cp.client_id = ${clients.id})`
      );
    }
    const where = and(...conditions);

    const orderByClause =
      orderPaymentDate === "desc"
        ? sql`${clients.paymentDate} DESC NULLS LAST`
        : orderPaymentDate === "asc"
          ? sql`${clients.paymentDate} ASC NULLS LAST`
          : desc(clients.createdAt);

    const list = await db
      .select({
        id: clients.id,
        companyName: clients.companyName,
        customerCode: clients.customerCode,
        paymentDate: clients.paymentDate,
        commercial: clients.commercial,
        paymentMethod: clients.paymentMethod,
        totalCents: sql<number>`COALESCE(SUM(${clientLineItems.valueCents}), 0)::int`,
      })
      .from(clients)
      .leftJoin(clientLineItems, eq(clientLineItems.clientId, clients.id))
      .where(where)
      .groupBy(clients.id)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(where);

    return NextResponse.json({
      data: list,
      total: totalRow?.count ?? 0,
      page,
      limit,
    });
  } catch (error: unknown) {
    console.error("Erro ao buscar clientes:", error);
    
    let errorMessage = "Erro desconhecido ao buscar clientes";
    let statusCode = 500;
    let details: string | undefined;
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const fullMessage = error.message;
      
      // Erros de conexão com banco de dados
      if (message.includes("connect") || message.includes("connection") || message.includes("timeout") || message.includes("econnrefused")) {
        errorMessage = "Erro de conexão com o banco de dados. Verifique se o PostgreSQL está rodando na porta 5433.";
        statusCode = 503; // Service Unavailable
        details = `Verifique: DATABASE_URL=${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@") || "não definida"}`;
      } else if (message.includes("relation") || message.includes("does not exist") || message.includes("table")) {
        errorMessage = "Tabelas não encontradas no banco de dados. Execute: npm run db:migrate";
        statusCode = 500;
        details = "As migrações do banco de dados podem não ter sido aplicadas.";
      } else if (message.includes("password") || message.includes("authentication")) {
        errorMessage = "Erro de autenticação com o banco de dados. Verifique as credenciais.";
        statusCode = 500;
      } else {
        errorMessage = fullMessage;
        details = error.stack;
      }
    }
    
    const response: { error: string; details?: string } = { error: errorMessage };
    if (details && process.env.NODE_ENV === "development") {
      response.details = details;
    }
    
    return NextResponse.json(
      response,
      { status: statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const meta = getRequestMeta(request);
  const data = parsed.data;

  const companyNameNormalized = normalizeCompanyName(data.companyName);
  const customerCode =
    data.customerCode?.trim() ||
    `CLI-${randomBytes(4).toString("hex").toUpperCase()}`;

  let result: { id: string; created: boolean; deduped: boolean };
  try {
    result = await db.transaction(async (tx) => {
      const winnerId = await resolveNameDuplicates(tx, companyNameNormalized, meta);

      if (winnerId) {
        const [existing] = await tx.select().from(clients).where(eq(clients.id, winnerId)).limit(1);
        if (!existing || existing.deletedAt) throw new Error("Winner not found");

        const clientUpdates = {
          companyName: data.companyName,
          companyNameNormalized,
          customerCode: existing.customerCode, // preservar ao deduplicar
          paymentDate: data.paymentDate?.trim() || null,
          commercial: (data.commercial as CommercialSdr) ?? null,
          sdr: (data.sdr as CommercialSdr) ?? null,
          businessType: data.businessType ?? null,
          paymentMethod: data.paymentMethod ?? null,
          anonymous: data.anonymous ?? false,
          holding: data.holding ?? false,
          affiliate: data.affiliate ?? false,
          express: data.express ?? false,
          notes: data.notes ?? null,
          email: data.email?.trim() || null,
          personalAddressLine1: data.personalAddressLine1?.trim() || null,
          personalAddressLine2: data.personalAddressLine2?.trim() || null,
          personalCity: data.personalCity?.trim() || null,
          personalState: data.personalState?.trim() || null,
          personalPostalCode: data.personalPostalCode?.trim() || null,
          personalCountry: data.personalCountry?.trim() || null,
          updatedAt: new Date(),
        };
        await tx.update(clients).set(clientUpdates).where(eq(clients.id, winnerId));

        await tx.delete(clientLineItems).where(eq(clientLineItems.clientId, winnerId));
        for (const item of data.items ?? []) {
          await tx.insert(clientLineItems).values({
            clientId: winnerId,
            kind: item.kind as LineItemKind,
            description: item.description,
            valueCents: item.valueCents,
            saleDate: item.saleDate ?? null,
            commercial: (item.commercial as CommercialSdr) ?? null,
            sdr: (item.sdr as CommercialSdr) ?? null,
            meta: item.meta ?? null,
          });
        }

        await tx.delete(clientPartners).where(eq(clientPartners.clientId, winnerId));
        for (const p of data.partners ?? []) {
          await tx.insert(clientPartners).values({
            clientId: winnerId,
            fullName: p.fullName,
            role: p.role as PartnerRole,
            percentageBasisPoints: percentToBasisPoints(p.percentage),
            phone: p.phone ?? null,
            email: p.email?.trim() || null,
            addressLine1: p.addressLine1?.trim() || null,
            addressLine2: p.addressLine2?.trim() || null,
            city: p.city?.trim() || null,
            state: p.state?.trim() || null,
            postalCode: p.postalCode?.trim() || null,
            country: p.country?.trim() || null,
          });
        }

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
        return { id: winnerId, created: false, deduped: true };
      }

      const clientValues: ClientInsert = {
        companyName: data.companyName,
        companyNameNormalized,
        customerCode,
        paymentDate: data.paymentDate?.trim() || null,
        commercial: (data.commercial as CommercialSdr) ?? null,
        sdr: (data.sdr as CommercialSdr) ?? null,
        businessType: data.businessType ?? null,
        paymentMethod: data.paymentMethod ?? null,
        anonymous: data.anonymous ?? false,
        holding: data.holding ?? false,
        affiliate: data.affiliate ?? false,
        express: data.express ?? false,
        notes: data.notes ?? null,
        email: data.email?.trim() || null,
        personalAddressLine1: data.personalAddressLine1?.trim() || null,
        personalAddressLine2: data.personalAddressLine2?.trim() || null,
        personalCity: data.personalCity?.trim() || null,
        personalState: data.personalState?.trim() || null,
        personalPostalCode: data.personalPostalCode?.trim() || null,
        personalCountry: data.personalCountry?.trim() || null,
      };
      const [row] = await tx.insert(clients).values(clientValues).returning({ id: clients.id });
      if (!row) throw new Error("Insert failed");

      for (const item of data.items ?? []) {
        await tx.insert(clientLineItems).values({
          clientId: row.id,
          kind: item.kind as LineItemKind,
          description: item.description,
          valueCents: item.valueCents,
          saleDate: item.saleDate ?? null,
          commercial: (item.commercial as CommercialSdr) ?? null,
          sdr: (item.sdr as CommercialSdr) ?? null,
          meta: item.meta ?? null,
        });
      }

      for (const p of data.partners ?? []) {
        await tx.insert(clientPartners).values({
          clientId: row.id,
          fullName: p.fullName,
          role: p.role as PartnerRole,
          percentageBasisPoints: percentToBasisPoints(p.percentage),
          phone: p.phone ?? null,
          email: p.email?.trim() || null,
          addressLine1: p.addressLine1?.trim() || null,
          addressLine2: p.addressLine2?.trim() || null,
          city: p.city?.trim() || null,
          state: p.state?.trim() || null,
          postalCode: p.postalCode?.trim() || null,
          country: p.country?.trim() || null,
        });
      }

      const [full] = await tx
        .select()
        .from(clients)
        .where(eq(clients.id, row.id))
        .limit(1);
      const { oldValues, newValues } = diffChangedFields(null, full as Record<string, unknown>);
      await logAudit(tx, {
        action: "create",
        entity: "clients",
        entityId: row.id,
        oldValues,
        newValues,
        meta,
      });
      return { id: row.id, created: true, deduped: false };
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") {
      return NextResponse.json(
        { error: "Código do cliente já cadastrado", details: { customerCode: ["Já existe um registro com este código"] } },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json(result, { status: 201 });
}

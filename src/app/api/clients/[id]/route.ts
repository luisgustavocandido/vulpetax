import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  clients,
  clientLineItems,
  clientPartners,
  customers,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { resolvePartnerForInsert } from "@/lib/clients/resolvePartnerForInsert";
import { getRequestMeta } from "@/lib/requestMeta";
import { logAudit, diffChangedFields } from "@/lib/audit";
import { updateClientSchema } from "@/lib/clientSchemas";
import { normalizeCompanyName } from "@/lib/clientDedupe";
import { normalizeLineItemForDb } from "@/lib/normalizeLineItemForDb";
import { normalizeLegacyToLineItemInputArray } from "@/types/lineItems";

/** Serializa valor de coluna date para JSON (sempre string YYYY-MM-DD ou undefined). */
function dateToIsoString(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
  return value instanceof Date ? value.toISOString().slice(0, 10) : undefined;
}

type PartnerRow = {
  id: string;
  fullName: string;
  role: string;
  percentageBasisPoints: number;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isPayer: boolean;
  customerId: string | null;
};

async function mapPartnersWithCustomers(partnersRows: PartnerRow[]) {
  const customerIds = Array.from(
    new Set(partnersRows.map((p) => p.customerId).filter((id): id is string => !!id))
  );
  const customersList =
    customerIds.length > 0
      ? await db
          .select({
            id: customers.id,
            fullName: customers.fullName,
            email: customers.email,
            phone: customers.phone,
          })
          .from(customers)
          .where(inArray(customers.id, customerIds))
      : [];
  const customerMap = new Map(customersList.map((c) => [c.id, c]));
  return partnersRows.map((p) => {
    const cust = p.customerId ? customerMap.get(p.customerId) : undefined;
    return {
      id: p.id,
      fullName: p.fullName,
      role: p.role,
      percentage: p.percentageBasisPoints / 100,
      phone: p.phone,
      email: p.email ?? undefined,
      addressLine1: p.addressLine1 ?? undefined,
      addressLine2: p.addressLine2 ?? undefined,
      city: p.city ?? undefined,
      state: p.state ?? undefined,
      postalCode: p.postalCode ?? undefined,
      country: p.country ?? undefined,
      isPayer: p.isPayer ?? false,
      customerId: p.customerId ?? undefined,
      customer: cust
        ? { id: cust.id, fullName: cust.fullName, email: cust.email ?? null, phone: cust.phone ?? null }
        : undefined,
    };
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!row || row.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const lineItemsRows = await db
    .select()
    .from(clientLineItems)
    .where(eq(clientLineItems.clientId, id));

  const partnersRows = await db
    .select()
    .from(clientPartners)
    .where(eq(clientPartners.clientId, id));

  const lineItems = lineItemsRows.map((i) => ({
    id: i.id,
    kind: i.kind,
    description: i.description,
    valueCents: i.valueCents,
    saleDate: dateToIsoString(i.saleDate),
    billingPeriod: i.billingPeriod ?? undefined,
    expirationDate: dateToIsoString(i.expirationDate),
    commercial: i.commercial ?? undefined,
    sdr: i.sdr ?? undefined,
    addressProvider: i.addressProvider ?? undefined,
    addressLine1: i.addressLine1 ?? undefined,
    addressLine2: i.addressLine2 ?? undefined,
    steNumber: i.steNumber ?? undefined,
    llcCategory: i.llcCategory ?? undefined,
    llcState: i.llcState ?? undefined,
    llcCustomCategory: i.llcCustomCategory ?? undefined,
    paymentMethod: i.paymentMethod ?? undefined,
    paymentMethodCustom: i.paymentMethodCustom ?? undefined,
  }));

  const partnersWithCustomer = await mapPartnersWithCustomers(partnersRows);
  return NextResponse.json({
    ...row,
    lineItems,
    items: lineItems,
    partners: partnersWithCustomer,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const hasLineItems = body.lineItems !== undefined;
  const hasItems = body.items !== undefined;
  if (hasLineItems && hasItems && process.env.NODE_ENV === "development") {
    console.warn("[PATCH /api/clients/:id] both lineItems and items present, using lineItems");
  }
  const rawIncoming = body.lineItems ?? body.items;
  if (rawIncoming !== undefined) {
    const normalized = normalizeLegacyToLineItemInputArray(Array.isArray(rawIncoming) ? rawIncoming : []);
    if (!normalized.ok) {
      return NextResponse.json(
        { error: normalized.error },
        { status: normalized.status ?? 400 }
      );
    }
    body.lineItems = normalized.items;
  }
  delete (body as Record<string, unknown>).items;
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const meta = getRequestMeta(request);
  const data = parsed.data;

  if (process.env.NODE_ENV === "development" && data.lineItems !== undefined) {
    console.log("[PATCH /api/clients/:id] lineItems received:", data.lineItems.length, data.lineItems);
  }

  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const clientUpdates: Record<string, unknown> = {};
  if (data.companyName !== undefined) {
    clientUpdates.companyName = data.companyName;
    clientUpdates.companyNameNormalized = normalizeCompanyName(data.companyName);
  }
  // customerCode não é alterável (gerado automaticamente na criação)
  if (data.paymentDate !== undefined) clientUpdates.paymentDate = data.paymentDate?.trim() || null;
  if (data.commercial !== undefined) clientUpdates.commercial = data.commercial;
  if (data.sdr !== undefined) clientUpdates.sdr = data.sdr;
  if (data.businessType !== undefined) clientUpdates.businessType = data.businessType;
  if (data.paymentMethod !== undefined) clientUpdates.paymentMethod = data.paymentMethod;
  if (data.anonymous !== undefined) clientUpdates.anonymous = data.anonymous;
  if (data.holding !== undefined) clientUpdates.holding = data.holding;
  if (data.affiliate !== undefined) clientUpdates.affiliate = data.affiliate;
  if (data.express !== undefined) clientUpdates.express = data.express;
  if (data.notes !== undefined) clientUpdates.notes = data.notes;
  if (data.email !== undefined) clientUpdates.email = data.email?.trim() || null;
  if (data.personalAddressLine1 !== undefined) clientUpdates.personalAddressLine1 = data.personalAddressLine1?.trim() || null;
  if (data.personalAddressLine2 !== undefined) clientUpdates.personalAddressLine2 = data.personalAddressLine2?.trim() || null;
  if (data.personalCity !== undefined) clientUpdates.personalCity = data.personalCity?.trim() || null;
  if (data.personalState !== undefined) clientUpdates.personalState = data.personalState?.trim() || null;
  if (data.personalPostalCode !== undefined) clientUpdates.personalPostalCode = data.personalPostalCode?.trim() || null;
  if (data.personalCountry !== undefined) clientUpdates.personalCountry = data.personalCountry?.trim() || null;

  const hasClientUpdates = Object.keys(clientUpdates).length > 0;
  const hasLineItemsInPayload = data.lineItems !== undefined;
  const hasPartners = data.partners !== undefined;

  if (!hasClientUpdates && !hasLineItemsInPayload && !hasPartners) {
    const itemsRows = await db.select().from(clientLineItems).where(eq(clientLineItems.clientId, id));
    const partnersRowsNoUpdates = await db.select().from(clientPartners).where(eq(clientPartners.clientId, id));
    const lineItemsPayload = itemsRows.map((i) => ({
      id: i.id,
      kind: i.kind,
      description: i.description,
      valueCents: i.valueCents,
      saleDate: dateToIsoString(i.saleDate),
      billingPeriod: i.billingPeriod ?? undefined,
      expirationDate: dateToIsoString(i.expirationDate),
      commercial: i.commercial ?? undefined,
      sdr: i.sdr ?? undefined,
      addressProvider: i.addressProvider ?? undefined,
      addressLine1: i.addressLine1 ?? undefined,
      addressLine2: i.addressLine2 ?? undefined,
      steNumber: i.steNumber ?? undefined,
      llcCategory: i.llcCategory ?? undefined,
      llcState: i.llcState ?? undefined,
      llcCustomCategory: i.llcCustomCategory ?? undefined,
      paymentMethod: i.paymentMethod ?? undefined,
      paymentMethodCustom: i.paymentMethodCustom ?? undefined,
    }));
    const partnersPayload = await mapPartnersWithCustomers(partnersRowsNoUpdates);
    return NextResponse.json({
      ...existing,
      lineItems: lineItemsPayload,
      items: lineItemsPayload,
      partners: partnersPayload,
    });
  }

  const existingItems = hasLineItemsInPayload ? await db.select().from(clientLineItems).where(eq(clientLineItems.clientId, id)) : [];
  const oldPartners = hasPartners ? await db.select().from(clientPartners).where(eq(clientPartners.clientId, id)) : [];

  const incomingLineItems = hasLineItemsInPayload && Array.isArray(data.lineItems) ? data.lineItems : [];
  const existingIds = new Set(existingItems.map((e) => e.id));
  const incoming = incomingLineItems.map((i) =>
    i.id && existingIds.has(i.id) ? i : { ...i, id: undefined }
  );
  const incomingIds = new Set(incoming.filter((i) => i.id).map((i) => i.id!));
  const toUpdate = incoming.filter((i) => i.id);
  const toCreate = incoming.filter((i) => !i.id);
  const toDelete = existingItems.filter((e) => !incomingIds.has(e.id));

  if (process.env.NODE_ENV === "development" && hasLineItemsInPayload) {
    console.log("[PATCH /api/clients/:id] lineItems sync: existingCount=", existingItems.length, "toCreate=", toCreate.length, "toUpdate=", toUpdate.length, "toDelete=", toDelete.length);
  }

  let updated: typeof existing;
  let customerReused = false;
  try {
    [updated, customerReused] = await db.transaction(async (tx) => {
    let customerReused = false;
    if (hasClientUpdates) {
      await tx
        .update(clients)
        .set({ ...clientUpdates, updatedAt: new Date() })
        .where(eq(clients.id, id));
    }

    if (hasLineItemsInPayload) {
      if (toDelete.length > 0) {
        await tx.delete(clientLineItems).where(inArray(clientLineItems.id, toDelete.map((d) => d.id)));
      }
      for (const item of toUpdate) {
        const norm = normalizeLineItemForDb(item);
        await tx
          .update(clientLineItems)
          .set({
            kind: norm.kind,
            description: norm.description,
            valueCents: norm.valueCents,
            saleDate: norm.saleDate,
            billingPeriod: norm.billingPeriod,
            expirationDate: norm.expirationDate,
            commercial: norm.commercial,
            sdr: norm.sdr,
            addressProvider: norm.addressProvider,
            addressLine1: norm.addressLine1,
            addressLine2: norm.addressLine2,
            steNumber: norm.steNumber,
            llcCategory: norm.llcCategory,
            llcState: norm.llcState,
            llcCustomCategory: norm.llcCustomCategory,
            paymentMethod: norm.paymentMethod,
            paymentMethodCustom: norm.paymentMethodCustom,
          })
          .where(eq(clientLineItems.id, item.id!));
      }
      for (const item of toCreate) {
        const norm = normalizeLineItemForDb(item);
        await tx.insert(clientLineItems).values({
          clientId: id,
          kind: norm.kind,
          description: norm.description,
          valueCents: norm.valueCents,
          saleDate: norm.saleDate,
          billingPeriod: norm.billingPeriod,
          expirationDate: norm.expirationDate,
          commercial: norm.commercial,
          sdr: norm.sdr,
          addressProvider: norm.addressProvider,
          addressLine1: norm.addressLine1,
          addressLine2: norm.addressLine2,
          steNumber: norm.steNumber,
          llcCategory: norm.llcCategory,
          llcState: norm.llcState,
          llcCustomCategory: norm.llcCustomCategory,
          paymentMethod: norm.paymentMethod,
          paymentMethodCustom: norm.paymentMethodCustom,
        });
      }
    }

    if (hasPartners) {
      await tx.delete(clientPartners).where(eq(clientPartners.clientId, id));
      for (const p of data.partners!) {
        const resolved = await resolvePartnerForInsert(tx as unknown as typeof db, p);
        if (resolved.customerReused) customerReused = true;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit customerReused from insert
        const { customerReused: _omit, ...resolvedRow } = resolved;
        await tx.insert(clientPartners).values({
          clientId: id,
          ...resolvedRow,
        });
      }
    }

    const [row] = await tx.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!row) throw new Error("Update failed");

    const oldSnapshot = {
      ...existing,
      ...(hasLineItemsInPayload && { lineItems: existingItems }),
      ...(hasPartners && { partners: oldPartners }),
    };
    const newSnapshot = {
      ...row,
      ...(hasLineItemsInPayload && { lineItems: data.lineItems }),
      ...(hasPartners && { partners: data.partners }),
    };
    const { oldValues, newValues } = diffChangedFields(
      oldSnapshot as Record<string, unknown>,
      newSnapshot as Record<string, unknown>
    );
    if (oldValues !== null || newValues !== null) {
      await logAudit(tx, {
        action: "update",
        entity: "clients",
        entityId: id,
        oldValues,
        newValues,
        meta,
      });
    }
    return [row, customerReused] as const;
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
    if (code === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ error: "Cliente pagador não encontrado" }, { status: 404 });
    }
    throw err;
  }

  const items = await db.select().from(clientLineItems).where(eq(clientLineItems.clientId, id));
  const partners = await db.select().from(clientPartners).where(eq(clientPartners.clientId, id));

  if (process.env.NODE_ENV === "development" && hasLineItemsInPayload) {
    console.log("[PATCH /api/clients/:id] lineItems after sync: count=", items.length);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);

  const lineItemsPayload = items.map((i) => ({
    id: i.id,
    kind: i.kind,
    description: i.description,
    valueCents: i.valueCents,
    saleDate: dateToIsoString(i.saleDate),
    billingPeriod: i.billingPeriod ?? undefined,
    expirationDate: dateToIsoString(i.expirationDate),
    commercial: i.commercial ?? undefined,
    sdr: i.sdr ?? undefined,
    addressProvider: i.addressProvider ?? undefined,
    addressLine1: i.addressLine1 ?? undefined,
    addressLine2: i.addressLine2 ?? undefined,
    steNumber: i.steNumber ?? undefined,
    llcCategory: i.llcCategory ?? undefined,
    llcState: i.llcState ?? undefined,
    llcCustomCategory: i.llcCustomCategory ?? undefined,
    paymentMethod: i.paymentMethod ?? undefined,
    paymentMethodCustom: i.paymentMethodCustom ?? undefined,
  }));
  const partnersPayload = await mapPartnersWithCustomers(partners);
  const client = {
    ...updated,
    lineItems: lineItemsPayload,
    items: lineItemsPayload,
    partners: partnersPayload,
  };

  return NextResponse.json({ client, customerReused: customerReused === true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meta = getRequestMeta(request);

  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx.update(clients).set({ deletedAt: new Date() }).where(eq(clients.id, id));
    const { oldValues, newValues } = diffChangedFields(
      existing as Record<string, unknown>,
      null
    );
    await logAudit(tx, {
      action: "delete",
      entity: "clients",
      entityId: id,
      oldValues,
      newValues,
      meta,
    });
  });

  return new NextResponse(null, { status: 204 });
}

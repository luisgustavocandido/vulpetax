import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientLineItems, clientPartners, type LineItemKind, type PartnerRole } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRequestMeta } from "@/lib/requestMeta";
import { logAudit, diffChangedFields } from "@/lib/audit";
import { updateClientSchema, percentToBasisPoints } from "@/lib/clientSchemas";
import { normalizeCompanyName } from "@/lib/clientDedupe";

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

  const items = await db
    .select()
    .from(clientLineItems)
    .where(eq(clientLineItems.clientId, id));

  const partners = await db
    .select()
    .from(clientPartners)
    .where(eq(clientPartners.clientId, id));

  return NextResponse.json({
    ...row,
    items: items.map((i) => ({
      id: i.id,
      kind: i.kind,
      description: i.description,
      valueCents: i.valueCents,
      meta: i.meta,
    })),
    partners: partners.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      role: p.role,
      percentage: p.percentageBasisPoints / 100,
      phone: p.phone,
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const meta = getRequestMeta(request);
  const data = parsed.data;

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

  const hasClientUpdates = Object.keys(clientUpdates).length > 0;
  const hasItems = data.items !== undefined;
  const hasPartners = data.partners !== undefined;

  if (!hasClientUpdates && !hasItems && !hasPartners) {
    const items = await db.select().from(clientLineItems).where(eq(clientLineItems.clientId, id));
    const partners = await db.select().from(clientPartners).where(eq(clientPartners.clientId, id));
    return NextResponse.json({
      ...existing,
      items: items.map((i) => ({ id: i.id, kind: i.kind, description: i.description, valueCents: i.valueCents, meta: i.meta })),
      partners: partners.map((p) => ({ id: p.id, fullName: p.fullName, role: p.role, percentage: p.percentageBasisPoints / 100, phone: p.phone })),
    });
  }

  const oldItems = hasItems ? await db.select().from(clientLineItems).where(eq(clientLineItems.clientId, id)) : [];
  const oldPartners = hasPartners ? await db.select().from(clientPartners).where(eq(clientPartners.clientId, id)) : [];

  const [updated] = await db.transaction(async (tx) => {
    if (hasClientUpdates) {
      await tx
        .update(clients)
        .set({ ...clientUpdates, updatedAt: new Date() })
        .where(eq(clients.id, id));
    }

    if (hasItems) {
      await tx.delete(clientLineItems).where(eq(clientLineItems.clientId, id));
      for (const item of data.items!) {
        await tx.insert(clientLineItems).values({
          clientId: id,
          kind: item.kind as LineItemKind,
          description: item.description,
          valueCents: item.valueCents,
          meta: item.meta ?? null,
        });
      }
    }

    if (hasPartners) {
      await tx.delete(clientPartners).where(eq(clientPartners.clientId, id));
      for (const p of data.partners!) {
        await tx.insert(clientPartners).values({
          clientId: id,
          fullName: p.fullName,
          role: p.role as PartnerRole,
          percentageBasisPoints: percentToBasisPoints(p.percentage),
          phone: p.phone ?? null,
        });
      }
    }

    const [row] = await tx.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!row) throw new Error("Update failed");

    const oldSnapshot = {
      ...existing,
      ...(hasItems && { items: oldItems }),
      ...(hasPartners && { partners: oldPartners }),
    };
    const newSnapshot = {
      ...row,
      ...(hasItems && { items: data.items }),
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
    return [row];
  });

  const items = await db.select().from(clientLineItems).where(eq(clientLineItems.clientId, id));
  const partners = await db.select().from(clientPartners).where(eq(clientPartners.clientId, id));

  return NextResponse.json({
    ...updated,
    items: items.map((i) => ({ id: i.id, kind: i.kind, description: i.description, valueCents: i.valueCents, meta: i.meta })),
    partners: partners.map((p) => ({ id: p.id, fullName: p.fullName, role: p.role, percentage: p.percentageBasisPoints / 100, phone: p.phone })),
  });
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

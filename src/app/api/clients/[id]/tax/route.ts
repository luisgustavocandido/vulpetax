import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientTaxProfile, clientTaxOwners, clientTaxForms } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getRequestMeta } from "@/lib/requestMeta";
import { logAudit, diffChangedFields } from "@/lib/audit";
import { computeTaxStatus, computeTaxAlerts, FIELD_LABELS } from "@/lib/taxNonresident/rules";
import { taxProfilePatchSchema } from "@/lib/taxNonresident/schemas";
import { taxRemoveRateLimitCheck, taxRemoveRateLimitConsume } from "@/lib/syncRateLimit";
import { logSecurityEvent } from "@/lib/logger";

function getIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!client || client.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const [profile] = await db
    .select()
    .from(clientTaxProfile)
    .where(eq(clientTaxProfile.clientId, id))
    .limit(1);

  const owners = await db
    .select()
    .from(clientTaxOwners)
    .where(eq(clientTaxOwners.clientId, id))
    .orderBy(asc(clientTaxOwners.ownerIndex));

  const profileData = profile
    ? {
        ...profile,
        llcName: profile.llcName ?? client.companyName,
      }
    : null;

  const { status, missingFields } = computeTaxStatus(profileData);
  const alerts = computeTaxAlerts(profileData);
  const missingLabels = missingFields.map((f) => FIELD_LABELS[f] ?? f);

  return NextResponse.json({
    taxProfile: profile,
    owners,
    client: { id: client.id, companyName: client.companyName, customerCode: client.customerCode },
    computed: { status, missingFields: missingLabels, alerts },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = taxProfilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const meta = getRequestMeta(request);
  const data = parsed.data;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!client || client.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const profileValues: Record<string, unknown> = {};
  const effectiveData = data;
  const residentialApplicable = effectiveData.ownerHomeAddressDifferent === true;
  const profileFields = [
    "llcName", "formationDate", "activitiesDescription", "einNumber",
    "llcUsAddressLine1", "llcUsAddressLine2", "llcUsCity", "llcUsState", "llcUsZip",
    "ownerEmail", "ownerFullLegalName", "ownerResidenceCountry", "ownerCitizenshipCountry",
    "ownerHomeAddressDifferent",
    "ownerResidentialAddressLine1", "ownerResidentialAddressLine2", "ownerResidentialCity",
    "ownerResidentialState", "ownerResidentialPostalCode", "ownerResidentialCountry",
    "ownerUsTaxId", "ownerForeignTaxId", "llcFormationCostUsdCents",
    "hasAdditionalOwners", "totalAssetsUsdCents", "hasUsBankAccounts",
    "totalWithdrawalsUsdCents", "totalTransferredToLlcUsdCents", "totalWithdrawnFromLlcUsdCents",
    "personalExpensesPaidByCompanyUsdCents", "businessExpensesPaidPersonallyUsdCents",
    "passportCopiesProvided", "articlesOfOrganizationProvided", "einLetterProvided",
    "additionalDocumentsProvided", "additionalDocumentsNotes", "declarationAccepted",
  ];
  for (const f of profileFields) {
    let v = (effectiveData as Record<string, unknown>)[f];
    if (f.startsWith("ownerResidential") && !residentialApplicable) {
      v = null;
    }
    if (v !== undefined) profileValues[f] = v;
  }
  if (!residentialApplicable) {
    profileValues.ownerResidentialAddressLine1 = null;
    profileValues.ownerResidentialAddressLine2 = null;
    profileValues.ownerResidentialCity = null;
    profileValues.ownerResidentialState = null;
    profileValues.ownerResidentialPostalCode = null;
    profileValues.ownerResidentialCountry = null;
  }
  if (effectiveData.declarationAccepted === true && Object.keys(profileValues).includes("declarationAccepted")) {
    profileValues.declarationAcceptedAt = new Date();
  }
  profileValues.updatedAt = new Date();

  await db.transaction(async (tx) => {
    const [existingProfile] = await tx
      .select()
      .from(clientTaxProfile)
      .where(eq(clientTaxProfile.clientId, id))
      .limit(1);

    if (existingProfile) {
      const oldProfile = existingProfile as Record<string, unknown>;
      await tx
        .update(clientTaxProfile)
        .set(profileValues as typeof clientTaxProfile.$inferInsert)
        .where(eq(clientTaxProfile.clientId, id));
      const [updated] = await tx.select().from(clientTaxProfile).where(eq(clientTaxProfile.clientId, id)).limit(1);
      const { oldValues, newValues } = diffChangedFields(oldProfile, updated as Record<string, unknown>);
      if (oldValues !== null || newValues !== null) {
        await logAudit(tx, {
          action: "update",
          entity: "client_tax_profile",
          entityId: id,
          oldValues,
          newValues,
          meta,
        });
      }
    } else {
      const [inserted] = await tx
        .insert(clientTaxProfile)
        .values({
          clientId: id,
          ...(profileValues as object),
        } as typeof clientTaxProfile.$inferInsert)
        .returning();
      if (inserted) {
        const { oldValues, newValues } = diffChangedFields(null, inserted as Record<string, unknown>);
        await logAudit(tx, {
          action: "create",
          entity: "client_tax_profile",
          entityId: id,
          oldValues,
          newValues,
          meta,
        });
      }
    }

    if (effectiveData.owners !== undefined) {
      await tx.delete(clientTaxOwners).where(eq(clientTaxOwners.clientId, id));
      for (const o of effectiveData.owners) {
        await tx.insert(clientTaxOwners).values({
          clientId: id,
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
      if (effectiveData.owners.length > 0) {
        await logAudit(tx, {
          action: "update",
          entity: "client_tax_owners",
          entityId: id,
          oldValues: { count: 0 },
          newValues: { count: effectiveData.owners.length },
          meta,
        });
      }
    }
  });

  const [profile] = await db
    .select()
    .from(clientTaxProfile)
    .where(eq(clientTaxProfile.clientId, id))
    .limit(1);
  const owners = await db
    .select()
    .from(clientTaxOwners)
    .where(eq(clientTaxOwners.clientId, id))
    .orderBy(asc(clientTaxOwners.ownerIndex));
  const profileData = profile ? { ...profile, llcName: profile.llcName ?? client.companyName } : null;
  const { status, missingFields } = computeTaxStatus(profileData);
  const alerts = computeTaxAlerts(profileData);
  const missingLabels = missingFields.map((f) => FIELD_LABELS[f] ?? f);

  return NextResponse.json({
    taxProfile: profile,
    owners,
    computed: { status, missingFields: missingLabels, alerts },
  });
}

/**
 * DELETE /api/clients/[id]/tax
 * Remove TAX do cliente: deleta tax_profile e tax_owners, limpa taxFormSource/taxFormSubmittedAt.
 * Idempotente: se não houver tax_profile, retorna 200 com removed: false.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = getIp(request);

  if (!taxRemoveRateLimitCheck(ip)) {
    return NextResponse.json(
      { error: "Muitas solicitações. Aguarde 1 hora." },
      { status: 429 }
    );
  }
  taxRemoveRateLimitConsume(ip);

  const meta = getRequestMeta(request);

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!client || client.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const [profile] = await db
    .select()
    .from(clientTaxProfile)
    .where(eq(clientTaxProfile.clientId, id))
    .limit(1);

  const existingForms = await db
    .select({ id: clientTaxForms.id })
    .from(clientTaxForms)
    .where(eq(clientTaxForms.clientId, id));
  const hasForms = existingForms.length > 0;

  const owners = await db
    .select()
    .from(clientTaxOwners)
    .where(eq(clientTaxOwners.clientId, id))
    .orderBy(asc(clientTaxOwners.ownerIndex));

  if (!profile && !hasForms) {
    return NextResponse.json({ ok: true, removed: false });
  }

  const profileData = profile
    ? { ...profile, llcName: profile.llcName ?? client.companyName }
    : null;
  const { status } = computeTaxStatus(profileData);

  await db.transaction(async (tx) => {
    await tx.delete(clientTaxOwners).where(eq(clientTaxOwners.clientId, id));
    await tx.delete(clientTaxProfile).where(eq(clientTaxProfile.clientId, id));
    await tx.delete(clientTaxForms).where(eq(clientTaxForms.clientId, id));
    await tx
      .update(clients)
      .set({
        taxFormSource: null,
        taxFormSubmittedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id));

    if (profile) {
      const oldValues = {
        clientId: id,
        customerCode: client.customerCode,
        companyName: client.companyName,
        statusAnterior: status,
        hasFBAR: profile.aggregateBalanceOver10k ?? false,
        updatedAt: profile.updatedAt?.toISOString() ?? null,
        ownersCount: owners.length,
      };
      await logAudit(tx, {
        action: "delete",
        entity: "client_tax_profile",
        entityId: id,
        oldValues,
        newValues: null,
        meta,
      });
      if (owners.length > 0) {
        await logAudit(tx, {
          action: "delete",
          entity: "client_tax_owners",
          entityId: id,
          oldValues: { clientId: id, count: owners.length },
          newValues: null,
          meta,
        });
      }
    }
    if (hasForms) {
      await logAudit(tx, {
        action: "delete",
        entity: "client_tax_forms",
        entityId: id,
        oldValues: { clientId: id },
        newValues: null,
        meta,
      });
    }
  });

  logSecurityEvent("tax_remove", { clientId: id, ip: meta.ip });
  return NextResponse.json({ ok: true, removed: true });
}

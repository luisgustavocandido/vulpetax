import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientPartners, clientTaxForms, clientTaxOwners } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { getRequestMeta } from "@/lib/requestMeta";
import { logAudit, diffChangedFields } from "@/lib/audit";
import { computeTaxStatus, computeTaxAlerts, FIELD_LABELS } from "@/lib/taxNonresident/rules";
import { taxProfilePatchSchema } from "@/lib/taxNonresident/schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taxFormId: string }> }
) {
  const { id, taxFormId } = await params;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!client || client.deletedAt) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const [form] = await db
    .select()
    .from(clientTaxForms)
    .where(and(eq(clientTaxForms.id, taxFormId), eq(clientTaxForms.clientId, id)))
    .limit(1);
  if (!form) {
    return NextResponse.json({ error: "Formulário TAX não encontrado" }, { status: 404 });
  }

  const owners = await db
    .select()
    .from(clientTaxOwners)
    .where(eq(clientTaxOwners.taxFormId, taxFormId))
    .orderBy(asc(clientTaxOwners.ownerIndex));

  // Se o form não tem dados do proprietário principal, preencher com sócio principal do cliente
  let effectiveForm: typeof form = form;
  const hasOwnerData =
    form.ownerEmail?.trim() ||
    form.ownerFullLegalName?.trim() ||
    form.ownerResidenceCountry?.trim() ||
    form.ownerCitizenshipCountry?.trim();
  if (!hasOwnerData) {
    const partners = await db
      .select()
      .from(clientPartners)
      .where(eq(clientPartners.clientId, id));
    const mainPartner = partners.find((p) => p.role === "SocioPrincipal") ?? partners[0];
    if (mainPartner) {
      const hasAddress = !!(
        mainPartner.addressLine1?.trim() ||
        mainPartner.city?.trim() ||
        mainPartner.country?.trim()
      );
      effectiveForm = {
        ...form,
        ownerEmail: mainPartner.email ?? client.email,
        ownerFullLegalName: mainPartner.fullName,
        ownerResidenceCountry: mainPartner.country,
        ownerCitizenshipCountry: mainPartner.country,
        ownerHomeAddressDifferent: hasAddress,
        ownerResidentialAddressLine1: mainPartner.addressLine1 ?? null,
        ownerResidentialAddressLine2: mainPartner.addressLine2 ?? null,
        ownerResidentialCity: mainPartner.city ?? null,
        ownerResidentialState: mainPartner.state ?? null,
        ownerResidentialPostalCode: mainPartner.postalCode ?? null,
        ownerResidentialCountry: mainPartner.country ?? null,
      };
    } else {
      // Cliente sem sócios: usar dados pessoais do cliente
      const hasAddress = !!(
        client.personalAddressLine1?.trim() ||
        client.personalCity?.trim() ||
        client.personalCountry?.trim()
      );
      effectiveForm = {
        ...form,
        ownerEmail: client.email ?? null,
        ownerFullLegalName: null,
        ownerResidenceCountry: client.personalCountry ?? null,
        ownerCitizenshipCountry: client.personalCountry ?? null,
        ownerHomeAddressDifferent: hasAddress,
        ownerResidentialAddressLine1: client.personalAddressLine1 ?? null,
        ownerResidentialAddressLine2: client.personalAddressLine2 ?? null,
        ownerResidentialCity: client.personalCity ?? null,
        ownerResidentialState: client.personalState ?? null,
        ownerResidentialPostalCode: client.personalPostalCode ?? null,
        ownerResidentialCountry: client.personalCountry ?? null,
      };
    }
  }

  const profileData = effectiveForm
    ? {
        ...effectiveForm,
        llcName: effectiveForm.llcName ?? client.companyName,
      }
    : null;

  const { status, missingFields } = computeTaxStatus(profileData);
  const alerts = computeTaxAlerts(profileData);
  const missingLabels = missingFields.map((f) => FIELD_LABELS[f] ?? f);

  return NextResponse.json({
    taxForm: effectiveForm ?? form,
    owners,
    client: { id: client.id, companyName: client.companyName, customerCode: client.customerCode },
    computed: { status, missingFields: missingLabels, alerts },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taxFormId: string }> }
) {
  const { id, taxFormId } = await params;
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

  const [existingForm] = await db
    .select()
    .from(clientTaxForms)
    .where(and(eq(clientTaxForms.id, taxFormId), eq(clientTaxForms.clientId, id)))
    .limit(1);
  if (!existingForm) {
    return NextResponse.json({ error: "Formulário TAX não encontrado" }, { status: 404 });
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
    const oldForm = existingForm as Record<string, unknown>;
    await tx
      .update(clientTaxForms)
      .set(profileValues as typeof clientTaxForms.$inferInsert)
      .where(eq(clientTaxForms.id, taxFormId));
    const [updated] = await tx.select().from(clientTaxForms).where(eq(clientTaxForms.id, taxFormId)).limit(1);
    const { oldValues, newValues } = diffChangedFields(oldForm, updated as Record<string, unknown>);
    if (oldValues !== null || newValues !== null) {
      await logAudit(tx, {
        action: "update",
        entity: "client_tax_forms",
        entityId: taxFormId,
        oldValues,
        newValues,
        meta,
      });
    }

    if (effectiveData.owners !== undefined) {
      await tx.delete(clientTaxOwners).where(eq(clientTaxOwners.taxFormId, taxFormId));
      for (const o of effectiveData.owners) {
        await tx.insert(clientTaxOwners).values({
          clientId: id,
          taxFormId: taxFormId,
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
          entityId: taxFormId,
          oldValues: { count: 0 },
          newValues: { count: effectiveData.owners.length },
          meta,
        });
      }
    }
  });

  const [form] = await db
    .select()
    .from(clientTaxForms)
    .where(eq(clientTaxForms.id, taxFormId))
    .limit(1);
  const owners = await db
    .select()
    .from(clientTaxOwners)
    .where(eq(clientTaxOwners.taxFormId, taxFormId))
    .orderBy(asc(clientTaxOwners.ownerIndex));
  const profileData = form ? { ...form, llcName: form.llcName ?? client.companyName } : null;
  const { status, missingFields } = computeTaxStatus(profileData);
  const alerts = computeTaxAlerts(profileData);
  const missingLabels = missingFields.map((f) => FIELD_LABELS[f] ?? f);

  return NextResponse.json({
    taxForm: form,
    owners,
    computed: { status, missingFields: missingLabels, alerts },
  });
}

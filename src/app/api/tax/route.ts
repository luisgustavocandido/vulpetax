import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientTaxProfile, clientTaxForms } from "@/db/schema";
import { and, eq, isNull, sql, desc, notInArray } from "drizzle-orm";
import { computeTaxStatus, computeTaxAlerts } from "@/lib/taxNonresident/rules";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const aggregateOver10k = searchParams.get("aggregateBalanceOver10k");
  const hasUsBankAccounts = searchParams.get("hasUsBankAccounts");

  // 1) Clientes do sync (Google Sheets)
  const syncConditions = [
    isNull(clients.deletedAt),
    eq(clients.taxFormSource, "google_sheets_tax_form"),
  ];

  const syncRows = await db
    .select({
      clientId: clients.id,
      companyName: clients.companyName,
      customerCode: clients.customerCode,
      updatedAt: clientTaxProfile.updatedAt,
      hasUsBankAccounts: clientTaxProfile.hasUsBankAccounts,
      aggregateBalanceOver10k: clientTaxProfile.aggregateBalanceOver10k,
      llcName: clientTaxProfile.llcName,
      formationDate: clientTaxProfile.formationDate,
      einNumber: clientTaxProfile.einNumber,
      passportCopiesProvided: clientTaxProfile.passportCopiesProvided,
      articlesOfOrganizationProvided: clientTaxProfile.articlesOfOrganizationProvided,
      declarationAccepted: clientTaxProfile.declarationAccepted,
      totalAssetsUsdCents: clientTaxProfile.totalAssetsUsdCents,
      ownerEmail: clientTaxProfile.ownerEmail,
      ownerFullLegalName: clientTaxProfile.ownerFullLegalName,
      ownerResidenceCountry: clientTaxProfile.ownerResidenceCountry,
      ownerCitizenshipCountry: clientTaxProfile.ownerCitizenshipCountry,
      ownerHomeAddressDifferent: clientTaxProfile.ownerHomeAddressDifferent,
      llcFormationCostUsdCents: clientTaxProfile.llcFormationCostUsdCents,
      llcUsAddressLine1: clientTaxProfile.llcUsAddressLine1,
      llcUsCity: clientTaxProfile.llcUsCity,
      llcUsState: clientTaxProfile.llcUsState,
      llcUsZip: clientTaxProfile.llcUsZip,
      activitiesDescription: clientTaxProfile.activitiesDescription,
    })
    .from(clients)
    .leftJoin(clientTaxProfile, eq(clientTaxProfile.clientId, clients.id))
    .where(and(...syncConditions))
    .orderBy(desc(sql`COALESCE(${clientTaxProfile.updatedAt}, ${clients.updatedAt})`));

  const syncClientIds = syncRows.map((r) => r.clientId);

  // 2) Clientes com TAX forms manuais (client_tax_forms) que não estão no sync
  const manualRows =
    syncClientIds.length > 0
      ? await db
          .select({
            clientId: clients.id,
            companyName: clients.companyName,
            customerCode: clients.customerCode,
            updatedAt: clientTaxForms.updatedAt,
            hasUsBankAccounts: clientTaxForms.hasUsBankAccounts,
            aggregateBalanceOver10k: clientTaxForms.aggregateBalanceOver10k,
            llcName: clientTaxForms.llcName,
            formationDate: clientTaxForms.formationDate,
            einNumber: clientTaxForms.einNumber,
            passportCopiesProvided: clientTaxForms.passportCopiesProvided,
            articlesOfOrganizationProvided: clientTaxForms.articlesOfOrganizationProvided,
            declarationAccepted: clientTaxForms.declarationAccepted,
            totalAssetsUsdCents: clientTaxForms.totalAssetsUsdCents,
            ownerEmail: clientTaxForms.ownerEmail,
            ownerFullLegalName: clientTaxForms.ownerFullLegalName,
            ownerResidenceCountry: clientTaxForms.ownerResidenceCountry,
            ownerCitizenshipCountry: clientTaxForms.ownerCitizenshipCountry,
            ownerHomeAddressDifferent: clientTaxForms.ownerHomeAddressDifferent,
            llcFormationCostUsdCents: clientTaxForms.llcFormationCostUsdCents,
            llcUsAddressLine1: clientTaxForms.llcUsAddressLine1,
            llcUsCity: clientTaxForms.llcUsCity,
            llcUsState: clientTaxForms.llcUsState,
            llcUsZip: clientTaxForms.llcUsZip,
            activitiesDescription: clientTaxForms.activitiesDescription,
          })
          .from(clients)
          .innerJoin(clientTaxForms, eq(clientTaxForms.clientId, clients.id))
          .where(
            and(
              isNull(clients.deletedAt),
              notInArray(clients.id, syncClientIds)
            )
          )
      : await db
          .select({
            clientId: clients.id,
            companyName: clients.companyName,
            customerCode: clients.customerCode,
            updatedAt: clientTaxForms.updatedAt,
            hasUsBankAccounts: clientTaxForms.hasUsBankAccounts,
            aggregateBalanceOver10k: clientTaxForms.aggregateBalanceOver10k,
            llcName: clientTaxForms.llcName,
            formationDate: clientTaxForms.formationDate,
            einNumber: clientTaxForms.einNumber,
            passportCopiesProvided: clientTaxForms.passportCopiesProvided,
            articlesOfOrganizationProvided: clientTaxForms.articlesOfOrganizationProvided,
            declarationAccepted: clientTaxForms.declarationAccepted,
            totalAssetsUsdCents: clientTaxForms.totalAssetsUsdCents,
            ownerEmail: clientTaxForms.ownerEmail,
            ownerFullLegalName: clientTaxForms.ownerFullLegalName,
            ownerResidenceCountry: clientTaxForms.ownerResidenceCountry,
            ownerCitizenshipCountry: clientTaxForms.ownerCitizenshipCountry,
            ownerHomeAddressDifferent: clientTaxForms.ownerHomeAddressDifferent,
            llcFormationCostUsdCents: clientTaxForms.llcFormationCostUsdCents,
            llcUsAddressLine1: clientTaxForms.llcUsAddressLine1,
            llcUsCity: clientTaxForms.llcUsCity,
            llcUsState: clientTaxForms.llcUsState,
            llcUsZip: clientTaxForms.llcUsZip,
            activitiesDescription: clientTaxForms.activitiesDescription,
          })
          .from(clients)
          .innerJoin(clientTaxForms, eq(clientTaxForms.clientId, clients.id))
          .where(isNull(clients.deletedAt));

  // Deduplicar manual: um cliente pode ter vários forms; pegar o mais recente por cliente
  const manualByClient = new Map<string, (typeof manualRows)[0]>();
  for (const r of manualRows) {
    const existing = manualByClient.get(r.clientId);
    if (!existing || (r.updatedAt && (!existing.updatedAt || new Date(r.updatedAt) > new Date(existing.updatedAt)))) {
      manualByClient.set(r.clientId, r);
    }
  }
  const manualDeduped = Array.from(manualByClient.values());

  const rows = [...syncRows, ...manualDeduped].sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return dateB - dateA;
  });

  const list = rows.map((r) => {
    const profileData = r.clientId
      ? {
          llcName: r.llcName ?? undefined,
          formationDate: r.formationDate ?? undefined,
          activitiesDescription: r.activitiesDescription ?? undefined,
          einNumber: r.einNumber ?? undefined,
          llcUsAddressLine1: r.llcUsAddressLine1 ?? undefined,
          llcUsCity: r.llcUsCity ?? undefined,
          llcUsState: r.llcUsState ?? undefined,
          llcUsZip: r.llcUsZip ?? undefined,
          ownerEmail: r.ownerEmail ?? undefined,
          ownerFullLegalName: r.ownerFullLegalName ?? undefined,
          ownerResidenceCountry: r.ownerResidenceCountry ?? undefined,
          ownerCitizenshipCountry: r.ownerCitizenshipCountry ?? undefined,
          ownerHomeAddressDifferent: r.ownerHomeAddressDifferent ?? undefined,
          llcFormationCostUsdCents: r.llcFormationCostUsdCents ?? undefined,
          totalAssetsUsdCents: r.totalAssetsUsdCents ?? undefined,
          hasUsBankAccounts: r.hasUsBankAccounts ?? undefined,
          aggregateBalanceOver10k: r.aggregateBalanceOver10k ?? undefined,
          passportCopiesProvided: r.passportCopiesProvided ?? undefined,
          articlesOfOrganizationProvided: r.articlesOfOrganizationProvided ?? undefined,
          declarationAccepted: r.declarationAccepted ?? undefined,
        }
      : null;
    const { status: s } = computeTaxStatus(profileData);
    const alerts = computeTaxAlerts(profileData);
    return {
      clientId: r.clientId,
      companyName: r.companyName,
      customerCode: r.customerCode,
      status: s,
      alertsCount: alerts.length,
      aggregateBalanceOver10k: r.aggregateBalanceOver10k ?? false,
      hasUsBankAccounts: r.hasUsBankAccounts ?? false,
      updatedAt: r.updatedAt,
    };
  });

  let filtered = list;
  if (status) {
    filtered = filtered.filter((x) => x.status === status);
  }
  if (aggregateOver10k === "true") {
    filtered = filtered.filter((x) => x.aggregateBalanceOver10k);
  }
  if (hasUsBankAccounts === "true") {
    filtered = filtered.filter((x) => x.hasUsBankAccounts);
  }

  return NextResponse.json({ data: filtered });
}

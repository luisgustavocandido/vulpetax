import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, clientTaxProfile } from "@/db/schema";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { computeTaxStatus, computeTaxAlerts } from "@/lib/taxNonresident/rules";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const aggregateOver10k = searchParams.get("aggregateBalanceOver10k");
  const hasUsBankAccounts = searchParams.get("hasUsBankAccounts");

  const conditions = [
    isNull(clients.deletedAt),
    eq(clients.taxFormSource, "google_sheets_tax_form"),
  ];

  const rows = await db
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
    .where(and(...conditions))
    .orderBy(desc(sql`COALESCE(${clientTaxProfile.updatedAt}, ${clients.updatedAt})`));

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

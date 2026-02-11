/**
 * Regras de status, alertas e campos obrigatórios para TAX (Não Residentes).
 * Base: PDF Formulário VulpeTax + site vulpeinc.com/declaracoes/single-member/
 *
 * Não constitui aconselhamento fiscal.
 */

export const TAX_STATUS = {
  INCOMPLETO: "INCOMPLETO",
  PENDENTE: "PENDENTE",
  PRONTO_PARA_ENVIO: "PRONTO_PARA_ENVIO",
} as const;

export type TaxStatus = (typeof TAX_STATUS)[keyof typeof TAX_STATUS];

export type TaxProfileData = {
  llcName?: string | null;
  formationDate?: string | null;
  activitiesDescription?: string | null;
  einNumber?: string | null;
  llcUsAddressLine1?: string | null;
  llcUsAddressLine2?: string | null;
  llcUsCity?: string | null;
  llcUsState?: string | null;
  llcUsZip?: string | null;
  ownerEmail?: string | null;
  ownerFullLegalName?: string | null;
  ownerResidenceCountry?: string | null;
  ownerCitizenshipCountry?: string | null;
  ownerHomeAddressDifferent?: boolean | null;
  ownerUsTaxId?: string | null;
  ownerForeignTaxId?: string | null;
  llcFormationCostUsdCents?: number | null;
  totalAssetsUsdCents?: number | null;
  hasUsBankAccounts?: boolean | null;
  aggregateBalanceOver10k?: boolean | null;
  passportCopiesProvided?: boolean | null;
  articlesOfOrganizationProvided?: boolean | null;
  einLetterProvided?: boolean | null;
  declarationAccepted?: boolean | null;
};

/** Campos obrigatórios do PDF (marcados com *) */
const REQUIRED_FIELDS: (keyof TaxProfileData)[] = [
  "llcName",
  "formationDate",
  "activitiesDescription",
  "einNumber",
  "llcUsAddressLine1",
  "llcUsCity",
  "llcUsState",
  "llcUsZip",
  "ownerEmail",
  "ownerFullLegalName",
  "ownerResidenceCountry",
  "ownerCitizenshipCountry",
  "ownerHomeAddressDifferent",
  "llcFormationCostUsdCents",
  "totalAssetsUsdCents",
  "passportCopiesProvided",
  "articlesOfOrganizationProvided",
  "declarationAccepted",
];

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return false;
  if (typeof v === "boolean") return false;
  return true;
}

export function computeTaxStatus(profile: TaxProfileData | null): {
  status: TaxStatus;
  missingFields: string[];
} {
  if (!profile) {
    return { status: TAX_STATUS.INCOMPLETO, missingFields: REQUIRED_FIELDS as string[] };
  }

  const missingFields: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const v = profile[field];
    if (field === "ownerHomeAddressDifferent") {
      if (v === undefined || v === null) missingFields.push(field);
    } else if (field === "passportCopiesProvided" || field === "articlesOfOrganizationProvided" || field === "declarationAccepted") {
      if (!v) missingFields.push(field);
    } else if (typeof v === "number") {
      if (v === undefined || v === null) missingFields.push(field);
    } else if (isEmpty(v)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return { status: TAX_STATUS.INCOMPLETO, missingFields };
  }

  if (!profile.declarationAccepted || !profile.passportCopiesProvided || !profile.articlesOfOrganizationProvided) {
    return { status: TAX_STATUS.PENDENTE, missingFields: [] };
  }

  return { status: TAX_STATUS.PRONTO_PARA_ENVIO, missingFields: [] };
}

export function computeTaxAlerts(profile: TaxProfileData | null): string[] {
  const alerts: string[] = [];
  if (!profile) return alerts;

  if (profile.hasUsBankAccounts && profile.aggregateBalanceOver10k) {
    alerts.push("Possível necessidade de FBAR (FinCEN 114) – custo adicional informado no formulário");
  }
  if (!profile.formationDate || profile.formationDate.toString().trim() === "") {
    alerts.push("Data de formação necessária");
  }
  if (!profile.einNumber || profile.einNumber.trim() === "") {
    alerts.push("EIN é obrigatório no formulário");
  }
  if (!profile.ownerUsTaxId || profile.ownerUsTaxId.trim() === "") {
    alerts.push("US Tax ID 'se aplicável' – confirmar se possui ITIN/SSN");
  }

  return alerts;
}

/** Labels para campos (para exibição em missingFields) */
export const FIELD_LABELS: Record<string, string> = {
  llcName: "Nome da LLC",
  formationDate: "Data de formação",
  activitiesDescription: "Descrição das atividades",
  einNumber: "EIN",
  llcUsAddressLine1: "Endereço linha 1",
  llcUsCity: "Cidade",
  llcUsState: "Estado",
  llcUsZip: "CEP",
  ownerEmail: "E-mail do proprietário",
  ownerFullLegalName: "Nome legal completo",
  ownerResidenceCountry: "País de residência",
  ownerCitizenshipCountry: "País de cidadania",
  ownerHomeAddressDifferent: "Endereço residencial diferente",
  llcFormationCostUsdCents: "Custo de formação (USD)",
  totalAssetsUsdCents: "Ativos totais (USD)",
  passportCopiesProvided: "Cópias do passaporte",
  articlesOfOrganizationProvided: "Articles of Organization",
  declarationAccepted: "Declaração aceita",
};

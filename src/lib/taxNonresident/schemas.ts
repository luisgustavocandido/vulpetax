/**
 * Validação Zod para formulário TAX (Não Residentes).
 */

import { z } from "zod";

/** Converte string de valor para centavos (aceita "1.234,56" e "1234.56") */
function parseUsdToCents(s: string | number | undefined | null): number | null {
  if (s == null || s === "") return null;
  if (typeof s === "number") return Math.round(s * 100);
  const t = String(s).trim();
  if (!t) return null;
  const normalized = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export const usdCentsSchema = z
  .union([
    z.number().int().min(0, "Valor não pode ser negativo"),
    z.string().transform((s) => parseUsdToCents(s)),
  ])
  .nullable()
  .optional();

/** Owner adicional (2-5). Validação completa no client (fullLegalName, residenceCountry, citizenshipCountry se preenchido). */
export const taxOwnerSchema = z.object({
  ownerIndex: z.number().int().min(2).max(5),
  email: z.string().optional(),
  fullLegalName: z.string().optional(),
  residenceCountry: z.string().optional(),
  citizenshipCountry: z.string().optional(),
  homeAddressDifferent: z.boolean().optional().default(false),
  usTaxId: z.string().optional(),
  foreignTaxId: z.string().optional(),
});

export const taxProfilePatchSchema = z.object({
  llcName: z.string().min(1, "Nome da LLC é obrigatório").optional().or(z.literal("")),
  formationDate: z.string().optional(),
  activitiesDescription: z
    .string()
    .min(1, "Descrição das atividades é obrigatória")
    .max(2000)
    .optional()
    .or(z.literal("")),
  einNumber: z.string().optional(),
  llcUsAddressLine1: z.string().max(2000).optional(),
  llcUsAddressLine2: z.string().max(2000).optional(),
  llcUsCity: z.string().optional(),
  llcUsState: z.string().optional(),
  llcUsZip: z.string().optional(),
  ownerEmail: z.string().email("E-mail inválido").optional().or(z.literal("")),
  ownerFullLegalName: z.string().optional(),
  ownerResidenceCountry: z.string().optional(),
  ownerCitizenshipCountry: z.string().optional(),
  ownerHomeAddressDifferent: z.boolean().optional(),
  ownerResidentialAddressLine1: z.string().max(500).optional(),
  ownerResidentialAddressLine2: z.string().max(500).optional(),
  ownerResidentialCity: z.string().max(200).optional(),
  ownerResidentialState: z.string().max(100).optional(),
  ownerResidentialPostalCode: z.string().max(50).optional(),
  ownerResidentialCountry: z.string().max(100).optional(),
  ownerUsTaxId: z.string().optional(),
  ownerForeignTaxId: z.string().optional(),
  llcFormationCostUsdCents: usdCentsSchema,
  hasAdditionalOwners: z.boolean().optional(),
  totalAssetsUsdCents: usdCentsSchema,
  hasUsBankAccounts: z.boolean().optional(),
  totalWithdrawalsUsdCents: usdCentsSchema,
  totalTransferredToLlcUsdCents: usdCentsSchema,
  totalWithdrawnFromLlcUsdCents: usdCentsSchema,
  personalExpensesPaidByCompanyUsdCents: usdCentsSchema,
  businessExpensesPaidPersonallyUsdCents: usdCentsSchema,
  passportCopiesProvided: z.boolean().optional(),
  articlesOfOrganizationProvided: z.boolean().optional(),
  einLetterProvided: z.boolean().optional(),
  additionalDocumentsProvided: z.boolean().optional(),
  additionalDocumentsNotes: z.string().max(2000).optional(),
  declarationAccepted: z.boolean().optional(),
  owners: z.array(taxOwnerSchema).optional(),
})
  .refine(
    (data) => {
      if (data.ownerHomeAddressDifferent !== true) return true;
      const line1 = data.ownerResidentialAddressLine1?.trim();
      const city = data.ownerResidentialCity?.trim();
      const state = data.ownerResidentialState?.trim();
      const postal = data.ownerResidentialPostalCode?.trim();
      const country = data.ownerResidentialCountry?.trim();
      return !!(line1 && city && state && postal && country);
    },
    {
      message: "Quando o endereço residencial é diferente, preencha Endereço, Cidade, Estado, Código postal e País",
      path: ["ownerResidentialAddressLine1"],
    }
  )
  .transform((data) => {
    const out = { ...data };
    // Se endereço residencial não aplicável, zerar os campos residential
    if (out.ownerHomeAddressDifferent !== true) {
      out.ownerResidentialAddressLine1 = undefined;
      out.ownerResidentialAddressLine2 = undefined;
      out.ownerResidentialCity = undefined;
      out.ownerResidentialState = undefined;
      out.ownerResidentialPostalCode = undefined;
      out.ownerResidentialCountry = undefined;
    }
    return out;
  });

export type TaxProfilePatch = z.infer<typeof taxProfilePatchSchema>;

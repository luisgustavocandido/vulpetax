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
    z.number().int().min(0),
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
  ownerUsTaxId: z.string().optional(),
  ownerForeignTaxId: z.string().optional(),
  llcFormationCostUsdCents: usdCentsSchema,
  hasAdditionalOwners: z.boolean().optional(),
  totalAssetsUsdCents: usdCentsSchema,
  hasUsBankAccounts: z.boolean().optional(),
  aggregateBalanceOver10k: z.boolean().optional(),
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
});

export type TaxProfilePatch = z.infer<typeof taxProfilePatchSchema>;

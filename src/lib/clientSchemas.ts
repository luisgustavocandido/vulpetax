import { z } from "zod";
import {
  ADDRESS_PROVIDER_VALUES,
  BILLING_PERIOD_VALUES,
  COMMERCIAL_SDR_VALUES,
  LINE_ITEM_KINDS,
  PARTNER_ROLES,
} from "@/db/schema";
import { LLC_CATEGORIES } from "@/constants/llcCategories";
import { US_STATES } from "@/constants/usStates";
const commercialSdrSchema = z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]);
const lineItemKindSchema = z.enum(LINE_ITEM_KINDS as unknown as [string, ...string[]]);
const partnerRoleSchema = z.enum(PARTNER_ROLES as unknown as [string, ...string[]]);
const billingPeriodSchema = z.enum(BILLING_PERIOD_VALUES as unknown as [string, ...string[]]);
const addressProviderSchema = z.enum(ADDRESS_PROVIDER_VALUES as unknown as [string, ...string[]]);

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const uuidOptional = z.string().uuid().optional();

/** Schema do item para API (POST/PATCH). Campo id = UUID do DB quando existir. */
export const lineItemInputSchema = z
  .object({
    id: uuidOptional,
    kind: lineItemKindSchema,
    description: z.string().max(2000).default(""),
    valueCents: z.coerce.number().int().min(0, "Valor deve ser >= 0"),
    saleDate: z
      .union([z.string().regex(isoDateRegex), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && String(v).trim() ? String(v).trim() : null)),
    commercial: z.string().nullable().optional(),
    sdr: z.string().nullable().optional(),
    billingPeriod: billingPeriodSchema.nullable().optional(),
    expirationDate: z.string().regex(isoDateRegex).nullable().optional(),
    addressProvider: addressProviderSchema.nullable().optional(),
    addressLine1: z.string().max(500).nullable().optional(),
    addressLine2: z.string().max(500).nullable().optional(),
    steNumber: z.string().max(20).nullable().optional(),
    llcCategory: z.string().nullable().optional(),
    llcState: z.string().max(2).nullable().optional(),
    llcCustomCategory: z.string().max(200).nullable().optional(),
    paymentMethod: z.string().max(100).nullable().optional(),
    paymentMethodCustom: z.string().max(200).nullable().optional(),
  })
  .superRefine((item, ctx) => {
    // Validação de paymentMethod (obrigatório para todos os itens)
    if (!item.paymentMethod || String(item.paymentMethod).trim().length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Forma de pagamento é obrigatória",
        path: ["paymentMethod"],
      });
    } else if (item.paymentMethod === "Outro") {
      if (!item.paymentMethodCustom || String(item.paymentMethodCustom).trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Especifique a forma de pagamento",
          path: ["paymentMethodCustom"],
        });
      }
    }

    // Validações para LLC
    if (item.kind === "LLC") {
      if (!item.llcCategory || String(item.llcCategory).trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Categoria LLC é obrigatória",
          path: ["llcCategory"],
        });
      } else if (!LLC_CATEGORIES.includes(item.llcCategory as (typeof LLC_CATEGORIES)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Categoria LLC inválida",
          path: ["llcCategory"],
        });
      }
      if (!item.llcState || String(item.llcState).trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Estado da LLC é obrigatório",
          path: ["llcState"],
        });
      } else {
        const validCodes = US_STATES.map((s) => s.code) as string[];
        if (!validCodes.includes(item.llcState.toUpperCase().slice(0, 2))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Estado inválido (use sigla de 2 letras)",
            path: ["llcState"],
          });
        }
      }
      if (item.llcCategory === "Personalizado") {
        if (!item.llcCustomCategory || String(item.llcCustomCategory).trim().length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Categoria personalizada é obrigatória quando categoria é 'Personalizado'",
            path: ["llcCustomCategory"],
          });
        }
      } else {
        if (item.llcCustomCategory != null && String(item.llcCustomCategory).trim().length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Categoria personalizada deve estar vazia quando categoria não é 'Personalizado'",
            path: ["llcCustomCategory"],
          });
        }
      }
      return;
    }
    // Validações para Endereço
    if (item.kind !== "Endereco") {
      // Para outros tipos, forçar campos LLC como null
      if (item.llcCategory != null || item.llcState != null || item.llcCustomCategory != null) {
        // Não adicionar erro, apenas garantir que serão null no servidor
      }
      return;
    }
    if (!item.billingPeriod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Periodicidade é obrigatória para Endereço",
        path: ["billingPeriod"],
      });
      return;
    }
    if (item.billingPeriod === "Anual") {
      if (!item.saleDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sale Date é obrigatório para Endereço com periodicidade Anual",
          path: ["saleDate"],
        });
      }
    } else {
      if (item.expirationDate != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expiração deve estar vazia para periodicidade Mensal",
          path: ["expirationDate"],
        });
      }
    }
    if (!item.addressProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Endereço é obrigatório (New Mexico, Florida, Próprio ou Agente Registrado)",
        path: ["addressProvider"],
      });
      return;
    }
    if (item.addressProvider === "New Mexico") {
      if (!item.steNumber || String(item.steNumber).trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Número da STE é obrigatório para New Mexico",
          path: ["steNumber"],
        });
      }
    }
    if (item.addressProvider === "Próprio" || item.addressProvider === "Agente Registrado") {
      if (!item.addressLine1 || String(item.addressLine1).trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Endereço (linha 1) é obrigatório",
          path: ["addressLine1"],
        });
      }
      if (!item.addressLine2 || String(item.addressLine2).trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Endereço (linha 2) é obrigatório",
          path: ["addressLine2"],
        });
      }
    }
  });

/** @deprecated Use lineItemInputSchema; mantido para compatibilidade de tipos. */
export const lineItemSchema = lineItemInputSchema;

const partnerAddressFields = {
  email: z.string().email("E-mail inválido"),
  addressLine1: z.string().min(1, "Endereço (Linha 1) é obrigatório"),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(1, "Estado/Província é obrigatório"),
  postalCode: z.string().min(1, "Código postal é obrigatório"),
  country: z.string().min(1, "País é obrigatório"),
};

const partnerAddressFieldsOptional = {
  email: z
    .union([z.string().email("E-mail inválido"), z.literal(""), z.undefined(), z.null()])
    .optional(),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(255).optional().nullable(),
  state: z.string().max(255).optional().nullable(),
  postalCode: z.string().max(100).optional().nullable(),
  country: z.string().max(255).optional().nullable(),
};

export const partnerSchema = z.object({
  fullName: z.string().min(1, "Nome do sócio é obrigatório"),
  role: partnerRoleSchema,
  percentage: z
    .number()
    .min(0, "Percentual deve ser >= 0")
    .max(100, "Percentual deve ser <= 100"),
  phone: z.string().max(50).optional(),
  ...partnerAddressFields,
});

const partnerSchemaForUpdate = z.object({
  fullName: z.string().min(1, "Nome do sócio é obrigatório"),
  role: partnerRoleSchema,
  percentage: z
    .number()
    .min(0, "Percentual deve ser >= 0")
    .max(100, "Percentual deve ser <= 100"),
  phone: z.string().max(50).optional(),
  ...partnerAddressFieldsOptional,
});

const partnersSumRefine = (partners: { percentage: number }[]) => {
  const sum = partners.reduce((acc, p) => acc + p.percentage, 0);
  return sum <= 100;
};

const personalAddressFieldsOptional = {
  email: z
    .union([z.string().email("E-mail inválido"), z.literal(""), z.undefined(), z.null()])
    .optional(),
  personalAddressLine1: z.string().max(255).optional().nullable(),
  personalAddressLine2: z.string().max(255).optional().nullable(),
  personalCity: z.string().max(255).optional().nullable(),
  personalState: z.string().max(255).optional().nullable(),
  personalPostalCode: z.string().max(100).optional().nullable(),
  personalCountry: z.string().max(255).optional().nullable(),
};

export const createClientSchema = z
  .object({
    companyName: z.string().min(1, "Empresa é obrigatória").max(255),
    customerCode: z.string().max(100).optional(), // gerado automaticamente se omitido
    paymentDate: z.string().optional(), // ISO date "YYYY-MM-DD"
    commercial: commercialSdrSchema.optional(),
    sdr: commercialSdrSchema.optional(),
    businessType: z.string().min(1, "Tipo de negócio é obrigatório").max(255),
    /** @deprecated Use lineItems[].paymentMethod. Mantido para compatibilidade backwards. */
    paymentMethod: z.string().max(100).optional(),
    anonymous: z.boolean().optional().default(false),
    holding: z.boolean().optional().default(false),
    affiliate: z.boolean().optional().default(false),
    express: z.boolean().optional().default(false),
    notes: z.string().max(2000).optional(),
    ...personalAddressFieldsOptional,
    lineItems: z.array(lineItemInputSchema).optional().default([]),
    partners: z.array(partnerSchemaForUpdate).optional().default([]),
  })
  .refine(
    (data) => partnersSumRefine(data.partners ?? []),
    { message: "A soma das participações dos sócios não pode exceder 100%", path: ["partners"] }
  );

export const updateClientSchema = z
  .object({
    companyName: z.string().min(1, "Empresa é obrigatória").max(255).optional(),
    customerCode: z.string().max(100).optional(),
    paymentDate: z.string().optional(),
    commercial: commercialSdrSchema.optional(),
    sdr: commercialSdrSchema.optional(),
    businessType: z.string().min(1, "Tipo de negócio é obrigatório").max(255),
    /** @deprecated Use lineItems[].paymentMethod. Mantido para compatibilidade backwards. */
    paymentMethod: z.string().max(100).optional(),
    anonymous: z.boolean().optional(),
    holding: z.boolean().optional(),
    affiliate: z.boolean().optional(),
    express: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
    ...personalAddressFieldsOptional,
    lineItems: z.array(lineItemInputSchema).optional(),
    partners: z.array(partnerSchemaForUpdate).optional(),
  })
  .refine(
    (data) => !data.partners || partnersSumRefine(data.partners),
    { message: "A soma das participações dos sócios não pode exceder 100%", path: ["partners"] }
  );

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type LineItemInput = z.infer<typeof lineItemInputSchema>;
export type PartnerInput = z.infer<typeof partnerSchema>;

/** Converte percentual 0-100 para basis points (0-10000) */
export function percentToBasisPoints(p: number): number {
  return Math.round(p * 100);
}

/** Converte basis points para percentual */
export function basisPointsToPercent(bp: number): number {
  return bp / 100;
}

import { z } from "zod";
import {
  COMMERCIAL_SDR_VALUES,
  LINE_ITEM_KINDS,
  PARTNER_ROLES,
} from "@/db/schema";

const commercialSdrSchema = z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]);
const lineItemKindSchema = z.enum(LINE_ITEM_KINDS as unknown as [string, ...string[]]);
const partnerRoleSchema = z.enum(PARTNER_ROLES as unknown as [string, ...string[]]);

export const lineItemSchema = z.object({
  kind: lineItemKindSchema,
  description: z.string().min(1, "Descrição é obrigatória").max(2000, "Descrição muito longa"),
  valueCents: z.number().int().min(0, "Valor deve ser >= 0"),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const partnerSchema = z.object({
  fullName: z.string().min(1, "Nome do sócio é obrigatório"),
  role: partnerRoleSchema,
  percentage: z
    .number()
    .min(0, "Percentual deve ser >= 0")
    .max(100, "Percentual deve ser <= 100"),
  phone: z.string().max(50).optional(),
});

const partnersSumRefine = (partners: { percentage: number }[]) => {
  const sum = partners.reduce((acc, p) => acc + p.percentage, 0);
  return sum <= 100;
};

export const createClientSchema = z
  .object({
    companyName: z.string().min(1, "Empresa é obrigatória").max(255),
    customerCode: z.string().max(100).optional(), // gerado automaticamente se omitido
    paymentDate: z.string().optional(), // ISO date "YYYY-MM-DD"
    commercial: commercialSdrSchema.optional(),
    sdr: commercialSdrSchema.optional(),
    businessType: z.string().max(255).optional(),
    paymentMethod: z.string().max(100).optional(),
    anonymous: z.boolean().optional().default(false),
    holding: z.boolean().optional().default(false),
    affiliate: z.boolean().optional().default(false),
    express: z.boolean().optional().default(false),
    notes: z.string().max(2000).optional(),
    items: z.array(lineItemSchema).optional().default([]),
    partners: z.array(partnerSchema).optional().default([]),
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
    businessType: z.string().max(255).optional(),
    paymentMethod: z.string().max(100).optional(),
    anonymous: z.boolean().optional(),
    holding: z.boolean().optional(),
    affiliate: z.boolean().optional(),
    express: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
    items: z.array(lineItemSchema).optional(),
    partners: z.array(partnerSchema).optional(),
  })
  .refine(
    (data) => !data.partners || partnersSumRefine(data.partners),
    { message: "A soma das participações dos sócios não pode exceder 100%", path: ["partners"] }
  );

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type PartnerInput = z.infer<typeof partnerSchema>;

/** Converte percentual 0-100 para basis points (0-10000) */
export function percentToBasisPoints(p: number): number {
  return Math.round(p * 100);
}

/** Converte basis points para percentual */
export function basisPointsToPercent(bp: number): number {
  return bp / 100;
}

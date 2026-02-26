import { z } from "zod";

export const listCustomerCompaniesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(255).optional(),
  sort: z
    .enum(["name_asc", "name_desc", "recent"])
    .optional()
    .default("name_asc"),
});

export type ListCustomerCompaniesQuery = z.infer<typeof listCustomerCompaniesQuerySchema>;

export const listCustomerServicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(255).optional(),
  kind: z.string().trim().max(50).optional(),
  state: z.string().trim().max(2).optional(),
  saleFrom: z.string().trim().max(10).optional(),
  saleTo: z.string().trim().max(10).optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  companyId: z.string().uuid().optional(),
  sort: z
    .enum(["saleDate_desc", "saleDate_asc", "value_desc", "value_asc"])
    .optional()
    .default("saleDate_desc"),
});

export type ListCustomerServicesQuery = z.infer<typeof listCustomerServicesQuerySchema>;

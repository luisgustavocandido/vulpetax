import { z } from "zod";

export const billingOverviewQuerySchema = z.object({
  dueFrom: z.string().trim().max(10).optional(),
  dueTo: z.string().trim().max(10).optional(),
  createdFrom: z.string().trim().max(32).optional(),
  createdTo: z.string().trim().max(32).optional(),
});

export type BillingOverviewQuery = z.infer<typeof billingOverviewQuerySchema>;

export const chargeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(255).optional(),
  status: z.string().trim().max(20).optional(),
  dueFrom: z.string().trim().max(10).optional(),
  dueTo: z.string().trim().max(10).optional(),
  paidFrom: z.string().trim().max(32).optional(),
  paidTo: z.string().trim().max(32).optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  companyId: z.string().uuid().optional(),
  sort: z
    .enum([
      "dueDate_desc",
      "dueDate_asc",
      "value_desc",
      "value_asc",
      "createdAt_desc",
      "createdAt_asc",
    ])
    .optional()
    .default("dueDate_desc"),
});

export type ChargeListQuery = z.infer<typeof chargeListQuerySchema>;

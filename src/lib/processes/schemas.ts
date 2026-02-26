import { z } from "zod";

const statusSchema = z.enum(["open", "in_progress", "done"]);
const stepStatusSchema = z.enum(["pending", "in_progress", "done"]);

export const listProcessesQuerySchema = z.object({
  q: z.string().trim().min(1).max(255).optional(),
  status: statusSchema.optional(),
  assignee: z.string().trim().min(1).max(100).optional(),
  department: z.string().trim().min(1).max(50).optional(),
  kind: z.string().trim().min(1).max(50).optional(),
  paymentDateFrom: z.string().trim().max(10).optional(),
  paymentDateTo: z.string().trim().max(10).optional(),
  sort: z
    .enum([
      "updatedAt_desc",
      "progress_asc",
      "progress_desc",
      "company_asc",
      "paymentDate_asc",
      "paymentDate_desc",
    ])
    .optional()
    .default("updatedAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListProcessesQuery = z.infer<typeof listProcessesQuerySchema>;

export const createProcessSchema = z.object({
  clientId: z.string().uuid(),
  lineItemId: z.string().uuid().optional(),
  kind: z.string().trim().min(1).max(50).default("LLC_PROCESS"),
});

export type CreateProcessInput = z.infer<typeof createProcessSchema>;

export const updateStepStatusSchema = z.object({
  status: stepStatusSchema,
});

export type UpdateStepStatusInput = z.infer<typeof updateStepStatusSchema>;


import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD");

export const executiveKpisQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  timezone: z.string().max(64).optional().default("UTC"),
});

export type ExecutiveKpisQuery = z.infer<typeof executiveKpisQuerySchema>;

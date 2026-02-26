import { z } from "zod";

const uuidSchema = z.string().uuid("personGroupId deve ser um UUID válido");

export const mergePersonGroupsBodySchema = z
  .object({
    targetPersonGroupId: uuidSchema,
    sourcePersonGroupIds: z
      .array(uuidSchema)
      .min(1, "É necessário ao menos um grupo de origem"),
  })
  .refine(
    (data) => !data.sourcePersonGroupIds.includes(data.targetPersonGroupId),
    {
      message: "O grupo destino não pode estar na lista de origens",
      path: ["targetPersonGroupId"],
    }
  )
  .transform((data) => ({
    ...data,
    sourcePersonGroupIds: Array.from(new Set(data.sourcePersonGroupIds)),
  }));

export type MergePersonGroupsBody = z.infer<typeof mergePersonGroupsBodySchema>;

export const autoMergeBodySchema = z.object({
  minScore: z.number().min(0).max(1).optional().default(0.9),
  maxMerges: z.number().int().min(1).max(500).optional().default(200),
  dryRun: z.boolean().optional().default(true),
});

export type AutoMergeBody = z.infer<typeof autoMergeBodySchema>;

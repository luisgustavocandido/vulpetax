import { z } from "zod";

const addressSchema = z.object({
  line1: z.string().min(1, "Endereço (linha 1) é obrigatório").max(500),
  line2: z.string().max(500).optional().nullable(),
  city: z.string().min(1, "Cidade é obrigatória").max(255),
  stateProvince: z.string().min(1, "Estado/Província é obrigatório").max(255),
  postalCode: z.string().min(1, "Código postal é obrigatório").max(100),
  country: z.string().min(1, "País é obrigatório").max(255),
});

export const createCustomerSchema = z.object({
  fullName: z.string().min(1, "Nome completo é obrigatório").max(255),
  givenName: z.string().min(1, "Given name é obrigatório").max(255),
  surName: z.string().min(1, "Sobrenome é obrigatório").max(255),
  citizenshipCountry: z.string().min(1, "Cidadania é obrigatória").max(255),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  address: addressSchema,
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateCustomerAddress = z.infer<typeof addressSchema>;

/** Payload para edição de customer (mesmo shape do create; form envia completo). */
export const updateCustomerSchema = createCustomerSchema;

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

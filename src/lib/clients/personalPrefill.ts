import type { ClientFormData } from "@/components/ClientForm";

/**
 * Payload retornado por GET /api/clients/:id (campos usados para prefill).
 */
export type ExistingClientPayload = {
  email?: string | null;
  personalAddressLine1?: string | null;
  personalAddressLine2?: string | null;
  personalCity?: string | null;
  personalState?: string | null;
  personalPostalCode?: string | null;
  personalCountry?: string | null;
  partners?: Array<{
    fullName?: string | null;
    role?: string;
    percentage?: number;
    phone?: string | null;
    email?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }>;
};

/**
 * Mapeia o payload de um cliente existente (GET /api/clients/:id) para os campos
 * "dados pessoais" do formulário de novo cliente. Não inclui empresa, lineItems nem IDs.
 */
export function mapExistingClientToPersonalPrefill(
  payload: ExistingClientPayload
): Partial<ClientFormData> {
  const result: Partial<ClientFormData> = {
    email: payload.email?.trim() ?? "",
    personalAddressLine1: payload.personalAddressLine1?.trim() ?? "",
    personalAddressLine2: payload.personalAddressLine2?.trim() ?? "",
    personalCity: payload.personalCity?.trim() ?? "",
    personalState: payload.personalState?.trim() ?? "",
    personalPostalCode: payload.personalPostalCode?.trim() ?? "",
    personalCountry: payload.personalCountry?.trim() ?? "",
  };

  const partners = payload.partners ?? [];
  const principal =
    partners.find((p) => p.role === "SocioPrincipal") ?? partners[0];
  if (principal) {
    result.partners = [
      {
        fullName: principal.fullName?.trim() ?? "",
        role: (principal.role as "SocioPrincipal" | "Socio") ?? "Socio",
        percentage: Number(principal.percentage) || 0,
        phone: principal.phone?.trim() ?? "",
        email: principal.email?.trim() ?? "",
        isPayer: true,
        addressLine1: principal.addressLine1?.trim() ?? "",
        addressLine2: principal.addressLine2?.trim() ?? "",
        city: principal.city?.trim() ?? "",
        state: principal.state?.trim() ?? "",
        postalCode: principal.postalCode?.trim() ?? "",
        country: principal.country?.trim() ?? "",
      },
    ];
  }

  return result;
}

/**
 * Converte resposta da API (ou objeto cliente bruto) em dados 100% serializáveis
 * para passar do Server Component para ClientEditPage (RSC safe).
 * Garante: sem Date, BigInt, Decimal, Map/Set, funções, etc.
 */

/** Item de linha serializável (RSC safe). id presente quando item já existe no DB. */
export type SerializedLineItem = {
  id?: string;
  kind: string;
  description: string;
  valueCents: number;
  saleDate?: string;
  billingPeriod?: string;
  expirationDate?: string;
  commercial?: string;
  sdr?: string;
  addressProvider?: string;
  addressLine1?: string;
  addressLine2?: string;
  steNumber?: string;
  llcCategory?: string;
  llcState?: string;
  llcCustomCategory?: string;
  paymentMethod?: string;
  paymentMethodCustom?: string;
  meta?: Record<string, unknown> | null;
};

/** Sócio serializável (RSC safe). Inclui dados do customer quando é pagador. */
export type SerializedPartner = {
  fullName: string;
  role: string;
  percentage: number;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isPayer: boolean;
  customerId?: string | null;
  customer?: {
    id: string;
    fullName: string;
    givenName?: string;
    surName?: string;
    citizenshipCountry?: string;
    email: string | null;
    phone: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
};

/** Cliente inicial para edição — apenas primitivos e arrays serializáveis */
export type InitialClientForEdit = {
  companyName: string;
  customerCode?: string;
  personGroupId?: string | null;
  paymentDate: string;
  commercial: string;
  sdr: string;
  businessType: string;
  paymentMethod: string;
  anonymous: boolean;
  holding: boolean;
  affiliate: boolean;
  affiliateType: string | null;
  affiliateOtherText: string | null;
  express: boolean;
  notes: string;
  email: string;
  personalAddressLine1: string;
  personalAddressLine2: string;
  personalCity: string;
  personalState: string;
  personalPostalCode: string;
  personalCountry: string;
  einNumber: string;
  businessId: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  formationDate: string;
  annualReportDate: string;
  lineItems: SerializedLineItem[];
  partners: SerializedPartner[];
};

function toIsoDateString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return m ? value.slice(0, 10) : "";
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return "";
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function toBoolean(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
}

function serializeItem(raw: unknown): SerializedLineItem {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const saleDate = o.saleDate != null ? toIsoDateString(o.saleDate) : undefined;
  const expirationDate = o.expirationDate != null ? toIsoDateString(o.expirationDate) : undefined;
  const id = o.id != null && typeof o.id === "string" && /^[0-9a-f-]{36}$/i.test(o.id) ? o.id : undefined;
  return {
    ...(id ? { id } : {}),
    kind: toString(o.kind, "LLC"),
    description: toString(o.description, ""),
    valueCents: Math.max(0, Math.round(toNumber(o.valueCents))),
    saleDate: saleDate || undefined,
    billingPeriod: o.billingPeriod != null ? toString(o.billingPeriod) : undefined,
    expirationDate: expirationDate || undefined,
    commercial: o.commercial != null ? toString(o.commercial) : undefined,
    sdr: o.sdr != null ? toString(o.sdr) : undefined,
    addressProvider: o.addressProvider != null ? toString(o.addressProvider) : undefined,
    addressLine1: o.addressLine1 != null ? toString(o.addressLine1) : undefined,
    addressLine2: o.addressLine2 != null ? toString(o.addressLine2) : undefined,
    steNumber: o.steNumber != null ? toString(o.steNumber) : undefined,
    llcCategory: o.llcCategory != null ? toString(o.llcCategory) : undefined,
    llcState: o.llcState != null ? toString(o.llcState) : undefined,
    llcCustomCategory: o.llcCustomCategory != null ? toString(o.llcCustomCategory) : undefined,
    paymentMethod: o.paymentMethod != null ? toString(o.paymentMethod) : undefined,
    paymentMethodCustom: o.paymentMethodCustom != null ? toString(o.paymentMethodCustom) : undefined,
    meta: o.meta != null && typeof o.meta === "object" && !Array.isArray(o.meta)
      ? (o.meta as Record<string, unknown>)
      : undefined,
  };
}

function serializePartner(raw: unknown): SerializedPartner {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pct = toNumber(o.percentage);
  const customer = o.customer && typeof o.customer === "object" ? (o.customer as Record<string, unknown>) : null;
  return {
    fullName: toString(o.fullName, ""),
    role: toString(o.role, "Socio"),
    percentage: Math.min(100, Math.max(0, pct)),
    phone: o.phone != null ? toString(o.phone) : undefined,
    email: o.email != null ? toString(o.email) : undefined,
    addressLine1: o.addressLine1 != null ? toString(o.addressLine1) : undefined,
    addressLine2: o.addressLine2 != null ? toString(o.addressLine2) : undefined,
    city: o.city != null ? toString(o.city) : undefined,
    state: o.state != null ? toString(o.state) : undefined,
    postalCode: o.postalCode != null ? toString(o.postalCode) : undefined,
    country: o.country != null ? toString(o.country) : undefined,
    isPayer: toBoolean(o.isPayer),
    customerId: o.customerId != null && typeof o.customerId === "string" ? o.customerId : undefined,
    customer: customer
      ? {
          id: toString(customer.id, ""),
          fullName: toString(customer.fullName, ""),
          givenName: customer.givenName != null ? toString(customer.givenName) : undefined,
          surName: customer.surName != null ? toString(customer.surName) : undefined,
          citizenshipCountry: customer.citizenshipCountry != null ? toString(customer.citizenshipCountry) : undefined,
          email: customer.email != null ? toString(customer.email) : null,
          phone: customer.phone != null ? toString(customer.phone) : null,
          addressLine1: customer.addressLine1 != null ? toString(customer.addressLine1) : null,
          addressLine2: customer.addressLine2 != null ? toString(customer.addressLine2) : null,
          city: customer.city != null ? toString(customer.city) : null,
          stateProvince: customer.stateProvince != null ? toString(customer.stateProvince) : null,
          postalCode: customer.postalCode != null ? toString(customer.postalCode) : null,
          country: customer.country != null ? toString(customer.country) : null,
        }
      : undefined,
  };
}

/**
 * Converte um objeto cliente (ex.: resposta da API GET /api/clients/:id)
 * em InitialClientForEdit 100% serializável para RSC.
 * Datas viram string ISO (YYYY-MM-DD), números normalizados, sem Date/Decimal/Map/Set.
 */
export function clientToInitialClient(raw: unknown): InitialClientForEdit {
  const c = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const lineItems = Array.isArray(c.lineItems)
    ? c.lineItems.map(serializeItem)
    : Array.isArray(c.items)
      ? c.items.map(serializeItem)
      : [];
  const partners = Array.isArray(c.partners) ? c.partners.map(serializePartner) : [];

  return {
    companyName: toString(c.companyName, ""),
    customerCode: c.customerCode != null ? toString(c.customerCode) : undefined,
    personGroupId: c.personGroupId != null && typeof c.personGroupId === "string" ? c.personGroupId : undefined,
    paymentDate: toIsoDateString(c.paymentDate) || toString(c.paymentDate, ""),
    commercial: toString(c.commercial, ""),
    sdr: toString(c.sdr, ""),
    businessType: toString(c.businessType, ""),
    paymentMethod: toString(c.paymentMethod, ""),
    anonymous: toBoolean(c.anonymous),
    holding: toBoolean(c.holding),
    affiliate: toBoolean(c.affiliate),
    affiliateType: c.affiliateType != null ? toString(c.affiliateType) : null,
    affiliateOtherText: c.affiliateOtherText != null ? toString(c.affiliateOtherText) : null,
    express: toBoolean(c.express),
    notes: toString(c.notes, ""),
    email: toString(c.email, ""),
    personalAddressLine1: toString(c.personalAddressLine1, ""),
    personalAddressLine2: toString(c.personalAddressLine2, ""),
    personalCity: toString(c.personalCity, ""),
    personalState: toString(c.personalState, ""),
    personalPostalCode: toString(c.personalPostalCode, ""),
    personalCountry: toString(c.personalCountry, ""),
    einNumber: toString(c.einNumber, ""),
    businessId: toString(c.businessId, ""),
    companyAddressLine1: toString(c.companyAddressLine1, ""),
    companyAddressLine2: toString(c.companyAddressLine2, ""),
    formationDate: toIsoDateString(c.formationDate) || toString(c.formationDate, ""),
    annualReportDate: toIsoDateString(c.annualReportDate) || toString(c.annualReportDate, ""),
    lineItems,
    partners,
  };
}

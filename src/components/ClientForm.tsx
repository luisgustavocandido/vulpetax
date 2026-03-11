"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BILLING_PERIOD_VALUES,
  COMMERCIAL_SDR_VALUES,
  LINE_ITEM_KINDS,
  PARTNER_ROLES,
} from "@/db/schema";
import { parsePhoneForDisplay } from "@/lib/countryCodes";
import { SearchableCountrySelect } from "./SearchableCountrySelect";
import { CountrySelectForAddress } from "./CountrySelectForAddress";
import { BUSINESS_TYPES } from "@/constants/businessTypes";
import { BusinessTypeCombobox } from "./BusinessTypeCombobox";
import { PAYMENT_METHODS } from "@/constants/paymentMethods";
import { addOneMonth } from "@/lib/dates/addOneMonth";
import { addOneYear } from "@/lib/dates/addOneYear";
import { lineItemFromApi, ADDRESS_PROVIDER_OPTIONS } from "@/types/lineItems";
import { LLC_CATEGORIES } from "@/constants/llcCategories";
import { USStateCombobox } from "./USStateCombobox";

const ADDRESS_NM_LINE2 = "Clovis, NM, 88101";
const ADDRESS_FL_LINE1 = "6407 Magnolia St";
const ADDRESS_FL_LINE2 = "Milton, FL, 32570";

/** Opções fixas de Descrição quando Tipo = Serviço Adicional */
const SERVICO_ADICIONAL_DESCRIPTION_OPTIONS = [
  "ITIN",
  "Página WEB + Dominio + E-mail (1 ano)",
  "Manager",
  "Conta Pessoal (Truist Bank)",
] as const;

/** Opções fixas de Descrição quando Tipo = Banco Tradicional */
const BANCO_TRADICIONAL_DESCRIPTION_OPTIONS = [
  "WAB",
  "PNB",
  "Truist Bank",
  "Ibanera",
  "Euro Exchange",
  "Chase Bank",
] as const;

const lineItemFormSchema = z.object({
  dbId: z.string().uuid().optional(),
  kind: z.enum(LINE_ITEM_KINDS as unknown as [string, ...string[]]),
  description: z.string().max(500).optional(),
  valueCents: z.number().int().min(0),
  saleDate: z.string().nullable().optional(),
  billingPeriod: z.enum(BILLING_PERIOD_VALUES as unknown as [string, ...string[]]).nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  commercial: z.string().nullable().optional(),
  sdr: z.string().nullable().optional(),
  addressProvider: z.enum(ADDRESS_PROVIDER_OPTIONS as unknown as [string, ...string[]]).nullable().optional(),
  addressLine1: z.string().max(500).nullable().optional(),
  addressLine2: z.string().max(500).nullable().optional(),
  steNumber: z.string().max(20).nullable().optional(),
  llcCategory: z.string().nullable().optional(),
  llcState: z.string().nullable().optional(),
  llcCustomCategory: z.string().max(200).nullable().optional(),
  paymentMethod: z.string().max(100).nullable().optional(),
  paymentMethodCustom: z.string().max(200).nullable().optional(),
}).superRefine((item, ctx) => {
  // Validação de paymentMethod (obrigatório para todos os itens)
  if (!item.paymentMethod || String(item.paymentMethod).trim().length < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Forma de pagamento é obrigatória", path: ["paymentMethod"] });
  } else if (item.paymentMethod === "Outro") {
    if (!item.paymentMethodCustom || String(item.paymentMethodCustom).trim().length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Especifique a forma de pagamento", path: ["paymentMethodCustom"] });
    }
  }
  // Validação para Mensalidade: descrição deve ser Founder ou Traditional
  if (item.kind === "Mensalidade") {
    if (!item.description || (item.description !== "Founder" && item.description !== "Traditional")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione Founder ou Traditional", path: ["description"] });
    }
    return;
  }
  // Validação para Gateway: descrição deve ser Stripe ou Paypal
  if (item.kind === "Gateway") {
    if (!item.description || (item.description !== "Stripe" && item.description !== "Paypal")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione Stripe ou Paypal", path: ["description"] });
    }
    return;
  }
  // Validação para Serviço Adicional: descrição deve ser uma das opções fixas
  if (item.kind === "ServicoAdicional") {
    if (!item.description || !SERVICO_ADICIONAL_DESCRIPTION_OPTIONS.includes(item.description as (typeof SERVICO_ADICIONAL_DESCRIPTION_OPTIONS)[number])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione uma das opções de Serviço Adicional", path: ["description"] });
    }
    return;
  }
  // Validação para Banco Tradicional: descrição deve ser uma das opções fixas
  if (item.kind === "BancoTradicional") {
    if (!item.description || !BANCO_TRADICIONAL_DESCRIPTION_OPTIONS.includes(item.description as (typeof BANCO_TRADICIONAL_DESCRIPTION_OPTIONS)[number])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione uma das opções de Banco Tradicional", path: ["description"] });
    }
    return;
  }
  // Validações para LLC
  if (item.kind === "LLC") {
    if (!item.llcCategory || String(item.llcCategory).trim().length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Categoria LLC é obrigatória", path: ["llcCategory"] });
    }
    if (!item.llcState || String(item.llcState).trim().length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Estado da LLC é obrigatório", path: ["llcState"] });
    }
    if (item.llcCategory === "Personalizado") {
      if (!item.llcCustomCategory || String(item.llcCustomCategory).trim().length < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Categoria personalizada é obrigatória", path: ["llcCustomCategory"] });
      }
    }
    return;
  }
  // Validações para outros tipos (exceto Endereço)
  if (item.kind !== "Endereco" && (!item.description || String(item.description).trim().length < 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Descrição obrigatória", path: ["description"] });
  }
  if (item.kind !== "Endereco") return;
  if (!item.billingPeriod) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Periodicidade é obrigatória para Endereço", path: ["billingPeriod"] });
    return;
  }
  if (item.billingPeriod === "Anual" && !item.saleDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sale Date é obrigatório para Endereço Anual", path: ["saleDate"] });
  }
  if (item.billingPeriod === "Mensal" && !item.saleDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sale Date é obrigatório para Endereço Mensal", path: ["saleDate"] });
  }
  if (item.billingPeriod === "Mensal") {
    if (!item.expirationDate || String(item.expirationDate).trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expiração é obrigatória para Periodicidade Mensal", path: ["expirationDate"] });
    } else if (item.saleDate && item.expirationDate < item.saleDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expiração deve ser >= Sale Date", path: ["expirationDate"] });
    }
  }
  if (!item.addressProvider) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione o endereço (New Mexico, Florida, Próprio ou Agente Registrado)", path: ["addressProvider"] });
    return;
  }
  if (item.addressProvider === "New Mexico") {
    if (!item.steNumber || String(item.steNumber).trim().length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Número da STE é obrigatório para New Mexico", path: ["steNumber"] });
    }
  }
  if (item.addressProvider === "Próprio" || item.addressProvider === "Agente Registrado") {
    if (!item.addressLine1 || String(item.addressLine1).trim().length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Endereço (linha 1) é obrigatório", path: ["addressLine1"] });
    }
    if (!item.addressLine2 || String(item.addressLine2).trim().length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Endereço (linha 2) é obrigatório", path: ["addressLine2"] });
    }
  }
});

const customerInlineFormSchema = z.object({
  fullName: z.string().min(1, "Nome completo obrigatório"),
  givenName: z.string().min(1, "Given name obrigatório"),
  surName: z.string().min(1, "Sobrenome obrigatório"),
  citizenshipCountry: z.string().min(1, "Cidadania obrigatória"),
  phone: z.string().optional().nullable(),
  email: z.string().min(1, "E-mail obrigatório").email("E-mail inválido"),
  address: z.object({
    line1: z.string().min(1, "Endereço linha 1 obrigatório"),
    line2: z.string().optional().nullable(),
    city: z.string().min(1, "Cidade obrigatória"),
    stateProvince: z.string().min(1, "Estado obrigatório"),
    postalCode: z.string().min(1, "Código postal obrigatório"),
    country: z.string().min(1, "País obrigatório"),
  }),
});

const partnerSchema = z.object({
  fullName: z.string().min(1, "Nome obrigatório"),
  role: z.enum(PARTNER_ROLES as unknown as [string, ...string[]]),
  percentage: z.number().min(0).max(100),
  phone: z.string().optional(),
  email: z.string().optional(),
  isPayer: z.boolean().optional().default(false),
  customerId: z.string().uuid().optional().nullable(),
  customerInline: customerInlineFormSchema.optional().nullable(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

const schema = z
  .object({
    companyName: z.string().min(1, "Empresa é obrigatória").max(255),
    customerCode: z.string().max(100).optional(),
    commercial: z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]).optional(),
    sdr: z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]).optional(),
    businessType: z.string().min(1, "Tipo de negócio é obrigatório").max(255),
    anonymous: z.boolean().default(false),
    holding: z.boolean().default(false),
    affiliate: z.boolean().default(false),
    affiliateType: z.string().max(50).nullable().optional(),
    affiliateOtherText: z.string().max(500).nullable().optional(),
    express: z.boolean().default(false),
    notes: z.string().optional(),
    /** Dados da empresa */
    einNumber: z.string().max(100).optional(),
    businessId: z.string().max(100).optional(),
    companyAddressLine1: z.string().max(500).optional(),
    companyAddressLine2: z.string().max(500).optional(),
    formationDate: z.string().optional(),
    annualReportDate: z.string().optional(),
    email: z.string().email("E-mail inválido").optional().or(z.literal("")),
    personalAddressLine1: z.string().optional(),
    personalAddressLine2: z.string().optional(),
    personalCity: z.string().optional(),
    personalState: z.string().optional(),
    personalPostalCode: z.string().optional(),
    personalCountry: z.string().optional(),
    lineItems: z.array(lineItemFormSchema).default([]),
    partners: z.array(partnerSchema).default([]),
  })
  .refine(
    (data) => data.partners.reduce((acc, p) => acc + p.percentage, 0) <= 100,
    { message: "A soma das participações não pode exceder 100%", path: ["partners"] }
  )
  .refine(
    (data) =>
      data.partners.length === 0 ||
      data.partners.filter((p) => p.isPayer === true).length === 1,
    { message: "Selecione exatamente 1 sócio como Cliente (Pagador).", path: ["partners"] }
  )
  .refine(
    (data) => !data.affiliate || (data.affiliateType && ["Parceiro", "Afiliado", "Outros"].includes(data.affiliateType)),
    { message: "Selecione o tipo de afiliado (Parceiro, Afiliado ou Outros).", path: ["affiliateType"] }
  )
  .refine(
    (data) =>
      !data.affiliate ||
      data.affiliateType !== "Outros" ||
      (data.affiliateOtherText != null && String(data.affiliateOtherText).trim().length > 0),
    { message: "Especifique o tipo de afiliado quando selecionar Outros.", path: ["affiliateOtherText"] }
  )
  .refine(
    (data) => {
      const payer = data.partners.find((p) => p.isPayer === true);
      if (!payer) return true;
      const hasId = !!payer.customerId && String(payer.customerId).trim().length > 0;
      const hasInline = payer.customerInline != null && typeof payer.customerInline === "object";
      return hasId || hasInline;
    },
    {
      message:
        "O Cliente (Pagador) deve ter um cliente vinculado: busque um existente ou cadastre novo.",
      path: ["partners"],
    }
  );

export type ClientFormData = z.infer<typeof schema>;

type ClientFormProps = {
  initialData?: Partial<ClientFormData> & { lineItems?: ClientFormData["lineItems"]; partners?: ClientFormData["partners"] };
  clientId?: string;
  /** Quando preenchido (modal "já possui empresa"), o POST envia para vincular novo cliente ao mesmo grupo da pessoa. */
  sourceClientId?: string;
  /** URL para redirecionar após salvar com sucesso. Default: /clients */
  successRedirectPath?: string;
};

const EMPTY_LINE_ITEM: ClientFormData["lineItems"][number] = {
  kind: "LLC",
  description: "",
  valueCents: 0,
  saleDate: null,
  commercial: null,
  sdr: null,
  billingPeriod: null,
  expirationDate: null,
  addressProvider: null,
  addressLine1: null,
  addressLine2: null,
  steNumber: null,
  llcCategory: null,
  llcState: null,
  llcCustomCategory: null,
  paymentMethod: null,
  paymentMethodCustom: null,
};

type CustomerFullDisplay = {
  id: string;
  fullName: string;
  givenName: string;
  surName: string;
  citizenshipCountry: string;
  phone: string | null;
  email: string;
  address: { line1: string; line2: string | null; city: string; stateProvince: string; postalCode: string; country: string };
};

type PartnerState = ClientFormData["partners"][0] & {
  payerMode?: "existing" | "new" | null;
  customerId?: string | null;
  customerInline?: z.infer<typeof customerInlineFormSchema> | null;
  customer?: { id: string; fullName: string; email: string | null; phone: string | null };
  customerFull?: CustomerFullDisplay | null;
};

const DEFAULT_CUSTOMER_INLINE: z.infer<typeof customerInlineFormSchema> = {
  fullName: "",
  givenName: "",
  surName: "",
  citizenshipCountry: "",
  phone: "",
  email: "",
  address: { line1: "", line2: null, city: "", stateProvince: "", postalCode: "", country: "" },
};

const EMPTY_PARTNER: PartnerState = {
  fullName: "",
  role: "Socio",
  percentage: 0,
  phone: "",
  email: "",
  isPayer: false,
  payerMode: null,
  customerId: null,
  customerInline: null,
  customerFull: null,
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

function formatCentsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
function dollarsToCents(s: string): number {
  const n = parseFloat(s.replace(",", ".")) || 0;
  return Math.round(n * 100);
}

function parseIsoDateToUtcDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mm - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function computeExpirationIsoFromSaleDate(iso: string): string | undefined {
  const sale = parseIsoDateToUtcDate(iso);
  if (!sale) return undefined;
  return addOneYear(sale).toISOString().slice(0, 10);
}

/** Expiração = Sale Date + 1 mês (para Periodicidade Mensal). */
function computeExpirationMensalIso(iso: string): string | undefined {
  const sale = parseIsoDateToUtcDate(iso);
  if (!sale) return undefined;
  return addOneMonth(sale).toISOString().slice(0, 10);
}

export function ClientForm({ initialData, clientId, sourceClientId, successRedirectPath = "/clients" }: ClientFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success"; message: string } | null>(null);
  const [addWizardOpen, setAddWizardOpen] = useState(false);
  const [addIsPayer, setAddIsPayer] = useState<"yes" | "no" | null>(null);
  const [addPayerMode, setAddPayerMode] = useState<"existing" | "new" | null>(null);
  const [partners, setPartners] = useState<PartnerState[]>(() => {
    if (initialData?.partners?.length) {
      const payerIdx = initialData.partners.findIndex((p) => (p as { isPayer?: boolean }).isPayer === true);
      const mapped = initialData.partners.map((p, idx) => {
        const q = p as PartnerState & { customerId?: string | null; customer?: { id: string; fullName: string; email: string | null; phone: string | null } };
        const base = {
          ...p,
          payerMode: q.customerId || q.customer ? "existing" : null,
          customerId: q.customerId ?? null,
          customerInline: null,
          customer: q.customer,
        } as PartnerState;
        if (idx === 0) {
          const wasPayerElsewhere = payerIdx >= 1;
          const payerSource = wasPayerElsewhere ? (initialData!.partners![payerIdx] as PartnerState & { customerId?: string | null; customer?: { id: string; fullName: string; email: string | null; phone: string | null } }) : null;
          return {
            ...base,
            isPayer: true,
            ...(payerSource && {
              payerMode: payerSource.customerId || payerSource.customer ? "existing" : null,
              customerId: payerSource.customerId ?? null,
              customer: payerSource.customer,
              customerInline: null,
            }),
          } as PartnerState;
        }
        return { ...base, isPayer: false, payerMode: null, customerId: null, customerInline: null, customer: undefined } as PartnerState;
      });
      return mapped;
    }
    return [{ ...EMPTY_PARTNER, isPayer: true }];
  });

  // Lógica para inicializar selectedBusinessType e customBusinessType
  const initialBusinessType = initialData?.businessType ?? "";
  const isBusinessTypeInList = initialBusinessType && BUSINESS_TYPES.includes(initialBusinessType as typeof BUSINESS_TYPES[number]);
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>(
    isBusinessTypeInList ? initialBusinessType : (initialBusinessType ? "Outro" : "")
  );
  const [customBusinessType, setCustomBusinessType] = useState<string>(
    isBusinessTypeInList ? "" : initialBusinessType
  );

  type CustomerLookupItem = {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    source?: "customer" | "person_group";
  };
  const [customerSearch, setCustomerSearch] = useState<{
    partnerIndex: number;
    q: string;
    items: CustomerLookupItem[];
    loading: boolean;
  } | null>(null);
  const [customerResolvingId, setCustomerResolvingId] = useState<string | null>(null);
  const [isAffiliate, setIsAffiliate] = useState(initialData?.affiliate ?? false);
  const [affiliateType, setAffiliateType] = useState<string>(initialData?.affiliateType ?? "");
  const [affiliateOtherText, setAffiliateOtherText] = useState<string>(initialData?.affiliateOtherText ?? "");
  const customerLookupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerLookupAbortRef = useRef<AbortController | null>(null);

  const fetchCustomerLookup = useCallback(async (q: string, partnerIndex: number) => {
    const qTrim = q.trim();
    if (!qTrim || qTrim.length < 2) {
      setCustomerSearch((prev) => (prev && prev.partnerIndex === partnerIndex ? { ...prev, q: qTrim, items: [], loading: false } : prev));
      return;
    }
    if (customerLookupAbortRef.current) customerLookupAbortRef.current.abort();
    customerLookupAbortRef.current = new AbortController();
    const signal = customerLookupAbortRef.current.signal;
    setCustomerSearch((prev) => (prev && prev.partnerIndex === partnerIndex ? { ...prev, q: qTrim, items: [], loading: true } : { partnerIndex, q: qTrim, items: [], loading: true }));
    try {
      const res = await fetch(`/api/customers/lookup?q=${encodeURIComponent(qTrim)}&limit=10`, { signal });
      const json = await res.json();
      const raw = (json.items ?? []) as CustomerLookupItem[];
      const personKey = (i: CustomerLookupItem) =>
        (i.email?.trim() && i.email.trim().toLowerCase()) ||
        (i.phone && i.phone.replace(/\D/g, "")) ||
        i.id;
      const items = Array.from(new Map(raw.map((i) => [personKey(i), i])).values());
      if (signal.aborted) return;
      setCustomerSearch((prev) => (prev && prev.partnerIndex === partnerIndex ? { ...prev, items, loading: false } : prev));
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setCustomerSearch((prev) => (prev ? { ...prev, items: [], loading: false } : null));
    }
  }, []);

  const scheduleCustomerLookup = useCallback((q: string, partnerIndex: number) => {
    if (customerLookupDebounceRef.current) clearTimeout(customerLookupDebounceRef.current);
    const qTrim = q.trim();
    if (qTrim.length < 2) {
      setCustomerSearch((prev) => (prev && prev.partnerIndex === partnerIndex ? { ...prev, q: qTrim, items: [], loading: false } : prev));
      return;
    }
    setCustomerSearch((prev) => (prev && prev.partnerIndex === partnerIndex ? { ...prev, q: qTrim } : { partnerIndex, q: qTrim, items: [], loading: false }));
    customerLookupDebounceRef.current = setTimeout(() => fetchCustomerLookup(qTrim, partnerIndex), 300);
  }, [fetchCustomerLookup]);

  const updatePartner = useCallback((i: number, field: keyof PartnerState, value: unknown) => {
    setPartners((prev) => {
      const next = [...prev];
      (next[i] as Record<string, unknown>)[field] = value;
      return next;
    });
  }, []);

  const fetchAndSetCustomerFull = useCallback((partnerIndex: number, customerId: string) => {
    fetch(`/api/customers/${encodeURIComponent(customerId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((full: CustomerFullDisplay | null) => {
        if (!full) return;
        setPartners((prev) =>
          prev.map((p2, idx) =>
            idx === partnerIndex ? { ...p2, customerFull: full } : p2
          )
        );
      })
      .catch(() => {});
  }, []);

  const selectLookupItem = useCallback(
    async (i: number, item: CustomerLookupItem) => {
      if (item.source === "person_group") {
        setCustomerResolvingId(item.id);
        try {
          const res = await fetch(`/api/customers/by-person/${encodeURIComponent(item.id)}`);
          if (!res.ok) return;
          const customer = (await res.json()) as { id: string; fullName: string; email: string | null; phone: string | null };
          setPartners((prev) =>
            prev.map((p2, idx) =>
              idx === i
                ? {
                    ...p2,
                    customerId: customer.id,
                    customer: { id: customer.id, fullName: customer.fullName, email: customer.email, phone: customer.phone },
                    payerMode: "existing" as const,
                    customerFull: null,
                  }
                : p2
            )
          );
          setCustomerSearch(null);
          fetchAndSetCustomerFull(i, customer.id);
        } finally {
          setCustomerResolvingId(null);
        }
      } else {
        updatePartner(i, "customerId", item.id);
        updatePartner(i, "customer", { id: item.id, fullName: item.fullName, email: item.email, phone: item.phone });
        updatePartner(i, "payerMode", "existing");
        updatePartner(i, "customerFull", null);
        setCustomerSearch(null);
        fetchAndSetCustomerFull(i, item.id);
      }
    },
    [updatePartner, fetchAndSetCustomerFull]
  );

  useEffect(() => {
    partners.forEach((p, idx) => {
      const ps = p as PartnerState;
      if (ps.customerId && !ps.customerFull) {
        fetchAndSetCustomerFull(idx, ps.customerId);
      }
    });
  }, [partners, fetchAndSetCustomerFull]);

  useEffect(() => {
    if (initialData?.affiliate != null) {
      setIsAffiliate(initialData.affiliate);
      if (!initialData.affiliate) {
        setAffiliateType("");
        setAffiliateOtherText("");
      }
    }
    if (initialData?.affiliateType != null) setAffiliateType(initialData.affiliateType);
    if (initialData?.affiliateOtherText != null) setAffiliateOtherText(initialData.affiliateOtherText);
  }, [initialData?.affiliate, initialData?.affiliateType, initialData?.affiliateOtherText]);

  const defaultValues: Partial<ClientFormData> = {
    companyName: initialData?.companyName ?? "",
    customerCode: initialData?.customerCode ?? "",
    commercial: initialData?.commercial ?? "",
    sdr: initialData?.sdr ?? "",
    businessType: initialData?.businessType ?? "",
    anonymous: initialData?.anonymous ?? false,
    holding: initialData?.holding ?? false,
    affiliate: initialData?.affiliate ?? false,
    affiliateType: initialData?.affiliateType ?? null,
    affiliateOtherText: initialData?.affiliateOtherText ?? null,
    express: initialData?.express ?? false,
    notes: initialData?.notes ?? "",
    einNumber: (initialData as Partial<ClientFormData> | undefined)?.einNumber ?? "",
    businessId: (initialData as Partial<ClientFormData> | undefined)?.businessId ?? "",
    companyAddressLine1: (initialData as Partial<ClientFormData> | undefined)?.companyAddressLine1 ?? "",
    companyAddressLine2: (initialData as Partial<ClientFormData> | undefined)?.companyAddressLine2 ?? "",
    formationDate: (initialData as Partial<ClientFormData> | undefined)?.formationDate ?? "",
    annualReportDate: (initialData as Partial<ClientFormData> | undefined)?.annualReportDate ?? "",
    email: initialData?.email ?? "",
    personalAddressLine1: initialData?.personalAddressLine1 ?? "",
    personalAddressLine2: initialData?.personalAddressLine2 ?? "",
    personalCity: initialData?.personalCity ?? "",
    personalState: initialData?.personalState ?? "",
    personalPostalCode: initialData?.personalPostalCode ?? "",
    personalCountry: initialData?.personalCountry ?? "",
    lineItems: (initialData?.lineItems ?? []).map((li) => {
      const item = lineItemFromApi(li);
      if (item.kind === "Endereco" && item.billingPeriod === "Mensal" && item.saleDate && (item.expirationDate == null || String(item.expirationDate).trim() === "")) {
        const computed = computeExpirationMensalIso(item.saleDate);
        if (computed) return { ...item, expirationDate: computed };
      }
      return item;
    }),
    partners: initialData?.partners ?? [EMPTY_PARTNER],
  };

  const form = useForm<ClientFormData>({
    resolver: zodResolver(schema) as import("react-hook-form").Resolver<ClientFormData>,
    defaultValues: {
      ...defaultValues,
      lineItems: defaultValues.lineItems?.length ? defaultValues.lineItems : [],
      partners: defaultValues.partners?.length ? defaultValues.partners : [EMPTY_PARTNER],
    },
  });

  const { control, register, watch, setValue, reset: formReset, getValues, formState: { errors: formErrors } } = form;
  const { fields: lineItemFields, append: appendLineItem, remove: removeLineItem } = useFieldArray({ control, name: "lineItems" });

  const watchedLineItems = watch("lineItems");
  const setLineItemExpiration = (index: number, saleDate: string | null, billingPeriod: string | null) => {
    if (!saleDate) {
      setValue(`lineItems.${index}.expirationDate`, null);
      return;
    }
    if (billingPeriod === "Mensal") {
      const exp = computeExpirationMensalIso(saleDate);
      setValue(`lineItems.${index}.expirationDate`, exp ?? null);
      return;
    }
    if (billingPeriod === "Anual") {
      const exp = computeExpirationIsoFromSaleDate(saleDate);
      setValue(`lineItems.${index}.expirationDate`, exp ?? null);
      return;
    }
    setValue(`lineItems.${index}.expirationDate`, null);
  };

  const hasExistingPayer = partners.some((p) => p.isPayer === true);

  function openAddPartnerWizard() {
    setAddWizardOpen(true);
    setAddIsPayer(null);
    setAddPayerMode(null);
  }
  function closeAddPartnerWizard() {
    setAddWizardOpen(false);
    setAddIsPayer(null);
    setAddPayerMode(null);
  }
  function confirmAddPartner() {
    if (addIsPayer === null) return;
    if (addIsPayer === "yes" && addPayerMode === null) return;
    let newPartner: PartnerState;
    if (addIsPayer === "no") {
      newPartner = { ...EMPTY_PARTNER, isPayer: false, payerMode: null, customerId: null, customerInline: null };
      setPartners((prev) => [...prev, newPartner]);
    } else {
      if (addPayerMode === "existing") {
        newPartner = { ...EMPTY_PARTNER, isPayer: true, payerMode: "existing", customerId: null, customerInline: null };
      } else {
        newPartner = { ...EMPTY_PARTNER, isPayer: true, payerMode: "new", customerId: null, customerInline: DEFAULT_CUSTOMER_INLINE };
      }
      setPartners((prev) => {
        const others = prev.map((p) => ({ ...p, isPayer: false, payerMode: null, customerId: null, customerInline: null, customer: undefined, customerFull: null }));
        return [...others, newPartner];
      });
    }
    closeAddPartnerWizard();
  }
  function removePartner(i: number) {
    setPartners((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, idx) => idx !== i);
      const removedWasPayer = prev[i].isPayer;
      if (removedWasPayer && next.length > 0) {
        return next.map((p, idx) => (idx === 0 ? { ...p, isPayer: true } : { ...p, isPayer: false, payerMode: null, customerId: null, customerInline: null, customerFull: null, customer: undefined }));
      }
      return next;
    });
  }
  function setPayer(index: number) {
    setPartners((prev) =>
      prev.map((p, i) =>
        i === index
          ? { ...p, isPayer: true }
          : { ...p, isPayer: false, payerMode: null, customerId: null, customerFull: null, customerInline: null, customer: undefined }
      )
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const lineItemsFromForm = getValues("lineItems");

    const validPartners = partners
      .map((p, i) => {
        const name = (fd.get(`partner_name_${i}`) ?? "").toString().trim();
        const pct = parseFloat((fd.get(`partner_pct_${i}`) ?? "0").toString()) || 0;
        const countryCode = (fd.get(`partner_phone_country_${i}`) ?? "+55").toString().trim();
        const localNumber = (fd.get(`partner_phone_${i}`) ?? "").toString().trim().replace(/\D/g, "");
        const phone = localNumber ? `${countryCode}${localNumber}` : undefined;
        const email = (fd.get(`partner_email_${i}`) ?? "").toString().trim() || undefined;
        const addressLine1 = (fd.get(`partner_addressLine1_${i}`) ?? "").toString().trim() || undefined;
        const addressLine2 = (fd.get(`partner_addressLine2_${i}`) ?? "").toString().trim() || undefined;
        const city = (fd.get(`partner_city_${i}`) ?? "").toString().trim() || undefined;
        const state = (fd.get(`partner_state_${i}`) ?? "").toString().trim() || undefined;
        const postalCode = (fd.get(`partner_postalCode_${i}`) ?? "").toString().trim() || undefined;
        const country = (fd.get(`partner_country_${i}`) ?? "").toString().trim() || undefined;
        const ps = p as PartnerState;
        const fullNameForPayload = ps.customer?.fullName ?? ps.customerInline?.fullName ?? name;
        if (!fullNameForPayload && !ps.customerId && !ps.customerInline) return null;
        const base = {
          fullName: fullNameForPayload || name || "—",
          role: p.role,
          percentage: pct,
          phone,
          email,
          isPayer: p.isPayer ?? false,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          country,
        };
        if (ps.isPayer && ps.customerId) return { ...base, customerId: ps.customerId };
        if (ps.isPayer && ps.customerInline) return { ...base, customerInline: ps.customerInline };
        return base;
      })
      .filter(Boolean) as ClientFormData["partners"];

    // Validação do campo businessType
    if (!selectedBusinessType || selectedBusinessType.trim() === "") {
      setFieldErrors({ businessType: "Tipo de negócio é obrigatório" });
      setSubmitting(false);
      return;
    }

    // Validação do campo customBusinessType quando "Outro" está selecionado
    if (selectedBusinessType === "Outro" && !customBusinessType.trim()) {
      setFieldErrors({ businessType: "Especifique o tipo de negócio" });
      setSubmitting(false);
      return;
    }

    // Determinar o valor final de businessType para salvar
    // Após as validações acima, sabemos que sempre terá um valor não vazio
    const finalBusinessType: string = selectedBusinessType === "Outro" 
      ? customBusinessType.trim() 
      : selectedBusinessType.trim();

    if (!finalBusinessType) {
      setFieldErrors({ businessType: "Tipo de negócio é obrigatório" });
      setSubmitting(false);
      return;
    }

    const data: ClientFormData = {
      companyName: (fd.get("companyName") ?? "").toString().trim(),
      customerCode: clientId ? (fd.get("customerCode") ?? "").toString().trim() : undefined,
      commercial: (fd.get("commercial") ?? "").toString().trim() || undefined,
      sdr: (fd.get("sdr") ?? "").toString().trim() || undefined,
      businessType: finalBusinessType,
      anonymous: fd.get("anonymous") === "on",
      holding: fd.get("holding") === "on",
      affiliate: isAffiliate,
      affiliateType: isAffiliate ? (affiliateType || null) : null,
      affiliateOtherText: isAffiliate && affiliateType === "Outros" ? (affiliateOtherText?.trim() || null) : null,
      express: fd.get("express") === "on",
      notes: (fd.get("notes") ?? "").toString().trim() || undefined,
      einNumber: (fd.get("einNumber") ?? "").toString().trim() || undefined,
      businessId: (fd.get("businessId") ?? "").toString().trim() || undefined,
      companyAddressLine1: (fd.get("companyAddressLine1") ?? "").toString().trim() || undefined,
      companyAddressLine2: (fd.get("companyAddressLine2") ?? "").toString().trim() || undefined,
      formationDate: (fd.get("formationDate") ?? "").toString().trim() || undefined,
      annualReportDate: (fd.get("annualReportDate") ?? "").toString().trim() || undefined,
      email: (fd.get("email") ?? "").toString().trim() || undefined,
      personalAddressLine1: (fd.get("personalAddressLine1") ?? "").toString().trim() || undefined,
      personalAddressLine2: (fd.get("personalAddressLine2") ?? "").toString().trim() || undefined,
      personalCity: (fd.get("personalCity") ?? "").toString().trim() || undefined,
      personalState: (fd.get("personalState") ?? "").toString().trim() || undefined,
      personalPostalCode: (fd.get("personalPostalCode") ?? "").toString().trim() || undefined,
      personalCountry: (fd.get("personalCountry") ?? "").toString().trim() || undefined,
      lineItems: lineItemsFromForm ?? [],
      partners: validPartners,
    };

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const errs: Partial<Record<string, string>> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path) errs[path] = issue.message;
      }
      setFieldErrors(errs);
      setSubmitting(false);
      return;
    }

    const payload = {
      ...parsed.data,
      ...(sourceClientId && !clientId ? { sourceClientId } : {}),
      lineItems: (parsed.data.lineItems ?? []).map((li) => ({
        id: li.dbId ?? undefined,
        kind: li.kind,
        description: li.description,
        valueCents: Number(li.valueCents),
        saleDate: li.saleDate ?? null,
        commercial: li.commercial ?? null,
        sdr: li.sdr ?? null,
        billingPeriod: li.kind === "Endereco" ? (li.billingPeriod ?? "Mensal") : null,
        expirationDate: li.kind === "Endereco" && (li.billingPeriod === "Mensal" || li.billingPeriod === "Anual") ? li.expirationDate : null,
        addressProvider: li.kind === "Endereco" ? (li.addressProvider ?? null) : null,
        addressLine1: li.kind === "Endereco" ? (li.addressLine1 ?? null) : null,
        addressLine2: li.kind === "Endereco" ? (li.addressLine2 ?? null) : null,
        steNumber: li.kind === "Endereco" ? (li.steNumber ?? null) : null,
        llcCategory: li.kind === "LLC" ? (li.llcCategory ?? null) : null,
        llcState: li.kind === "LLC" ? (li.llcState ?? null) : null,
        llcCustomCategory: li.kind === "LLC" && li.llcCategory === "Personalizado" ? (li.llcCustomCategory ?? null) : null,
        paymentMethod: li.paymentMethod ?? null,
        paymentMethodCustom: li.paymentMethod === "Outro" ? (li.paymentMethodCustom ?? null) : null,
      })),
      partners: parsed.data.partners ?? [],
    };
    if (process.env.NODE_ENV === "development") {
      console.log("[ClientForm] submit payload.lineItems count:", payload.lineItems.length, payload.lineItems);
      console.log("[ClientForm] submit payload.partners count:", payload.partners?.length ?? 0, payload.partners);
    }

    const url = clientId ? `/api/clients/${clientId}` : "/api/clients";
    const method = clientId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(json.error ?? "Erro ao salvar");
      const details = json.details as { fieldErrors?: Record<string, unknown> } | undefined;
      if (details?.fieldErrors) {
        const errs: Partial<Record<string, string>> = {};
        const collect = (errObj: unknown, prefix: string) => {
          if (!errObj || typeof errObj !== "object") return;
          for (const [k, v] of Object.entries(errObj as Record<string, unknown>)) {
            if (k === "_errors") continue;
            const path = prefix ? `${prefix}.${k}` : k;
            if (Array.isArray(v) && typeof v[0] === "string") {
              errs[path] = v[0];
            } else if (Array.isArray(v)) {
              v.forEach((item, i) => collect(item, `${path}.${i}`));
            } else if (v && typeof v === "object") {
              collect(v, path);
            }
          }
        };
        collect(details.fieldErrors, "");
        setFieldErrors(errs);
      }
      setSubmitting(false);
      return;
    }

    const responseClient = (json as { client?: { lineItems?: Array<{ id?: string; kind?: string; description?: string; valueCents?: number; saleDate?: string | null; commercial?: string | null; sdr?: string | null; billingPeriod?: string | null; expirationDate?: string | null }>; partners?: ClientFormData["partners"]; [k: string]: unknown }; customerReused?: boolean }).client;
    const customerReused = (json as { customerReused?: boolean }).customerReused === true;
    if (responseClient && Array.isArray(responseClient.lineItems)) {
      formReset({
        ...responseClient,
        lineItems: responseClient.lineItems.map((li) => lineItemFromApi(li)),
        partners: responseClient.partners ?? partners,
      });
    }
    if (customerReused) {
      setToast({ type: "success", message: "Já existia um cliente com este email. Vinculamos automaticamente." });
      setTimeout(() => setToast(null), 4000);
    }
    router.push(successRedirectPath);
    // Não chamar router.refresh() aqui: push já navega; refresh pode causar edge bugs de RSC.
    // Para atualizar a lista, o PATCH invalida cache (revalidatePath) no server.
  }

  const commercialOptions = COMMERCIAL_SDR_VALUES;
  const kindLabels: Record<string, string> = {
    LLC: "LLC",
    Endereco: "Endereço",
    Mensalidade: "Mensalidade",
    Gateway: "Gateway",
    ServicoAdicional: "Serviço Adicional",
    BancoTradicional: "Banco Tradicional",
    Outro: "Outro",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
          {fieldErrors.lineItems && (
            <p className="mt-2 font-medium">{fieldErrors.lineItems}</p>
          )}
        </div>
      )}
      {toast && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-100">
          {toast.message}
        </div>
      )}

      {/* EMPRESA */}
      <section className="space-y-4">
        <h2 className="border-b border-gray-200 pb-2 text-base font-semibold uppercase tracking-wide text-gray-600">
          Empresa
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
              Empresa *
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              defaultValue={defaultValues.companyName}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {fieldErrors.companyName && <p className="mt-1 text-sm text-red-600">{fieldErrors.companyName}</p>}
          </div>
          {clientId && (
            <div>
              <label htmlFor="customerCode" className="block text-sm font-medium text-gray-700">
                Código do cliente
              </label>
              <input
                id="customerCode"
                name="customerCode"
                type="text"
                defaultValue={defaultValues.customerCode}
                readOnly
                className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
              />
            </div>
          )}
          <div>
            <label htmlFor="commercial" className="block text-sm font-medium text-gray-700">
              Comercial
            </label>
            <select
              id="commercial"
              name="commercial"
              defaultValue={defaultValues.commercial}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Selecione</option>
              {commercialOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sdr" className="block text-sm font-medium text-gray-700">
              SDR
            </label>
            <select
              id="sdr"
              name="sdr"
              defaultValue={defaultValues.sdr}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Selecione</option>
              {commercialOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="businessType" className="block text-sm font-medium text-gray-700">
              Tipo de Negócio *
            </label>
            <div className="mt-1">
              <BusinessTypeCombobox
                value={selectedBusinessType || null}
                options={BUSINESS_TYPES}
                onChange={(value) => {
                  setSelectedBusinessType(value);
                  if (value !== "Outro") {
                    setCustomBusinessType("");
                  }
                }}
                placeholder="Selecione o tipo de negócio…"
                disabled={submitting}
                error={fieldErrors.businessType && selectedBusinessType !== "Outro" ? fieldErrors.businessType : undefined}
              />
            </div>
            {selectedBusinessType === "Outro" && (
              <div className="mt-3">
                <label htmlFor="customBusinessType" className="block text-sm font-medium text-gray-700">
                  Especifique o tipo de negócio *
                </label>
                <input
                  id="customBusinessType"
                  name="customBusinessType"
                  type="text"
                  value={customBusinessType}
                  onChange={(e) => setCustomBusinessType(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Digite o tipo de negócio"
                  disabled={submitting}
                />
                {fieldErrors.businessType && selectedBusinessType === "Outro" && !customBusinessType.trim() && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.businessType}</p>
                )}
              </div>
            )}
          </div>
          {/* Checkboxes: Anônimo, Holding, Afiliado, Express */}
          <div className="flex flex-wrap gap-6 sm:col-span-2 rounded-lg bg-gray-50 p-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="anonymous" defaultChecked={defaultValues.anonymous} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Anônimo</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="holding" defaultChecked={defaultValues.holding} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Holding</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isAffiliate}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsAffiliate(checked);
                  if (!checked) {
                    setAffiliateType("");
                    setAffiliateOtherText("");
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Afiliado</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="express" defaultChecked={defaultValues.express} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Express</span>
            </label>
          </div>
          {/* Sub-seção Afiliado: Tipo de Afiliado + Especifique (quando Outros) */}
          {isAffiliate && (
            <div className="sm:col-span-2 mt-3 transition-opacity duration-200">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div>
                    <label htmlFor="affiliateType" className="block text-sm font-medium text-gray-700">
                      Tipo de Afiliado
                    </label>
                    <select
                      id="affiliateType"
                      value={affiliateType}
                      onChange={(e) => setAffiliateType(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Selecione</option>
                      <option value="Parceiro">Parceiro</option>
                      <option value="Afiliado">Afiliado</option>
                      <option value="Outros">Outros</option>
                    </select>
                    {fieldErrors.affiliateType && <p className="mt-1 text-sm text-red-600">{fieldErrors.affiliateType}</p>}
                  </div>
                  {affiliateType === "Outros" && (
                    <div className="transition-opacity duration-200">
                      <label htmlFor="affiliateOtherText" className="block text-sm font-medium text-gray-700">
                        Especifique
                      </label>
                      <input
                        id="affiliateOtherText"
                        type="text"
                        value={affiliateOtherText}
                        onChange={(e) => setAffiliateOtherText(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Outro tipo"
                      />
                      {fieldErrors.affiliateOtherText && <p className="mt-1 text-sm text-red-600">{fieldErrors.affiliateOtherText}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* DADOS DA EMPRESA */}
      <section className="space-y-4">
        <h2 className="border-b border-gray-200 pb-2 text-base font-semibold uppercase tracking-wide text-gray-600">
          Dados da Empresa
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="einNumber" className="block text-sm font-medium text-gray-700">
              EIN
            </label>
            <input
              id="einNumber"
              name="einNumber"
              type="text"
              defaultValue={defaultValues.einNumber}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Número EIN da empresa"
            />
          </div>
          <div>
            <label htmlFor="businessId" className="block text-sm font-medium text-gray-700">
              Business ID
            </label>
            <input
              id="businessId"
              name="businessId"
              type="text"
              defaultValue={defaultValues.businessId}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Business ID"
            />
          </div>
          <div>
            <label htmlFor="companyAddressLine1" className="block text-sm font-medium text-gray-700">
              Endereço (linha 1)
            </label>
            <input
              id="companyAddressLine1"
              name="companyAddressLine1"
              type="text"
              defaultValue={defaultValues.companyAddressLine1}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Rua, número"
            />
          </div>
          <div>
            <label htmlFor="companyAddressLine2" className="block text-sm font-medium text-gray-700">
              Endereço (linha 2)
            </label>
            <input
              id="companyAddressLine2"
              name="companyAddressLine2"
              type="text"
              defaultValue={defaultValues.companyAddressLine2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Cidade, estado, CEP"
            />
          </div>
          <div>
            <label htmlFor="formationDate" className="block text-sm font-medium text-gray-700">
              Data de Formação
            </label>
            <input
              id="formationDate"
              name="formationDate"
              type="date"
              defaultValue={defaultValues.formationDate}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="annualReportDate" className="block text-sm font-medium text-gray-700">
              Data Annual Report
            </label>
            <input
              id="annualReportDate"
              name="annualReportDate"
              type="date"
              defaultValue={defaultValues.annualReportDate}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>


      {/* ITENS — useFieldArray: única fonte de verdade */}
      <section className="space-y-4">
        <h2 className="border-b border-gray-200 pb-2 text-base font-semibold uppercase tracking-wide text-gray-600">
          Itens
        </h2>
        {(fieldErrors.lineItems ?? Object.entries(fieldErrors).find(([k]) => k.startsWith("lineItems."))?.[1]) && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {fieldErrors.lineItems ?? Object.entries(fieldErrors).find(([k]) => k.startsWith("lineItems."))?.[1]}
          </p>
        )}
        <div className="space-y-3">
          {lineItemFields.map((field, i) => {
            const it = watchedLineItems?.[i];
            const isEndereco = it?.kind === "Endereco";
            const isLLC = it?.kind === "LLC";
            const isMensalidade = it?.kind === "Mensalidade";
            const isGateway = it?.kind === "Gateway";
            const isServicoAdicional = it?.kind === "ServicoAdicional";
            const isBancoTradicional = it?.kind === "BancoTradicional";
            return (
              <div key={field.id} className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* LINHA 1: Tipo, [Descrição/Categoria/Estado conforme tipo], Valor, Sale Date */}
                  <div className={isEndereco ? "col-span-12 md:col-span-4" : isLLC ? "col-span-12 md:col-span-2" : "col-span-12 md:col-span-3"}>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">Tipo</label>
                      <select
                        {...register(`lineItems.${i}.kind`)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setValue(`lineItems.${i}.kind`, v as ClientFormData["lineItems"][number]["kind"]);
                          if (v !== "Endereco" && v !== "LLC") {
                            setValue(`lineItems.${i}.billingPeriod`, null);
                            setValue(`lineItems.${i}.expirationDate`, null);
                            setValue(`lineItems.${i}.addressProvider`, null);
                            setValue(`lineItems.${i}.addressLine1`, null);
                            setValue(`lineItems.${i}.addressLine2`, null);
                            setValue(`lineItems.${i}.steNumber`, null);
                            setValue(`lineItems.${i}.llcCategory`, null);
                            setValue(`lineItems.${i}.llcState`, null);
                            setValue(`lineItems.${i}.llcCustomCategory`, null);
                            setValue(`lineItems.${i}.description`, "");
                          } else if (v === "Endereco") {
                            setValue(`lineItems.${i}.billingPeriod`, "Mensal");
                            setValue(`lineItems.${i}.description`, "");
                            setValue(`lineItems.${i}.llcCategory`, null);
                            setValue(`lineItems.${i}.llcState`, null);
                            setValue(`lineItems.${i}.llcCustomCategory`, null);
                          } else if (v === "LLC") {
                            setValue(`lineItems.${i}.billingPeriod`, null);
                            setValue(`lineItems.${i}.expirationDate`, null);
                            setValue(`lineItems.${i}.addressProvider`, null);
                            setValue(`lineItems.${i}.addressLine1`, null);
                            setValue(`lineItems.${i}.addressLine2`, null);
                            setValue(`lineItems.${i}.steNumber`, null);
                            setValue(`lineItems.${i}.description`, "");
                          }
                        }}
                        className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {LINE_ITEM_KINDS.map((k) => (
                          <option key={k} value={k}>{kindLabels[k] ?? k}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {isLLC ? (
                    <>
                      <div className="col-span-12 md:col-span-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Categoria LLC *</label>
                          <select
                            {...register(`lineItems.${i}.llcCategory`)}
                            onChange={(e) => {
                              const v = e.target.value || null;
                              setValue(`lineItems.${i}.llcCategory`, v);
                              if (v !== "Personalizado") {
                                setValue(`lineItems.${i}.llcCustomCategory`, null);
                              }
                            }}
                            className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          >
                            <option value="">Selecione</option>
                            {LLC_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          {formErrors.lineItems?.[i]?.llcCategory && (
                            <p className="text-xs text-red-600">{formErrors.lineItems[i]?.llcCategory?.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Estado da LLC *</label>
                          <USStateCombobox
                            value={it?.llcState ?? null}
                            onChange={(code) => setValue(`lineItems.${i}.llcState`, code)}
                            error={formErrors.lineItems?.[i]?.llcState?.message}
                          />
                        </div>
                      </div>
                    </>
                  ) : isMensalidade ? (
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Descrição</label>
                        <select
                          {...register(`lineItems.${i}.description`)}
                          className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">Selecione</option>
                          <option value="Founder">Founder</option>
                          <option value="Traditional">Traditional</option>
                        </select>
                        {(formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]) && (
                          <p className="text-xs text-red-600">{formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]}</p>
                        )}
                      </div>
                    </div>
                  ) : isGateway ? (
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Descrição</label>
                        <select
                          {...register(`lineItems.${i}.description`)}
                          className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">Selecione</option>
                          <option value="Stripe">Stripe</option>
                          <option value="Paypal">Paypal</option>
                        </select>
                        {(formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]) && (
                          <p className="text-xs text-red-600">{formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]}</p>
                        )}
                      </div>
                    </div>
                  ) : isServicoAdicional ? (
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Descrição</label>
                        <select
                          {...register(`lineItems.${i}.description`)}
                          className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">Selecione</option>
                          {SERVICO_ADICIONAL_DESCRIPTION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {(formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]) && (
                          <p className="text-xs text-red-600">{formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]}</p>
                        )}
                      </div>
                    </div>
                  ) : isBancoTradicional ? (
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Descrição</label>
                        <select
                          {...register(`lineItems.${i}.description`)}
                          className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">Selecione</option>
                          {BANCO_TRADICIONAL_DESCRIPTION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {(formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]) && (
                          <p className="text-xs text-red-600">{formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]}</p>
                        )}
                      </div>
                    </div>
                  ) : !isEndereco ? (
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Descrição</label>
                        <input
                          {...register(`lineItems.${i}.description`)}
                          type="text"
                          className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        {(formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]) && (
                          <p className="text-xs text-red-600">{formErrors.lineItems?.[i]?.description?.message ?? fieldErrors[`lineItems.${i}.description`]}</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <div className={isEndereco ? "col-span-12 md:col-span-4" : isLLC ? "col-span-12 md:col-span-2" : "col-span-12 md:col-span-3"}>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">Valor (US$)</label>
                      <input
                        type="text"
                        placeholder="0.00"
                        className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        value={it ? formatCentsToDollars(it.valueCents) : "0.00"}
                        onChange={(e) => setValue(`lineItems.${i}.valueCents`, dollarsToCents(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className={isEndereco ? "col-span-12 md:col-span-4" : isLLC ? "col-span-12 md:col-span-2" : "col-span-12 md:col-span-3"}>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">Sale Date</label>
                      <input
                        type="date"
                        className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        value={it?.saleDate ?? ""}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          setValue(`lineItems.${i}.saleDate`, v);
                          if (it?.kind === "Endereco" && (it?.billingPeriod === "Mensal" || it?.billingPeriod === "Anual")) setLineItemExpiration(i, v, it?.billingPeriod ?? null);
                        }}
                      />
                      {formErrors.lineItems?.[i]?.saleDate && (
                        <p className="text-xs text-red-600">{formErrors.lineItems[i]?.saleDate?.message}</p>
                      )}
                    </div>
                  </div>

                  {/* LINHA EXTRA para LLC: Categoria personalizada quando categoria === "Personalizado" */}
                  {isLLC && it?.llcCategory === "Personalizado" && (
                    <div className="col-span-12 md:col-span-6">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Categoria personalizada *</label>
                        <input
                          {...register(`lineItems.${i}.llcCustomCategory`)}
                          type="text"
                          placeholder="Digite a categoria personalizada"
                          className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        {formErrors.lineItems?.[i]?.llcCustomCategory && (
                          <p className="text-xs text-red-600">{formErrors.lineItems[i]?.llcCustomCategory?.message}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* LINHA 2: só quando kind === Endereço — Periodicidade, Expiração, Endereço (provider) */}
                  {isEndereco && (
                    <>
                      <div className="col-span-12 md:col-span-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Periodicidade</label>
                          <select
                            {...register(`lineItems.${i}.billingPeriod`)}
                            onChange={(e) => {
                              const v = e.target.value as "Mensal" | "Anual";
                              setValue(`lineItems.${i}.billingPeriod`, v);
                              setLineItemExpiration(i, it?.saleDate ?? null, v);
                            }}
                            className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          >
                            {BILLING_PERIOD_VALUES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          {formErrors.lineItems?.[i]?.billingPeriod && (
                            <p className="text-xs text-red-600">{formErrors.lineItems[i]?.billingPeriod?.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Expiração</label>
                          <input
                            type="date"
                            readOnly
                            disabled
                            className="block w-full rounded border border-gray-200 bg-gray-100 px-2 py-1.5 text-sm text-gray-900"
                            value={it?.expirationDate ?? ""}
                          />
                          {it?.billingPeriod === "Mensal" && (
                            <p className="text-[11px] text-gray-500">Sale Date + 1 mês</p>
                          )}
                          {it?.billingPeriod === "Anual" && (
                            <p className="text-[11px] text-gray-500">Sale Date + 1 ano</p>
                          )}
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Endereço *</label>
                          <select
                            {...register(`lineItems.${i}.addressProvider`)}
                            onChange={(e) => {
                              const v = e.target.value as "New Mexico" | "Florida" | "Próprio" | "Agente Registrado" | "";
                              const val = v === "" ? null : v;
                              setValue(`lineItems.${i}.addressProvider`, val);
                              if (val === "New Mexico") {
                                setValue(`lineItems.${i}.steNumber`, "");
                                setValue(`lineItems.${i}.addressLine2`, ADDRESS_NM_LINE2);
                                setValue(`lineItems.${i}.addressLine1`, "412 W 7th St STE ____");
                              } else if (val === "Florida") {
                                setValue(`lineItems.${i}.steNumber`, null);
                                setValue(`lineItems.${i}.addressLine1`, ADDRESS_FL_LINE1);
                                setValue(`lineItems.${i}.addressLine2`, ADDRESS_FL_LINE2);
                              } else if (val === "Próprio" || val === "Agente Registrado") {
                                setValue(`lineItems.${i}.steNumber`, null);
                                setValue(`lineItems.${i}.addressLine1`, "");
                                setValue(`lineItems.${i}.addressLine2`, "");
                              }
                            }}
                            className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          >
                            <option value="">Selecione</option>
                            {ADDRESS_PROVIDER_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          {formErrors.lineItems?.[i]?.addressProvider && (
                            <p className="text-xs text-red-600">{formErrors.lineItems[i]?.addressProvider?.message}</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* LINHA 3: condicional quando Endereço — STE + address lines */}
                  {isEndereco && it?.addressProvider === "New Mexico" && (
                    <>
                      <div className="col-span-12 md:col-span-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">STE *</label>
                          <input
                            type="text"
                            maxLength={20}
                            placeholder="____"
                            className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                            value={it?.steNumber ?? ""}
                            onChange={(e) => {
                              const ste = e.target.value.trim();
                              setValue(`lineItems.${i}.steNumber`, ste || null);
                              setValue(`lineItems.${i}.addressLine1`, `412 W 7th St STE ${ste || "____"}`);
                            }}
                          />
                          {formErrors.lineItems?.[i]?.steNumber && (
                            <p className="text-xs text-red-600">{formErrors.lineItems[i]?.steNumber?.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-6">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Endereço (linha 1)</label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            className="block w-full rounded border border-gray-200 bg-gray-100 px-2 py-1.5 text-sm text-gray-900"
                            value={it?.addressLine1 ?? `412 W 7th St STE ${it?.steNumber || "____"}`}
                          />
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Endereço (linha 2)</label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            className="block w-full rounded border border-gray-200 bg-gray-100 px-2 py-1.5 text-sm text-gray-900"
                            value={ADDRESS_NM_LINE2}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {isEndereco && it?.addressProvider === "Florida" && (
                    <>
                      <div className="col-span-12 md:col-span-6">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Endereço (linha 1)</label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            className="block w-full rounded border border-gray-200 bg-gray-100 px-2 py-1.5 text-sm text-gray-900"
                            value={ADDRESS_FL_LINE1}
                          />
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-6">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Endereço (linha 2)</label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            className="block w-full rounded border border-gray-200 bg-gray-100 px-2 py-1.5 text-sm text-gray-900"
                            value={ADDRESS_FL_LINE2}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {(isEndereco && (it?.addressProvider === "Próprio" || it?.addressProvider === "Agente Registrado")) && (
                    <>
                      <div className="col-span-12 md:col-span-6">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Endereço (linha 1) *</label>
                          <input
                            {...register(`lineItems.${i}.addressLine1`)}
                            type="text"
                            className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                            placeholder="Ex.: Rua, número"
                          />
                          {formErrors.lineItems?.[i]?.addressLine1 && (
                            <p className="text-xs text-red-600">{formErrors.lineItems[i]?.addressLine1?.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-6">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">Endereço (linha 2) *</label>
                          <input
                            {...register(`lineItems.${i}.addressLine2`)}
                            type="text"
                            className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                            placeholder="Ex.: Bairro, cidade, CEP"
                          />
                          {formErrors.lineItems?.[i]?.addressLine2 && (
                            <p className="text-xs text-red-600">{formErrors.lineItems[i]?.addressLine2?.message}</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* LINHA FINAL: Forma de Pagamento, Comercial, SDR, Remove (padronizada para todos os tipos) */}
                  <div className="col-span-12 md:col-span-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">Forma de Pagamento *</label>
                      <select
                        {...register(`lineItems.${i}.paymentMethod`)}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          setValue(`lineItems.${i}.paymentMethod`, v);
                          if (v !== "Outro") {
                            setValue(`lineItems.${i}.paymentMethodCustom`, null);
                          }
                        }}
                        className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Selecione</option>
                        {PAYMENT_METHODS.map((pm) => (
                          <option key={pm} value={pm}>{pm}</option>
                        ))}
                      </select>
                      {formErrors.lineItems?.[i]?.paymentMethod && (
                        <p className="text-xs text-red-600">{formErrors.lineItems[i]?.paymentMethod?.message}</p>
                      )}
                    </div>
                  </div>
                  {it?.paymentMethod === "Outro" && (
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Especifique *</label>
                        <input
                          {...register(`lineItems.${i}.paymentMethodCustom`)}
                          type="text"
                          placeholder="Forma de pagamento"
                          className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        {formErrors.lineItems?.[i]?.paymentMethodCustom && (
                          <p className="text-xs text-red-600">{formErrors.lineItems[i]?.paymentMethodCustom?.message}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className={it?.paymentMethod === "Outro" ? "col-span-12 md:col-span-2" : "col-span-12 md:col-span-3"}>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">Comercial</label>
                      <select
                        {...register(`lineItems.${i}.commercial`)}
                        className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Selecione</option>
                        {commercialOptions.map((o) => (
                          <option key={o} value={o ?? ""}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={it?.paymentMethod === "Outro" ? "col-span-12 md:col-span-2" : "col-span-12 md:col-span-3"}>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">SDR</label>
                      <select
                        {...register(`lineItems.${i}.sdr`)}
                        className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Selecione</option>
                        {commercialOptions.map((o) => (
                          <option key={o} value={o ?? ""}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={it?.paymentMethod === "Outro" ? "col-span-12 md:col-span-2 flex items-end justify-end" : "col-span-12 md:col-span-3 flex items-end justify-end"}>
                    <button
                      type="button"
                      onClick={() => removeLineItem(i)}
                      className="min-w-[110px] rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => appendLineItem({ ...EMPTY_LINE_ITEM })}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 transition-colors"
          >
            + Adicionar item
          </button>
        </div>
      </section>

      {/* SÓCIOS */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 pb-2">
          <h2 className="text-base font-semibold uppercase tracking-wide text-gray-600">
            Sócios
          </h2>
          {partners.length > 0 && (() => {
            const payer = partners.find((x) => x.isPayer) as PartnerState | undefined;
            const payerName = payer?.customer?.fullName ?? (payer && "fullName" in payer ? String(payer.fullName ?? "").trim() : "");
            const payerContact = payer?.customer?.email ?? (payer && "email" in payer ? String(payer.email ?? "").trim() : "");
            const display = payerName ? (payerContact ? `${payerName} (${payerContact})` : payerName) : null;
            return (
              <p className="text-xs font-medium text-gray-500">
                Pagador: {display ?? "—"}
              </p>
            );
          })()}
        </div>
        {fieldErrors.partners && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{fieldErrors.partners}</p>
        )}
        <div className="space-y-3">
          {partners.map((p, i) => (
            <div key={i} className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                {!(p as PartnerState).isPayer && (
                  <div className="min-w-[180px] flex-1">
                    <label className="block text-xs font-medium text-gray-500">Nome *</label>
                    <input
                      name={`partner_name_${i}`}
                      type="text"
                      defaultValue={"fullName" in p ? String(p.fullName) : ""}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
                <div className="min-w-[120px]">
                  <label className="block text-xs font-medium text-gray-500">Papel</label>
                  <select
                    value={p.role}
                    onChange={(e) => updatePartner(i, "role", e.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {PARTNER_ROLES.map((r) => (
                      <option key={r} value={r}>{r === "SocioPrincipal" ? "Sócio Principal" : "Sócio"}</option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-xs font-medium text-gray-500">%</label>
                  <input
                    name={`partner_pct_${i}`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    defaultValue={"percentage" in p ? p.percentage : 0}
                    className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-500">Este sócio é Cliente (Pagador)?</label>
                  {i === 0 ? (
                    <p className="mt-1 text-sm text-gray-700">Sim (primeiro sócio é sempre o pagador)</p>
                  ) : (
                    <select
                      value={p.isPayer ? "Sim" : "Não"}
                      onChange={(e) => {
                        if (e.target.value === "Sim") setPayer(i);
                        else setPartners((prev) => prev.map((p2, idx) => (idx === i ? { ...p2, isPayer: false, payerMode: null, customerId: null, customerInline: null, customer: undefined } : p2)));
                      }}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                  )}
                </div>
                {!(p as PartnerState).isPayer && (
                  <div className="flex min-w-[200px] flex-1 flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                    <div className="min-w-[140px] flex-1">
                      <label className="block text-xs font-medium text-gray-500">País / DDI</label>
                      <SearchableCountrySelect
                        name={`partner_phone_country_${i}`}
                        defaultValue={parsePhoneForDisplay("phone" in p ? String(p.phone ?? "") : "").countryCode}
                        className="mt-1"
                      />
                    </div>
                    <div className="min-w-[100px] flex-1">
                      <label className="block text-xs font-medium text-gray-500">Telefone</label>
                      <input
                        name={`partner_phone_${i}`}
                        type="tel"
                        defaultValue={parsePhoneForDisplay("phone" in p ? String(p.phone ?? "") : "").localNumber}
                        placeholder="11 99999-9999"
                        className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removePartner(i)}
                    className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </div>
              {/* Endereço pessoal do sócio — oculto quando este sócio é Cliente (Pagador); dados vêm do customer */}
              {!(p as PartnerState).isPayer && (
                <div className="grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">E-mail {!clientId && "*"}</label>
                    <input
                      name={`partner_email_${i}`}
                      type="email"
                      defaultValue={"email" in p ? String(p.email ?? "") : ""}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    {fieldErrors[`partners.${i}.email`] && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[`partners.${i}.email`]}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">Endereço (Linha 1) {!clientId && "*"}</label>
                    <input
                      name={`partner_addressLine1_${i}`}
                      type="text"
                      defaultValue={"addressLine1" in p ? String(p.addressLine1 ?? "") : ""}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    {fieldErrors[`partners.${i}.addressLine1`] && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[`partners.${i}.addressLine1`]}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">Endereço (Linha 2) <span className="text-gray-400">(Opcional)</span></label>
                    <input
                      name={`partner_addressLine2_${i}`}
                      type="text"
                      defaultValue={"addressLine2" in p ? String(p.addressLine2 ?? "") : ""}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Cidade {!clientId && "*"}</label>
                    <input
                      name={`partner_city_${i}`}
                      type="text"
                      defaultValue={"city" in p ? String(p.city ?? "") : ""}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    {fieldErrors[`partners.${i}.city`] && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[`partners.${i}.city`]}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Estado/Província {!clientId && "*"}</label>
                    <input
                      name={`partner_state_${i}`}
                      type="text"
                      defaultValue={"state" in p ? String(p.state ?? "") : ""}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    {fieldErrors[`partners.${i}.state`] && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[`partners.${i}.state`]}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Código Postal {!clientId && "*"}</label>
                    <input
                      name={`partner_postalCode_${i}`}
                      type="text"
                      defaultValue={"postalCode" in p ? String(p.postalCode ?? "") : ""}
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    {fieldErrors[`partners.${i}.postalCode`] && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[`partners.${i}.postalCode`]}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">País {!clientId && "*"}</label>
                    <CountrySelectForAddress
                      name={`partner_country_${i}`}
                      defaultValue={"country" in p ? String(p.country ?? "") : ""}
                      required={!clientId}
                      className="mt-1"
                    />
                    {fieldErrors[`partners.${i}.country`] && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[`partners.${i}.country`]}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Bloco Cliente (Pagador): Sócio já é cliente? Sim (buscar) ou Não (cadastrar novo) — sem modal */}
              {(p as PartnerState).isPayer && (
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-600">Sócio já é cliente?</p>
                  {(p as PartnerState).customerId || (p as PartnerState).customer ? (
                    <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
                      {(p as PartnerState).customerFull ? (
                        <>
                          <p className="text-xs font-medium text-gray-500">Dados do cliente selecionado</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-500">Nome completo *</label>
                              <input value={(p as PartnerState).customerFull!.fullName} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">Given name *</label>
                              <input value={(p as PartnerState).customerFull!.givenName} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">Sobrenome *</label>
                              <input value={(p as PartnerState).customerFull!.surName} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-500">Cidadania *</label>
                              <input value={(p as PartnerState).customerFull!.citizenshipCountry} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">Telefone</label>
                              <input value={(p as PartnerState).customerFull!.phone ?? ""} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">E-mail *</label>
                              <input type="email" value={(p as PartnerState).customerFull!.email} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-500">Endereço (linha 1) *</label>
                              <input value={(p as PartnerState).customerFull!.address.line1} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-500">Endereço (linha 2)</label>
                              <input value={(p as PartnerState).customerFull!.address.line2 ?? ""} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">Cidade *</label>
                              <input value={(p as PartnerState).customerFull!.address.city} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">Estado/Província *</label>
                              <input value={(p as PartnerState).customerFull!.address.stateProvince} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">Código postal *</label>
                              <input value={(p as PartnerState).customerFull!.address.postalCode} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500">País *</label>
                              <input value={(p as PartnerState).customerFull!.address.country} readOnly className="mt-1 block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Carregando dados do cliente…</p>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setPartners((prev) =>
                            prev.map((p2, idx) =>
                              idx === i
                                ? { ...p2, customerId: null, customer: undefined, customerFull: null, customerInline: null, payerMode: null }
                                : p2
                            )
                          )
                        }
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Trocar cliente
                      </button>
                    </div>
                  ) : (p as PartnerState).payerMode === "new" ? (
                    <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
                      <p className="text-xs font-medium text-gray-500">Cadastrar novo cliente (dados do pagador)</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-500">Nome completo *</label>
                          <input
                            value={(p as PartnerState).customerInline?.fullName ?? ""}
                            onChange={(e) =>
                              updatePartner(i, "customerInline", {
                                ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE),
                                fullName: e.target.value,
                              })
                            }
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Given name *</label>
                          <input
                            value={(p as PartnerState).customerInline?.givenName ?? ""}
                            onChange={(e) =>
                              updatePartner(i, "customerInline", {
                                ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE),
                                givenName: e.target.value,
                              })
                            }
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Sobrenome *</label>
                          <input
                            value={(p as PartnerState).customerInline?.surName ?? ""}
                            onChange={(e) =>
                              updatePartner(i, "customerInline", {
                                ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE),
                                surName: e.target.value,
                              })
                            }
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-500">Cidadania *</label>
                          <CountrySelectForAddress
                            name={`payer_citizenship_${i}`}
                            value={((p as PartnerState).customerInline?.citizenshipCountry ?? "").trim()}
                            onChange={(v) => updatePartner(i, "customerInline", { ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE), citizenshipCountry: v })}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Telefone</label>
                          <input
                            value={((p as PartnerState).customerInline?.phone ?? "").trim()}
                            onChange={(e) => updatePartner(i, "customerInline", { ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE), phone: e.target.value || null })}
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">E-mail *</label>
                          <input
                            type="email"
                            value={((p as PartnerState).customerInline?.email ?? "").trim()}
                            onChange={(e) => updatePartner(i, "customerInline", { ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE), email: e.target.value })}
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-500">Endereço (linha 1) *</label>
                          <input
                            value={((p as PartnerState).customerInline?.address?.line1 ?? "").trim()}
                            onChange={(e) => updatePartner(i, "customerInline", { ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE), address: { ...((p as PartnerState).customerInline?.address ?? DEFAULT_CUSTOMER_INLINE.address), line1: e.target.value } })}
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-500">Endereço (linha 2)</label>
                          <input
                            value={((p as PartnerState).customerInline?.address?.line2 ?? "").trim() || ""}
                            onChange={(e) => updatePartner(i, "customerInline", { ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE), address: { ...((p as PartnerState).customerInline?.address ?? DEFAULT_CUSTOMER_INLINE.address), line2: e.target.value || null } })}
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Cidade *</label>
                          <input
                            value={((p as PartnerState).customerInline?.address?.city ?? "").trim()}
                            onChange={(e) => updatePartner(i, "customerInline", { ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE), address: { ...((p as PartnerState).customerInline?.address ?? DEFAULT_CUSTOMER_INLINE.address), city: e.target.value } })}
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Estado/Província *</label>
                          <input
                            value={((p as PartnerState).customerInline?.address?.stateProvince ?? "").trim()}
                            onChange={(e) => updatePartner(i, "customerInline", { ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE), address: { ...((p as PartnerState).customerInline?.address ?? DEFAULT_CUSTOMER_INLINE.address), stateProvince: e.target.value } })}
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Código postal *</label>
                          <input
                            value={((p as PartnerState).customerInline?.address?.postalCode ?? "").trim()}
                            onChange={(e) => updatePartner(i, "customerInline", { ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE), address: { ...((p as PartnerState).customerInline?.address ?? DEFAULT_CUSTOMER_INLINE.address), postalCode: e.target.value } })}
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">País *</label>
                          <CountrySelectForAddress
                            name={`payer_country_${i}`}
                            value={((p as PartnerState).customerInline?.address?.country ?? "").trim()}
                            onChange={(v) => updatePartner(i, "customerInline", { ...((p as PartnerState).customerInline ?? DEFAULT_CUSTOMER_INLINE), address: { ...((p as PartnerState).customerInline?.address ?? DEFAULT_CUSTOMER_INLINE.address), country: v } })}
                            required
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPartners((prev) =>
                            prev.map((p2, idx) =>
                              idx === i
                                ? { ...p2, payerMode: "existing" as const, customerInline: null }
                                : p2
                            )
                          )
                        }
                        className="text-xs font-medium text-gray-500 hover:text-gray-700"
                      >
                        Voltar (buscar cliente)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-4">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name={`payer_mode_${i}`}
                            checked={(p as PartnerState).payerMode !== "new"}
                            onChange={() =>
                              setPartners((prev) =>
                                prev.map((p2, idx) =>
                                  idx === i
                                    ? { ...p2, payerMode: "existing" as const, customerInline: null }
                                    : p2
                                )
                              )
                            }
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Sim (Buscar cliente)</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name={`payer_mode_${i}`}
                            checked={(p as PartnerState).payerMode === "new"}
                            onChange={() => {
                              updatePartner(i, "payerMode", "new");
                              setPartners((prev) =>
                                prev.map((p2, idx) =>
                                  idx === i
                                    ? {
                                        ...p2,
                                        customerId: null,
                                        customer: undefined,
                                        customerInline: DEFAULT_CUSTOMER_INLINE,
                                      }
                                    : p2
                                )
                              );
                            }}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Não (Cadastrar novo cliente)</span>
                        </label>
                      </div>
                      {(p as PartnerState).payerMode !== "new" && (
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Nome, e-mail ou telefone (mín. 2 caracteres)"
                            value={customerSearch?.partnerIndex === i ? customerSearch.q : ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              scheduleCustomerLookup(v, i);
                            }}
                            onFocus={() => (customerSearch?.partnerIndex !== i && setCustomerSearch({ partnerIndex: i, q: "", items: [], loading: false }))}
                            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          />
                          {customerSearch?.partnerIndex === i && customerSearch.items.length > 0 && (
                            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                              {customerSearch.items.map((item) => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    onClick={() => selectLookupItem(i, item)}
                                    disabled={customerResolvingId === item.id}
                                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50"
                                  >
                                    {item.fullName}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {customerSearch?.partnerIndex === i && customerSearch.loading && (
                            <p className="mt-1 text-xs text-gray-500">Buscando…</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {!addWizardOpen ? (
            <button
              type="button"
              onClick={openAddPartnerWizard}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 transition-colors"
            >
              + Adicionar sócio
            </button>
          ) : (
            <div className="rounded-lg border-2 border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Novo sócio
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Este sócio é Cliente (Pagador)?
                  </label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="add_is_payer"
                        checked={addIsPayer === "yes"}
                        onChange={() => { setAddIsPayer("yes"); setAddPayerMode(null); }}
                        disabled={hasExistingPayer}
                        className="h-4 w-4 disabled:opacity-50"
                      />
                      <span className="text-sm">Sim</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="add_is_payer"
                        checked={addIsPayer === "no"}
                        onChange={() => { setAddIsPayer("no"); setAddPayerMode(null); }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Não</span>
                    </label>
                  </div>
                  {hasExistingPayer && (
                    <p className="mt-1 text-xs text-amber-600">
                      Já existe um pagador. Altere no sócio atual.
                    </p>
                  )}
                </div>
                {addIsPayer === "yes" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Sócio já é cliente?
                    </label>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="add_payer_mode"
                          checked={addPayerMode === "existing"}
                          onChange={() => setAddPayerMode("existing")}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">Sim (Buscar cliente)</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="add_payer_mode"
                          checked={addPayerMode === "new"}
                          onChange={() => setAddPayerMode("new")}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">Não (Cadastrar novo cliente)</span>
                      </label>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3">
                  <button
                    type="button"
                    onClick={closeAddPartnerWizard}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmAddPartner}
                    disabled={addIsPayer === null || (addIsPayer === "yes" && addPayerMode === null)}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* OBSERVAÇÃO */}
      <section className="space-y-4">
        <h2 className="border-b border-gray-200 pb-2 text-base font-semibold uppercase tracking-wide text-gray-600">
          Observação
        </h2>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues.notes}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </section>

      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

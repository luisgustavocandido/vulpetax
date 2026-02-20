"use client";

import { useState } from "react";
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
import { PaymentMethodCombobox } from "./PaymentMethodCombobox";
import { addOneYear } from "@/lib/dates/addOneYear";
import { lineItemFromApi, ADDRESS_PROVIDER_OPTIONS } from "@/types/lineItems";
import { LLC_CATEGORIES } from "@/constants/llcCategories";
import { USStateCombobox } from "./USStateCombobox";

const ADDRESS_NM_LINE2 = "Clovis, NM, 88101";
const ADDRESS_FL_LINE1 = "6407 Magnolia St";
const ADDRESS_FL_LINE2 = "Milton, FL, 32570";

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
}).superRefine((item, ctx) => {
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
  if (item.billingPeriod === "Mensal" && item.expirationDate != null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expiração deve estar vazia para Mensal", path: ["expirationDate"] });
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

const partnerSchema = z.object({
  fullName: z.string().min(1, "Nome obrigatório"),
  role: z.enum(PARTNER_ROLES as unknown as [string, ...string[]]),
  percentage: z.number().min(0).max(100),
  phone: z.string().optional(),
  email: z.string().optional(),
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
    paymentDate: z.string().optional(),
    commercial: z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]).optional(),
    sdr: z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]).optional(),
    businessType: z.string().min(1, "Tipo de negócio é obrigatório").max(255),
    paymentMethod: z.string().min(1, "Forma de pagamento é obrigatória").max(100),
    anonymous: z.boolean().default(false),
    holding: z.boolean().default(false),
    affiliate: z.boolean().default(false),
    express: z.boolean().default(false),
    notes: z.string().optional(),
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
  );

export type ClientFormData = z.infer<typeof schema>;

type ClientFormProps = {
  initialData?: Partial<ClientFormData> & { lineItems?: ClientFormData["lineItems"]; partners?: ClientFormData["partners"] };
  clientId?: string;
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
};

const EMPTY_PARTNER: ClientFormData["partners"][0] = {
  fullName: "",
  role: "Socio",
  percentage: 0,
  phone: "",
  email: "",
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

export function ClientForm({ initialData, clientId }: ClientFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [partners, setPartners] = useState<ClientFormData["partners"]>(
    initialData?.partners?.length ? initialData.partners : [EMPTY_PARTNER]
  );

  // Lógica para inicializar selectedBusinessType e customBusinessType
  const initialBusinessType = initialData?.businessType ?? "";
  const isBusinessTypeInList = initialBusinessType && BUSINESS_TYPES.includes(initialBusinessType as typeof BUSINESS_TYPES[number]);
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>(
    isBusinessTypeInList ? initialBusinessType : (initialBusinessType ? "Outro" : "")
  );
  const [customBusinessType, setCustomBusinessType] = useState<string>(
    isBusinessTypeInList ? "" : initialBusinessType
  );

  // Lógica para inicializar selectedPaymentMethod e customPaymentMethod
  const initialPaymentMethod = initialData?.paymentMethod ?? "";
  const isPaymentMethodInList = initialPaymentMethod && PAYMENT_METHODS.includes(initialPaymentMethod as typeof PAYMENT_METHODS[number]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(
    isPaymentMethodInList ? initialPaymentMethod : (initialPaymentMethod ? "Outro" : "")
  );
  const [customPaymentMethod, setCustomPaymentMethod] = useState<string>(
    isPaymentMethodInList ? "" : initialPaymentMethod
  );

  const defaultValues: Partial<ClientFormData> = {
    companyName: initialData?.companyName ?? "",
    customerCode: initialData?.customerCode ?? "",
    paymentDate: initialData?.paymentDate ?? "",
    commercial: initialData?.commercial ?? "",
    sdr: initialData?.sdr ?? "",
    businessType: initialData?.businessType ?? "",
    paymentMethod: initialData?.paymentMethod ?? "",
    anonymous: initialData?.anonymous ?? false,
    holding: initialData?.holding ?? false,
    affiliate: initialData?.affiliate ?? false,
    express: initialData?.express ?? false,
    notes: initialData?.notes ?? "",
    email: initialData?.email ?? "",
    personalAddressLine1: initialData?.personalAddressLine1 ?? "",
    personalAddressLine2: initialData?.personalAddressLine2 ?? "",
    personalCity: initialData?.personalCity ?? "",
    personalState: initialData?.personalState ?? "",
    personalPostalCode: initialData?.personalPostalCode ?? "",
    personalCountry: initialData?.personalCountry ?? "",
    lineItems: (initialData?.lineItems ?? []).map((li) => lineItemFromApi(li)),
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
  const setLineItemExpiration = (index: number, saleDate: string | null) => {
    if (!saleDate) {
      setValue(`lineItems.${index}.expirationDate`, null);
      return;
    }
    const exp = computeExpirationIsoFromSaleDate(saleDate);
    setValue(`lineItems.${index}.expirationDate`, exp ?? null);
  };

  function addPartner() {
    setPartners((prev) => [...prev, { ...EMPTY_PARTNER }]);
  }
  function removePartner(i: number) {
    setPartners((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  function updatePartner(i: number, field: keyof typeof EMPTY_PARTNER, value: unknown) {
    setPartners((prev) => {
      const next = [...prev];
      (next[i] as Record<string, unknown>)[field] = value;
      return next;
    });
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
        if (!name) return null;
        return {
          fullName: name,
          role: p.role,
          percentage: pct,
          phone,
          email,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          country,
        };
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

    // Validação do campo paymentMethod
    if (!selectedPaymentMethod || selectedPaymentMethod.trim() === "") {
      setFieldErrors({ paymentMethod: "Forma de pagamento é obrigatória" });
      setSubmitting(false);
      return;
    }

    // Validação do campo customPaymentMethod quando "Outro" está selecionado
    if (selectedPaymentMethod === "Outro" && !customPaymentMethod.trim()) {
      setFieldErrors({ paymentMethod: "Especifique a forma de pagamento" });
      setSubmitting(false);
      return;
    }

    // Determinar o valor final de paymentMethod para salvar
    // Após as validações acima, sabemos que sempre terá um valor não vazio
    const finalPaymentMethod: string = selectedPaymentMethod === "Outro"
      ? customPaymentMethod.trim()
      : selectedPaymentMethod.trim();

    if (!finalPaymentMethod) {
      setFieldErrors({ paymentMethod: "Forma de pagamento é obrigatória" });
      setSubmitting(false);
      return;
    }

    const data: ClientFormData = {
      companyName: (fd.get("companyName") ?? "").toString().trim(),
      customerCode: clientId ? (fd.get("customerCode") ?? "").toString().trim() : undefined,
      paymentDate: (fd.get("paymentDate") ?? "").toString().trim() || undefined,
      commercial: (fd.get("commercial") ?? "").toString().trim() || undefined,
      sdr: (fd.get("sdr") ?? "").toString().trim() || undefined,
      businessType: finalBusinessType,
      paymentMethod: finalPaymentMethod,
      anonymous: fd.get("anonymous") === "on",
      holding: fd.get("holding") === "on",
      affiliate: fd.get("affiliate") === "on",
      express: fd.get("express") === "on",
      notes: (fd.get("notes") ?? "").toString().trim() || undefined,
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
      lineItems: (parsed.data.lineItems ?? []).map((li) => ({
        id: li.dbId ?? undefined,
        kind: li.kind,
        description: li.description,
        valueCents: Number(li.valueCents),
        saleDate: li.saleDate ?? null,
        commercial: li.commercial ?? null,
        sdr: li.sdr ?? null,
        billingPeriod: li.kind === "Endereco" ? (li.billingPeriod ?? "Mensal") : null,
        expirationDate: li.kind === "Endereco" && li.billingPeriod === "Anual" ? li.expirationDate : null,
        addressProvider: li.kind === "Endereco" ? (li.addressProvider ?? null) : null,
        addressLine1: li.kind === "Endereco" ? (li.addressLine1 ?? null) : null,
        addressLine2: li.kind === "Endereco" ? (li.addressLine2 ?? null) : null,
        steNumber: li.kind === "Endereco" ? (li.steNumber ?? null) : null,
        llcCategory: li.kind === "LLC" ? (li.llcCategory ?? null) : null,
        llcState: li.kind === "LLC" ? (li.llcState ?? null) : null,
        llcCustomCategory: li.kind === "LLC" && li.llcCategory === "Personalizado" ? (li.llcCustomCategory ?? null) : null,
      })),
      partners: parsed.data.partners ?? [],
    };
    if (process.env.NODE_ENV === "development") {
      console.log("[ClientForm] submit payload.lineItems count:", payload.lineItems.length, payload.lineItems);
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

    const responseClient = (json as { client?: { lineItems?: Array<{ id?: string; kind?: string; description?: string; valueCents?: number; saleDate?: string | null; commercial?: string | null; sdr?: string | null; billingPeriod?: string | null; expirationDate?: string | null }>; partners?: ClientFormData["partners"]; [k: string]: unknown } }).client;
    if (responseClient && Array.isArray(responseClient.lineItems)) {
      formReset({
        ...responseClient,
        lineItems: responseClient.lineItems.map((li) => lineItemFromApi(li)),
        partners: responseClient.partners ?? partners,
      });
    }

    router.push("/clients");
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
            <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700">
              Data de Pagamento
            </label>
            <input
              id="paymentDate"
              name="paymentDate"
              type="date"
              defaultValue={defaultValues.paymentDate}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
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
          <div className="sm:col-span-2">
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
              Forma de Pagamento *
            </label>
            <div className="mt-1">
              <PaymentMethodCombobox
                value={selectedPaymentMethod || null}
                onChange={(value) => {
                  setSelectedPaymentMethod(value);
                  if (value !== "Outro") {
                    setCustomPaymentMethod("");
                  }
                }}
                placeholder="Selecione a forma de pagamento…"
                disabled={submitting}
                error={fieldErrors.paymentMethod && selectedPaymentMethod !== "Outro" ? fieldErrors.paymentMethod : undefined}
              />
            </div>
            {selectedPaymentMethod === "Outro" && (
              <div className="mt-3">
                <label htmlFor="customPaymentMethod" className="block text-sm font-medium text-gray-700">
                  Especifique a forma de pagamento *
                </label>
                <input
                  id="customPaymentMethod"
                  name="customPaymentMethod"
                  type="text"
                  value={customPaymentMethod}
                  onChange={(e) => setCustomPaymentMethod(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Digite a forma de pagamento"
                  disabled={submitting}
                />
                {fieldErrors.paymentMethod && selectedPaymentMethod === "Outro" && !customPaymentMethod.trim() && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.paymentMethod}</p>
                )}
              </div>
            )}
          </div>
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
              <input type="checkbox" name="affiliate" defaultChecked={defaultValues.affiliate} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Afiliado</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="express" defaultChecked={defaultValues.express} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Express</span>
            </label>
          </div>
        </div>
      </section>


      {/* ITENS — useFieldArray: única fonte de verdade */}
      <section className="space-y-4">
        <h2 className="border-b border-gray-200 pb-2 text-base font-semibold uppercase tracking-wide text-gray-600">
          Itens
        </h2>
        <div className="space-y-3">
          {lineItemFields.map((field, i) => {
            const it = watchedLineItems?.[i];
            const isEndereco = it?.kind === "Endereco";
            const isLLC = it?.kind === "LLC";
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
                  ) : !isEndereco && (
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Descrição</label>
                        <input
                          {...register(`lineItems.${i}.description`)}
                          type="text"
                          className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        {formErrors.lineItems?.[i]?.description && (
                          <p className="text-xs text-red-600">{formErrors.lineItems[i]?.description?.message}</p>
                        )}
                      </div>
                    </div>
                  )}
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
                          if (it?.kind === "Endereco" && it?.billingPeriod === "Anual") setLineItemExpiration(i, v);
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
                              if (v === "Mensal") setValue(`lineItems.${i}.expirationDate`, null);
                              else if (it?.saleDate) setLineItemExpiration(i, it.saleDate);
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
                          {it?.billingPeriod === "Anual" && (
                            <p className="text-[11px] text-gray-500">Sale Date + 1 ano (server)</p>
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

                  {/* LINHA FINAL: Comercial, SDR, Remove (padronizada para todos os tipos) */}
                  <div className="col-span-12 md:col-span-3">
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
                  <div className="col-span-12 md:col-span-3">
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
                  <div className="col-span-12 md:col-span-6 flex items-end justify-end">
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
        <h2 className="border-b border-gray-200 pb-2 text-base font-semibold uppercase tracking-wide text-gray-600">
          Sócios
        </h2>
        {fieldErrors.partners && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{fieldErrors.partners}</p>
        )}
        <div className="space-y-3">
          {partners.map((p, i) => (
            <div key={i} className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px] flex-1">
                  <label className="block text-xs font-medium text-gray-500">Nome *</label>
                  <input
                    name={`partner_name_${i}`}
                    type="text"
                    defaultValue={"fullName" in p ? String(p.fullName) : ""}
                    className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
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
              {/* Endereço pessoal do sócio */}
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
            </div>
          ))}
          <button
            type="button"
            onClick={addPartner}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 transition-colors"
          >
            + Adicionar sócio
          </button>
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  COMMERCIAL_SDR_VALUES,
  LINE_ITEM_KINDS,
  PARTNER_ROLES,
} from "@/db/schema";
import { parsePhoneForDisplay } from "@/lib/countryCodes";
import { SearchableCountrySelect } from "./SearchableCountrySelect";

const lineItemSchema = z.object({
  kind: z.enum(LINE_ITEM_KINDS as unknown as [string, ...string[]]),
  description: z.string().min(1, "Descrição obrigatória"),
  valueCents: z.number().int().min(0),
  saleDate: z.string().optional(),
  commercial: z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]).optional(),
  sdr: z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const partnerSchema = z.object({
  fullName: z.string().min(1, "Nome obrigatório"),
  role: z.enum(PARTNER_ROLES as unknown as [string, ...string[]]),
  percentage: z.number().min(0).max(100),
  phone: z.string().optional(),
});

const schema = z
  .object({
    companyName: z.string().min(1, "Empresa é obrigatória").max(255),
    customerCode: z.string().max(100).optional(),
    paymentDate: z.string().optional(),
    commercial: z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]).optional(),
    sdr: z.enum(COMMERCIAL_SDR_VALUES as unknown as [string, ...string[]]).optional(),
    businessType: z.string().max(255).optional(),
    paymentMethod: z.string().max(100).optional(),
    anonymous: z.boolean().default(false),
    holding: z.boolean().default(false),
    affiliate: z.boolean().default(false),
    express: z.boolean().default(false),
    notes: z.string().optional(),
    items: z.array(lineItemSchema).default([]),
    partners: z.array(partnerSchema).default([]),
  })
  .refine(
    (data) => data.partners.reduce((acc, p) => acc + p.percentage, 0) <= 100,
    { message: "A soma das participações não pode exceder 100%", path: ["partners"] }
  );

export type ClientFormData = z.infer<typeof schema>;

type ClientFormProps = {
  initialData?: Partial<ClientFormData> & { items?: ClientFormData["items"]; partners?: ClientFormData["partners"] };
  clientId?: string;
};

const EMPTY_ITEM: ClientFormData["items"][0] = {
  kind: "LLC",
  description: "",
  valueCents: 0,
  saleDate: undefined,
  commercial: undefined,
  sdr: undefined,
};
const EMPTY_PARTNER: ClientFormData["partners"][0] = {
  fullName: "",
  role: "Socio",
  percentage: 0,
  phone: "",
};

function formatCentsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
function dollarsToCents(s: string): number {
  const n = parseFloat(s.replace(",", ".")) || 0;
  return Math.round(n * 100);
}

export function ClientForm({ initialData, clientId }: ClientFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ClientFormData["items"]>(
    initialData?.items?.length ? initialData.items : [EMPTY_ITEM]
  );
  const [partners, setPartners] = useState<ClientFormData["partners"]>(
    initialData?.partners?.length ? initialData.partners : [EMPTY_PARTNER]
  );

  const defaultValues = {
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
  };

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }
  function removeItem(i: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  function updateItem(i: number, field: keyof typeof EMPTY_ITEM, value: unknown) {
    setItems((prev) => {
      const next = [...prev];
      (next[i] as Record<string, unknown>)[field] = value;
      return next;
    });
  }

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

    const validItems = items
      .map((it, i) => {
        const desc = (fd.get(`item_desc_${i}`) ?? "").toString().trim();
        const valStr = (fd.get(`item_value_${i}`) ?? "0").toString().trim();
        const saleDate = (fd.get(`item_saleDate_${i}`) ?? "").toString().trim() || undefined;
        const commercial = (fd.get(`item_commercial_${i}`) ?? "").toString().trim() || undefined;
        const sdr = (fd.get(`item_sdr_${i}`) ?? "").toString().trim() || undefined;
        if (!desc) return null;
        const commercialVal =
          commercial && commercialOptions.includes(commercial as (typeof commercialOptions)[number])
            ? (commercial as (typeof commercialOptions)[number])
            : undefined;
        const sdrVal =
          sdr && commercialOptions.includes(sdr as (typeof commercialOptions)[number])
            ? (sdr as (typeof commercialOptions)[number])
            : undefined;
        return {
          kind: it.kind,
          description: desc,
          valueCents: dollarsToCents(valStr),
          saleDate,
          commercial: commercialVal,
          sdr: sdrVal,
        };
      })
      .filter(Boolean) as ClientFormData["items"];

    const validPartners = partners
      .map((p, i) => {
        const name = (fd.get(`partner_name_${i}`) ?? "").toString().trim();
        const pct = parseFloat((fd.get(`partner_pct_${i}`) ?? "0").toString()) || 0;
        const countryCode = (fd.get(`partner_phone_country_${i}`) ?? "+55").toString().trim();
        const localNumber = (fd.get(`partner_phone_${i}`) ?? "").toString().trim().replace(/\D/g, "");
        const phone = localNumber ? `${countryCode}${localNumber}` : undefined;
        if (!name) return null;
        return {
          fullName: name,
          role: p.role,
          percentage: pct,
          phone,
        };
      })
      .filter(Boolean) as ClientFormData["partners"];

    const data: ClientFormData = {
      companyName: (fd.get("companyName") ?? "").toString().trim(),
      customerCode: clientId ? (fd.get("customerCode") ?? "").toString().trim() : undefined,
      paymentDate: (fd.get("paymentDate") ?? "").toString().trim() || undefined,
      commercial: (fd.get("commercial") ?? "").toString().trim() || undefined,
      sdr: (fd.get("sdr") ?? "").toString().trim() || undefined,
      businessType: (fd.get("businessType") ?? "").toString().trim() || undefined,
      paymentMethod: (fd.get("paymentMethod") ?? "").toString().trim() || undefined,
      anonymous: fd.get("anonymous") === "on",
      holding: fd.get("holding") === "on",
      affiliate: fd.get("affiliate") === "on",
      express: fd.get("express") === "on",
      notes: (fd.get("notes") ?? "").toString().trim() || undefined,
      items: validItems,
      partners: validPartners,
    };

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const errs: Partial<Record<string, string>> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        const arr = v as string[] | undefined;
        if (arr?.[0]) errs[k] = arr[0];
      }
      setFieldErrors(errs);
      setSubmitting(false);
      return;
    }

    const url = clientId ? `/api/clients/${clientId}` : "/api/clients";
    const method = clientId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(json.error ?? "Erro ao salvar");
      const details = json.details as Record<string, string[] | string> | undefined;
      if (details) {
        const errs: Partial<Record<string, string>> = {};
        Object.entries(details).forEach(([k, v]) => {
          const arr = Array.isArray(v) ? v : [v];
          if (arr[0]) errs[k] = String(arr[0]);
        });
        setFieldErrors(errs);
      }
      setSubmitting(false);
      return;
    }

    router.push("/clients");
    router.refresh();
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
          <div>
            <label htmlFor="businessType" className="block text-sm font-medium text-gray-700">
              Tipo de Negócio
            </label>
            <input
              id="businessType"
              name="businessType"
              type="text"
              defaultValue={defaultValues.businessType}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
              Pagamento via
            </label>
            <input
              id="paymentMethod"
              name="paymentMethod"
              type="text"
              defaultValue={defaultValues.paymentMethod}
              placeholder="Stripe, PIX, etc."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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

      {/* ITENS */}
      <section className="space-y-4">
        <h2 className="border-b border-gray-200 pb-2 text-base font-semibold uppercase tracking-wide text-gray-600">
          Itens (Tipo | Descrição | Valor | Sale Date | Comercial | SDR)
        </h2>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 shadow-sm">
              <div className="min-w-[120px]">
                <label className="block text-xs font-medium text-gray-500">Tipo</label>
                <select
                  value={it.kind}
                  onChange={(e) => updateItem(i, "kind", e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {LINE_ITEM_KINDS.map((k) => (
                    <option key={k} value={k}>{kindLabels[k] ?? k}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[160px] flex-1">
                <label className="block text-xs font-medium text-gray-500">Descrição</label>
                <input
                  name={`item_desc_${i}`}
                  type="text"
                  defaultValue={"description" in it ? String(it.description) : ""}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-gray-500">Valor (US$)</label>
                <input
                  name={`item_value_${i}`}
                  type="text"
                  defaultValue={"valueCents" in it ? formatCentsToDollars(it.valueCents) : "0.00"}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-500">Sale Date</label>
                <input
                  name={`item_saleDate_${i}`}
                  type="date"
                  defaultValue={"saleDate" in it && it.saleDate ? String(it.saleDate) : ""}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="min-w-[100px]">
                <label className="block text-xs font-medium text-gray-500">Comercial</label>
                <select
                  name={`item_commercial_${i}`}
                  value={"commercial" in it ? String(it.commercial ?? "") : ""}
                  onChange={(e) => updateItem(i, "commercial", e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Selecione</option>
                  {commercialOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[100px]">
                <label className="block text-xs font-medium text-gray-500">SDR</label>
                <select
                  name={`item_sdr_${i}`}
                  value={"sdr" in it ? String(it.sdr ?? "") : ""}
                  onChange={(e) => updateItem(i, "sdr", e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Selecione</option>
                  {commercialOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
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
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 shadow-sm">
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

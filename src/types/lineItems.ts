/**
 * Tipos e mappers centralizados para line items (client_line_items).
 * Única fonte de verdade para formas API vs Form (RHF).
 */

import type { LineItemInput } from "@/lib/clientSchemas";
import { ADDRESS_PROVIDER_VALUES, LINE_ITEM_KINDS } from "@/db/schema";
import { getStateByCode, findStateByName } from "@/constants/usStates";
import { LLC_CATEGORIES } from "@/constants/llcCategories";

export type { LineItemInput };

export const ADDRESS_PROVIDER_OPTIONS = ADDRESS_PROVIDER_VALUES;

/** Formato do item no form (RHF). Usa dbId para não conflitar com field.id do useFieldArray. */
export type LineItemForm = {
  dbId?: string;
  kind: string;
  description: string;
  valueCents: number;
  saleDate: string | null;
  commercial: string | null;
  sdr: string | null;
  billingPeriod: "Mensal" | "Anual" | null;
  expirationDate: string | null;
  addressProvider: "New Mexico" | "Florida" | "Próprio" | "Agente Registrado" | null;
  addressLine1: string | null;
  addressLine2: string | null;
  steNumber: string | null;
  llcCategory: string | null;
  llcState: string | null;
  llcCustomCategory: string | null;
  paymentMethod: string | null;
  paymentMethodCustom: string | null;
};

const VALID_KINDS = new Set(LINE_ITEM_KINDS);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return ISO_DATE.test(s) ? s.slice(0, 10) : null;
}

function toNum(v: unknown, def: number): number {
  if (v == null) return def;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : def;
}

function toStrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** API/DB → Form: id vira dbId. */
export function lineItemFromApi(li: {
  id?: string;
  kind?: string;
  description?: string;
  valueCents?: number;
  saleDate?: string | null;
  commercial?: string | null;
  sdr?: string | null;
  billingPeriod?: string | null;
  expirationDate?: string | null;
  addressProvider?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  steNumber?: string | null;
  llcCategory?: string | null;
  llcState?: string | null;
  llcCustomCategory?: string | null;
  paymentMethod?: string | null;
  paymentMethodCustom?: string | null;
}): LineItemForm {
  const ap = li.addressProvider;
  const validAp =
    ap === "New Mexico" || ap === "Florida" || ap === "Próprio" || ap === "Agente Registrado"
      ? ap
      : null;
  
  // Compatibilidade com dados antigos: tentar derivar llcCategory/llcState de description para LLC
  let llcCategory = toStrNull(li.llcCategory);
  let llcState = toStrNull(li.llcState);
  let llcCustomCategory = toStrNull(li.llcCustomCategory);
  
  if (li.kind === "LLC" && (!llcCategory || !llcState) && li.description) {
    const desc = String(li.description).trim();
    // Tentar parsear formato "Wyoming · Gold" ou "WY · Gold" ou similar
    const parts = desc.split(/[·\-]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const statePart = parts[0];
      const categoryPart = parts[1];
      // Tentar encontrar estado por nome ou código
      const stateMatch = findStateByName(statePart);
      if (stateMatch && !llcState) {
        llcState = stateMatch.code;
      }
      // Tentar encontrar categoria
      if ((LLC_CATEGORIES as readonly string[]).includes(categoryPart) && !llcCategory) {
        llcCategory = categoryPart;
      } else if (!llcCategory) {
        // Se não encontrou categoria conhecida, usar "Personalizado"
        llcCategory = "Personalizado";
        llcCustomCategory = categoryPart;
      }
    } else if (desc && !llcCategory) {
      // Se não conseguiu parsear, usar "Personalizado" com a description inteira
      llcCategory = "Personalizado";
      llcCustomCategory = desc;
    }
  }
  
  return {
    dbId: li.id,
    kind: (li.kind ?? "LLC") as LineItemForm["kind"],
    description: li.description ?? "",
    valueCents: toNum(li.valueCents, 0),
    saleDate: toIsoOrNull(li.saleDate) ?? null,
    commercial: li.commercial != null ? String(li.commercial) : null,
    sdr: li.sdr != null ? String(li.sdr) : null,
    billingPeriod: (li.billingPeriod === "Mensal" || li.billingPeriod === "Anual" ? li.billingPeriod : null) as LineItemForm["billingPeriod"],
    expirationDate: toIsoOrNull(li.expirationDate) ?? null,
    addressProvider: validAp,
    addressLine1: toStrNull(li.addressLine1),
    addressLine2: toStrNull(li.addressLine2),
    steNumber: toStrNull(li.steNumber),
    llcCategory,
    llcState,
    llcCustomCategory,
    paymentMethod: toStrNull(li.paymentMethod),
    paymentMethodCustom: toStrNull(li.paymentMethodCustom),
  };
}

/** Form → API: dbId vira id. */
export function lineItemToApi(form: LineItemForm): LineItemInput {
  // Para LLC: gerar description automático se não existir
  let description = form.description;
  if (form.kind === "LLC" && form.llcCategory && form.llcState) {
    const state = getStateByCode(form.llcState);
    const stateName = state?.name ?? form.llcState;
    const category = form.llcCategory === "Personalizado" && form.llcCustomCategory
      ? form.llcCustomCategory
      : form.llcCategory;
    description = `${stateName} · ${category}`;
  }
  
  return {
    id: form.dbId,
    kind: form.kind as LineItemInput["kind"],
    description,
    valueCents: form.valueCents,
    saleDate: form.saleDate,
    commercial: form.commercial,
    sdr: form.sdr,
    billingPeriod: form.kind === "Endereco" ? (form.billingPeriod ?? "Mensal") : null,
    expirationDate: form.kind === "Endereco" && form.billingPeriod === "Anual" ? form.expirationDate : null,
    addressProvider: form.kind === "Endereco" ? form.addressProvider : null,
    addressLine1: form.kind === "Endereco" ? form.addressLine1 : null,
    addressLine2: form.kind === "Endereco" ? form.addressLine2 : null,
    steNumber: form.kind === "Endereco" ? form.steNumber : null,
    llcCategory: form.kind === "LLC" ? form.llcCategory : null,
    llcState: form.kind === "LLC" ? form.llcState : null,
    llcCustomCategory: form.kind === "LLC" && form.llcCategory === "Personalizado" ? form.llcCustomCategory : null,
    paymentMethod: form.paymentMethod,
    paymentMethodCustom: form.paymentMethod === "Outro" ? form.paymentMethodCustom : null,
  };
}

/** Resultado da normalização de payload legado (items) para LineItemInput[]. */
export type NormalizeLineItemsResult =
  | { ok: true; items: LineItemInput[] }
  | { ok: false; error: string; status?: number };

/**
 * Normaliza array bruto (legado "items" ou "lineItems") para LineItemInput[].
 * - Aceita "type" como alias de "kind" (loga warning em dev).
 * - kind vazio ou inválido => rejeita com 400.
 */
export function normalizeLegacyToLineItemInputArray(raw: unknown): NormalizeLineItemsResult {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "lineItems/items deve ser um array", status: 400 };
  }
  const items: LineItemInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (row == null || typeof row !== "object") {
      return { ok: false, error: `Item na posição ${i} é inválido`, status: 400 };
    }
    const o = row as Record<string, unknown>;
    const kindRaw = (o.kind ?? o.type) as string | undefined;
    if (process.env.NODE_ENV === "development" && o.type != null && o.kind == null) {
      console.warn("[lineItems] item com campo legado 'type' usado como 'kind'");
    }
    const kind = typeof kindRaw === "string" ? kindRaw.trim() : "";
    if (!kind) {
      return { ok: false, error: `Item na posição ${i}: campo 'kind' é obrigatório`, status: 400 };
    }
    if (!VALID_KINDS.has(kind as (typeof LINE_ITEM_KINDS)[number])) {
      return { ok: false, error: `Item na posição ${i}: 'kind' inválido (${kind})`, status: 400 };
    }
    const ap = o.addressProvider;
    const validAp =
      ap === "New Mexico" || ap === "Florida" || ap === "Próprio" || ap === "Agente Registrado"
        ? ap
        : null;
    items.push({
      id: typeof o.id === "string" && /^[0-9a-f-]{36}$/i.test(o.id) ? o.id : undefined,
      kind: kind as LineItemInput["kind"],
      description: typeof o.description === "string" ? o.description.slice(0, 2000) : "",
      valueCents: toNum(o.valueCents, 0),
      saleDate: toIsoOrNull(o.saleDate),
      commercial: o.commercial != null ? String(o.commercial) : null,
      sdr: o.sdr != null ? String(o.sdr) : null,
      billingPeriod: (o.billingPeriod === "Mensal" || o.billingPeriod === "Anual" ? o.billingPeriod : null) as LineItemInput["billingPeriod"] | null,
      expirationDate: toIsoOrNull(o.expirationDate),
      addressProvider: validAp,
      addressLine1: o.addressLine1 != null ? String(o.addressLine1).trim().slice(0, 500) || null : null,
      addressLine2: o.addressLine2 != null ? String(o.addressLine2).trim().slice(0, 500) || null : null,
      steNumber: o.steNumber != null ? String(o.steNumber).trim().slice(0, 20) || null : null,
      llcCategory: kind === "LLC" ? (o.llcCategory != null ? String(o.llcCategory).trim() || null : null) : null,
      llcState: kind === "LLC" ? (o.llcState != null ? String(o.llcState).trim().toUpperCase().slice(0, 2) || null : null) : null,
      llcCustomCategory: kind === "LLC" && o.llcCategory === "Personalizado" ? (o.llcCustomCategory != null ? String(o.llcCustomCategory).trim().slice(0, 200) || null : null) : null,
      paymentMethod: o.paymentMethod != null ? String(o.paymentMethod).trim().slice(0, 100) || null : null,
      paymentMethodCustom: o.paymentMethod === "Outro" && o.paymentMethodCustom != null ? String(o.paymentMethodCustom).trim().slice(0, 200) || null : null,
    });
  }
  return { ok: true, items };
}

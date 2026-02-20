/**
 * Normaliza line item para persistência no DB.
 * Server autoritativo: para Endereço New Mexico/Florida sobrescreve addressLine1/2.
 */

import type { BillingPeriod, LineItemKind, CommercialSdr, AddressProvider } from "@/db/schema";
import { addOneYear } from "@/lib/dates/addOneYear";
import { getStateByCode } from "@/constants/usStates";

const ADDRESS_NM_LINE2 = "Clovis, NM, 88101";
const ADDRESS_FL_LINE1 = "6407 Magnolia St";
const ADDRESS_FL_LINE2 = "Milton, FL, 32570";

function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mm - 1, d));
}

export function computeExpirationIsoFromSaleDate(iso: string): string | null {
  const sale = parseIsoDate(iso);
  if (!sale) return null;
  return addOneYear(sale).toISOString().slice(0, 10);
}

export type LineItemForDb = {
  kind: LineItemKind;
  description: string;
  valueCents: number;
  saleDate: string | null;
  billingPeriod: BillingPeriod | null;
  expirationDate: string | null;
  commercial: CommercialSdr | null;
  sdr: CommercialSdr | null;
  addressProvider: AddressProvider | null;
  addressLine1: string | null;
  addressLine2: string | null;
  steNumber: string | null;
  llcCategory: string | null;
  llcState: string | null;
  llcCustomCategory: string | null;
};

export function normalizeLineItemForDb(item: {
  kind: string;
  description?: string;
  valueCents?: number;
  saleDate?: string | null;
  billingPeriod?: string | null;
  expirationDate?: string | null;
  commercial?: string | null;
  sdr?: string | null;
  addressProvider?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  steNumber?: string | null;
  llcCategory?: string | null;
  llcState?: string | null;
  llcCustomCategory?: string | null;
}): LineItemForDb {
  const isEndereco = item.kind === "Endereco";
  const billingPeriod: BillingPeriod | null = isEndereco
    ? ((item.billingPeriod ?? "Mensal") as BillingPeriod)
    : null;
  const saleDate = item.saleDate?.trim() || null;
  const expirationDate =
    isEndereco && billingPeriod === "Anual" && saleDate
      ? computeExpirationIsoFromSaleDate(saleDate)
      : isEndereco && billingPeriod === "Mensal"
        ? null
        : null;
  const rawCents = Number(item.valueCents);
  const valueCents = Number.isFinite(rawCents) && rawCents >= 0 ? Math.round(rawCents) : 0;

  // Normalização para LLC: gerar description automático e validar campos
  const isLLC = item.kind === "LLC";
  let llcCategory: string | null = null;
  let llcState: string | null = null;
  let llcCustomCategory: string | null = null;
  let description = String(item.description ?? "").trim();
  
  if (isLLC) {
    llcCategory = item.llcCategory?.trim() || null;
    llcState = item.llcState?.trim().toUpperCase().slice(0, 2) || null;
    llcCustomCategory = item.llcCategory === "Personalizado" && item.llcCustomCategory
      ? item.llcCustomCategory.trim().slice(0, 200)
      : null;
    
    // Gerar description automático: "Estado · Categoria"
    if (llcCategory && llcState) {
      const state = getStateByCode(llcState);
      const stateName = state?.name ?? llcState;
      const category = llcCategory === "Personalizado" && llcCustomCategory
        ? llcCustomCategory
        : llcCategory;
      description = `${stateName} · ${category}`;
    }
  }

  let addressProvider: AddressProvider | null = null;
  let addressLine1: string | null = null;
  let addressLine2: string | null = null;
  let steNumber: string | null = null;
  if (isEndereco && item.addressProvider) {
    const ap = item.addressProvider as AddressProvider;
    if (ap === "New Mexico" || ap === "Florida" || ap === "Próprio" || ap === "Agente Registrado") {
      addressProvider = ap;
      const ste = item.steNumber?.trim() || null;
      if (ap === "New Mexico") {
        steNumber = ste;
        addressLine1 = `412 W 7th St STE ${ste || "____"}`;
        addressLine2 = ADDRESS_NM_LINE2;
      } else if (ap === "Florida") {
        addressLine1 = ADDRESS_FL_LINE1;
        addressLine2 = ADDRESS_FL_LINE2;
      } else {
        addressLine1 = item.addressLine1?.trim() || null;
        addressLine2 = item.addressLine2?.trim() || null;
      }
    }
  }

  return {
    kind: item.kind as LineItemKind,
    description,
    valueCents,
    saleDate,
    billingPeriod,
    expirationDate,
    commercial: (item.commercial as CommercialSdr) ?? null,
    sdr: (item.sdr as CommercialSdr) ?? null,
    addressProvider,
    addressLine1,
    addressLine2,
    steNumber,
    llcCategory: isLLC ? llcCategory : null,
    llcState: isLLC ? llcState : null,
    llcCustomCategory: isLLC ? llcCustomCategory : null,
  };
}

/**
 * Parse uma linha do CSV em { clientPatch, partners?, items? } e errors.
 */

import type { HeaderMap } from "./mapHeaders";
import {
  normalizeDate,
  normalizeMoney,
  normalizeCommercial,
  normalizePhone,
} from "./normalizers";

export type ParseRowResult = {
  clientPatch: {
    companyName: string;
    paymentDate: string | null;
    commercial: string | null;
    sdr: string | null;
    businessType: string | null;
    paymentMethod: string | null;
    notes: string | null;
    anonymous: boolean;
    holding: boolean;
    affiliate: boolean;
    express: boolean;
  };
  partners: { fullName: string; role: "SocioPrincipal" | "Socio"; percentage: number; phone: string | null }[];
  items: { kind: "Outro"; description: string; valueCents: number }[];
  errors: { row: number; field: string; message: string }[];
};

const PHONE_PREFERENCE = ["telefone_1", "whatsapp", "telefone", "phone"];
function getValue(row: Record<string, string>, map: HeaderMap, target: string): string | undefined {
  if (target === "phone") {
    for (const col of PHONE_PREFERENCE) {
      if (map[col] === "phone" && row[col]?.trim()) return row[col]!.trim();
    }
  }
  for (const [csvCol, internal] of Object.entries(map)) {
    if (internal === target && row[csvCol] !== undefined) {
      const v = row[csvCol]?.trim();
      if (v) return v;
    }
  }
  return undefined;
}

export function parseRow(
  rowIndex: number,
  row: Record<string, string>,
  headerMap: HeaderMap
): ParseRowResult {
  const errors: { row: number; field: string; message: string }[] = [];
  const companyName = getValue(row, headerMap, "companyName") ?? "";
  const paymentDate = normalizeDate(getValue(row, headerMap, "paymentDate") ?? undefined);
  const commercial = normalizeCommercial(getValue(row, headerMap, "commercial") ?? undefined);
  const sdr = normalizeCommercial(getValue(row, headerMap, "sdr") ?? undefined);
  const businessType = getValue(row, headerMap, "businessType") ?? null;
  const paymentMethod = getValue(row, headerMap, "paymentMethod") ?? null;
  const notes = getValue(row, headerMap, "notes") ?? null;

  const phoneRaw = getValue(row, headerMap, "phone") ?? undefined;
  const phone = normalizePhone(phoneRaw);

  const partnerPrincipal = getValue(row, headerMap, "partnerPrincipal") ?? "";
  const partner2 = getValue(row, headerMap, "partner2");
  const partner3 = getValue(row, headerMap, "partner3");
  const partner4 = getValue(row, headerMap, "partner4");
  const partner5 = getValue(row, headerMap, "partner5");
  const partner6 = getValue(row, headerMap, "partner6");

  const lineItemDesc = getValue(row, headerMap, "lineItemDescription");
  const lineItemVal = getValue(row, headerMap, "lineItemValue");

  if (!companyName.trim()) {
    errors.push({ row: rowIndex, field: "companyName", message: "Empresa é obrigatória" });
  }

  const partners: ParseRowResult["partners"] = [];
  if (partnerPrincipal?.trim()) {
    partners.push({
      fullName: partnerPrincipal.trim(),
      role: "SocioPrincipal",
      percentage: 100,
      phone,
    });
  }
  for (const name of [partner2, partner3, partner4, partner5, partner6]) {
    if (name?.trim()) {
      partners.push({
        fullName: name.trim(),
        role: "Socio",
        percentage: 0,
        phone: null,
      });
    }
  }
  if (partners.length > 1) {
    const pct = Math.floor(100 / partners.length);
    const remainder = 100 - pct * partners.length;
    partners.forEach((p, i) => {
      p.percentage = pct + (i === 0 ? remainder : 0);
    });
  }

  const items: ParseRowResult["items"] = [];
  if (lineItemDesc && lineItemVal) {
    const cents = normalizeMoney(lineItemVal);
    items.push({
      kind: "Outro",
      description: lineItemDesc.trim(),
      valueCents: cents,
    });
  } else if (lineItemVal) {
    const cents = normalizeMoney(lineItemVal);
    if (cents > 0) {
      items.push({
        kind: "Outro",
        description: "Valor importado",
        valueCents: cents,
      });
    }
  }

  return {
    clientPatch: {
      companyName: companyName.trim() || "Sem nome",
      paymentDate,
      commercial,
      sdr,
      businessType,
      paymentMethod,
      notes,
      anonymous: false,
      holding: false,
      affiliate: false,
      express: false,
    },
    partners,
    items,
    errors,
  };
}

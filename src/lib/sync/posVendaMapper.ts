/**
 * Mapeia linhas do Google Sheets (Pós-Venda LLC) para clients + line_items + partners.
 */

import { createHash } from "crypto";
import { normalizeCompanyName } from "@/lib/clientDedupe";
import type { CommercialSdr, LineItemKind, PartnerRole } from "@/db/schema";
import { COMMERCIAL_SDR_VALUES } from "@/db/schema";

export type ClientPatch = {
  companyName: string;
  companyNameNormalized: string;
  customerCode: string | null;
  paymentDate: string | null;
  commercial: CommercialSdr | null;
  sdr: CommercialSdr | null;
  businessType: string | null;
  paymentMethod: string | null;
  anonymous: boolean;
  holding: boolean;
  affiliate: boolean;
  express: boolean;
  notes: string | null;
};

export type LineItem = {
  kind: LineItemKind;
  description: string;
  valueCents: number;
  meta?: Record<string, unknown>;
};

export type Partner = {
  fullName: string;
  role: PartnerRole;
  percentage: number;
  phone: string | null;
};

export type ParsedPosVendaRow = {
  clientPatch: ClientPatch;
  partners: Partner[];
  items: LineItem[];
  meta?: {
    mergedDocId?: string;
    mergedDocUrl?: string;
    mergeStatus?: string;
    naics?: string;
    origem?: string;
    [key: string]: unknown;
  };
};

function parseDate(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  const ddmmyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (ddmmyy) {
    const [, d, m, y] = ddmmyy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const date = new Date(t);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseBool(val: string): boolean {
  const v = String(val || "").trim().toLowerCase();
  return ["1", "true", "sim", "sí", "si", "yes", "s", "y"].includes(v);
}

function parseCents(val: string): number | null {
  const s = String(val || "").trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

function parsePercent(val: string): number | null {
  const s = String(val || "").trim().replace(",", ".");
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : Math.min(100, Math.max(0, n));
}

function normalizeCommercial(val: string): CommercialSdr | null {
  const v = String(val || "").trim();
  const match = COMMERCIAL_SDR_VALUES.find(
    (c) => c.toLowerCase() === v.toLowerCase() || c.toLowerCase().startsWith(v.toLowerCase())
  );
  return match ?? null;
}

function deterministicCustomerCode(companyNameNormalized: string): string {
  const hash = createHash("sha256").update(companyNameNormalized).digest("hex").slice(0, 12).toUpperCase();
  return `PV-${hash}`;
}

function pick<K extends string>(row: Record<string, string>, ...keys: K[]): string {
  for (const k of keys) {
    const v = row[k]?.trim();
    if (v) return v;
  }
  return "";
}

export function parsePosVendaRow(row: Record<string, string>): ParsedPosVendaRow | null {
  const companyName = pick(
    row,
    "empresa",
    "company_name",
    "companyname",
    "nome_empresa"
  );
  if (!companyName) return null;

  const companyNameNormalized = normalizeCompanyName(companyName);
  const customerCodeRaw = pick(row, "no", "n", "numero", "registro", "codigo", "codigo_cliente");
  const customerCode = customerCodeRaw ? customerCodeRaw : null;

  const paymentDate = parseDate(
    pick(row, "pagamento", "payment_date", "data_pagamento")
  );

  const commercial = normalizeCommercial(
    pick(row, "comercial", "commercial", "operador")
  );
  const sdr = normalizeCommercial(pick(row, "sdr"));
  const businessType = pick(
    row,
    "tipo_de_negocio",
    "business_type",
    "tipo_negocio"
  );
  const paymentMethod = pick(
    row,
    "forma_de_pgto",
    "forma_pgto",
    "payment_method",
    "pagamento_via"
  );
  const anonymous = parseBool(pick(row, "anonimo", "anonimo_2", "anonymous"));
  const holding = parseBool(pick(row, "holding"));
  const affiliate = parseBool(pick(row, "filiado", "affiliate"));
  const express = parseBool(pick(row, "express"));
  const notes = pick(row, "observacao", "observacao_2", "notes", "notas") || null;

  const clientPatch: ClientPatch = {
    companyName,
    companyNameNormalized,
    customerCode,
    paymentDate,
    commercial,
    sdr,
    businessType: businessType || null,
    paymentMethod: paymentMethod || null,
    anonymous,
    holding,
    affiliate,
    express,
    notes,
  };

  const items: LineItem[] = [];
  const llcVal = parseCents(pick(row, "valor_llc", "valor_llc_2"));
  if (llcVal != null && llcVal >= 0) {
    const llcDesc = [pick(row, "llc", "llc_2"), pick(row, "pacote", "pacote_2")]
      .filter(Boolean)
      .join(" · ");
    items.push({
      kind: "LLC",
      description: llcDesc || "LLC",
      valueCents: llcVal,
      meta: { pacote: pick(row, "pacote", "pacote_2") || undefined },
    });
  }
  const enderecoVal = parseCents(pick(row, "valor_endereco", "valor_endereco_2"));
  if (enderecoVal != null && enderecoVal >= 0) {
    const endDesc = [
      pick(row, "endereco", "endereco_2"),
      pick(row, "mailing_address", "mailing_address_2"),
      pick(row, "second_line", "second_line_2"),
    ]
      .filter(Boolean)
      .join(" · ");
    items.push({
      kind: "Endereco",
      description: endDesc || "Endereço",
      valueCents: enderecoVal,
      meta: {
        mailingAddress: pick(row, "mailing_address", "mailing_address_2") || undefined,
        secondLine: pick(row, "second_line", "second_line_2") || undefined,
      },
    });
  }
  const gatewayVal = parseCents(pick(row, "valor_gateway", "valor_gateway_2"));
  if (gatewayVal != null && gatewayVal >= 0) {
    const desc = pick(row, "gateway", "gateway_2") || "Gateway";
    items.push({ kind: "Gateway", description: desc, valueCents: gatewayVal });
  }
  const servVal = parseCents(pick(row, "valor_serv_adicional", "valor_serv_adicional_2"));
  if (servVal != null && servVal >= 0) {
    const desc = pick(row, "serv_adicional", "serv_adicional_2") || "Serv. Adicional";
    items.push({ kind: "ServicoAdicional", description: desc, valueCents: servVal });
  }
  const btVal = parseCents(pick(row, "valor_b_tradicional", "valor_banco_tradicional"));
  if (btVal != null && btVal >= 0) {
    const desc = pick(row, "banco_tradicional", "banco_tradicional_2") || "Banco Tradicional";
    items.push({ kind: "BancoTradicional", description: desc, valueCents: btVal });
  }
  const mensVal = parseCents(pick(row, "valor_mensalidade", "valor_mensalidade_2"));
  if (mensVal != null && mensVal >= 0) {
    const modalidade = pick(row, "modalidade", "modalidade_2");
    const desc = [pick(row, "mensalidade", "mensalidade_2"), modalidade].filter(Boolean).join(" · ") || "Mensalidade";
    items.push({
      kind: "Mensalidade",
      description: desc,
      valueCents: mensVal,
      meta: { modalidade: modalidade || undefined },
    });
  }
  const partners: Partner[] = [];
  const numSocios = parseInt(pick(row, "no_socios", "numero_socios", "n_socios"), 10) || 5;
  const limit = Math.min(5, Math.max(1, numSocios));

  const fullName1 =
    [pick(row, "given_name", "given_name_2"), pick(row, "sur_name", "sur_name_2")]
      .filter(Boolean)
      .join(" ")
      .trim() || pick(row, "socio_a_principal", "socio_principal");
  const pct1 = parsePercent(pick(row, "porcentagem_1", "porcentagem_1_2"));
  const phone1 =
    pick(row, "telefone_americano_1", "telefone_americano_1_2") ||
    pick(row, "telefone_1", "telefone_1_2");
  if (fullName1 && (pct1 != null || limit >= 1)) {
    partners.push({
      fullName: fullName1,
      role: "SocioPrincipal",
      percentage: pct1 ?? 100,
      phone: phone1 || null,
    });
  }

  for (let i = 2; i <= limit; i++) {
    const fullName = pick(
      row,
      `socio_a_${i}`,
      `socio_${i}`,
      `socio_a_${i}_2`,
      `socio_${i}_2`
    );
    const pct = parsePercent(
      pick(row, `porcentagem_${i}`, `porcentagem_${i}_2`)
    );
    const phone =
      pick(row, `telefone_americano_${i}`, `telefone_americano_${i}_2`) ||
      pick(row, `telefone_${i}`, `telefone_${i}_2`);
    if (fullName) {
      partners.push({
        fullName,
        role: "Socio",
        percentage: pct ?? 0,
        phone: phone || null,
      });
    }
  }

  const meta: ParsedPosVendaRow["meta"] = {};
  const naics = pick(row, "naics", "naics_2");
  if (naics) meta.naics = naics;
  const origem = pick(row, "origem", "origem_2");
  if (origem) meta.origem = origem;

  return {
    clientPatch,
    partners,
    items,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
}

export function getPosVendaDeterministicCustomerCode(companyNameNormalized: string): string {
  return deterministicCustomerCode(companyNameNormalized);
}

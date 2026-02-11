/**
 * Mapeamento de colunas CSV -> campos internos.
 * Só ativa mapeamentos para colunas que EXISTEM no CSV.
 *
 * Exemplo de headerMap gerado a partir do CSV real (Base de Dados VulpeInc):
 *
 * {
 *   nome_da_llc: "companyName",
 *   pagamento: "paymentDate",
 *   operador: "commercial",
 *   tipo_de_negocio: "businessType",
 *   nome_completo: "partnerPrincipal",
 *   telefone_1: "phone",
 *   socio_2: "partner2",
 *   socio_3: "partner3",
 *   socio_4: "partner4",
 *   socio_5: "partner5",
 *   socio_6: "partner6",
 *   servicio: "lineItemDescription",
 *   ticket: "lineItemValue",
 * }
 */

export type HeaderMap = Record<string, string>;

const SYNONYMS: Record<string, string> = {
  nome_da_llc: "companyName",
  nome_llc: "companyName",
  llc: "companyName",
  empresa: "companyName",
  company: "companyName",

  pagamento: "paymentDate",
  data_pagamento: "paymentDate",
  payment_date: "paymentDate",

  operador: "commercial",
  comercial: "commercial",

  sdr: "sdr",

  tipo_de_negocio: "businessType",
  business_type: "businessType",

  pagamento_via: "paymentMethod",
  payment_method: "paymentMethod",

  notas: "notes",
  notes: "notes",
  observacao: "notes",
  observações: "notes",

  nome_completo: "partnerPrincipal",
  nome: "partnerPrincipal",
  given_name: "partnerPrincipal",

  telefone_1: "phone",
  telefone: "phone",
  phone: "phone",
  whatsapp: "phone",

  socio_2: "partner2",
  socio_3: "partner3",
  socio_4: "partner4",
  socio_5: "partner5",
  socio_6: "partner6",
  socio: "partner2",

  servicio: "lineItemDescription",
  servico: "lineItemDescription",
  service: "lineItemDescription",

  ticket: "lineItemValue",
  valor: "lineItemValue",
  value: "lineItemValue",
};

export function mapHeadersFromCsv(normalizedHeaders: string[]): HeaderMap {
  const map: HeaderMap = {};
  for (const h of normalizedHeaders) {
    const key = h.trim();
    if (!key) continue;
    const target = SYNONYMS[key];
    if (target) {
      map[key] = target;
    }
  }
  return map;
}

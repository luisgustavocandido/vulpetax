/**
 * Import CSV - módulo principal.
 *
 * Headers encontrados no CSV real (Base de Dados VulpeInc - Página1.csv):
 * xf, nome_completo, given_name, surname, nome_da_llc, estado, exp, asana, drive,
 * ein_num, llc_num, pagamento, llc_start, ein_start, tipo_de_negocio, whatsapp,
 * telefone_1, email, d_formacao, boi_dias, tipo_llc, servicio, ticket,
 * mailing_address, second_line, endereco_residencia_proprietario, m,
 * socio_2, endereco_residencia_2, socio_3, endereco_residencia_3, socio_4,
 * endereco_residencia_4, socio_5, endereco_residencia_5, socio_6,
 * endereco_residencia_6, email_vulpe, senha_vulpe, pais_origem, dob, idade,
 * sexo, origem, indicacao, operador, ar, ubs, ube, ao, ss4, ss4_as, ss4_ev,
 * ein, bank, boir, be_13, op_ag, bank_r, statem, resig
 *
 * Exemplo de headerMap gerado a partir do CSV:
 * {
 *   nome_da_llc: "companyName",
 *   pagamento: "paymentDate",
 *   operador: "commercial",
 *   tipo_de_negocio: "businessType",
 *   nome_completo: "partnerPrincipal",
 *   telefone_1: "phone",
 *   whatsapp: "phone",
 *   socio_2: "partner2", socio_3: "partner3", ...,
 *   servicio: "lineItemDescription",
 *   ticket: "lineItemValue",
 * }
 */

export { detectDelimiter, detectEncoding } from "./detect";
export { normalizeHeader, resetEmptyColCounter } from "./normalizeHeader";
export { parseCsv } from "./parseCsv";
export { mapHeadersFromCsv } from "./mapHeaders";
export type { HeaderMap } from "./mapHeaders";
export { parseRow } from "./parseRow";
export type { ParseRowResult } from "./parseRow";
export * from "./normalizers";

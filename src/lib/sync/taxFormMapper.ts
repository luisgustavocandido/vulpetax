/**
 * Mapeia linhas do Google Sheets (TAX Form) para clients + tax_profile + tax_owners.
 * Mapeia SOMENTE colunas existentes. Nunca gera código aleatório.
 */

import { createHash } from "crypto";
import { normalizeCompanyName } from "@/lib/clientDedupe";

export type ParsedTaxFormRow = {
  client: {
    companyName: string;
    companyNameNormalized: string;
    customerCode: string | null;
    notes: string | null;
  };
  taxProfile: Partial<{
    llcName: string;
    formationDate: string | null;
    activitiesDescription: string;
    einNumber: string;
    llcUsAddressLine1: string;
    llcUsAddressLine2: string;
    llcUsCity: string;
    llcUsState: string;
    llcUsZip: string;
    ownerEmail: string;
    ownerFullLegalName: string;
    ownerResidenceCountry: string;
    ownerCitizenshipCountry: string;
    ownerHomeAddressDifferent: boolean;
    ownerResidentialAddressLine1?: string;
    ownerResidentialAddressLine2?: string;
    ownerResidentialCity?: string;
    ownerResidentialState?: string;
    ownerResidentialPostalCode?: string;
    ownerResidentialCountry?: string;
    ownerUsTaxId: string;
    ownerForeignTaxId: string;
    llcFormationCostUsdCents: number | null;
    hasAdditionalOwners: boolean;
    totalAssetsUsdCents: number | null;
    hasUsBankAccounts: boolean;
    aggregateBalanceOver10k: boolean;
    totalWithdrawalsUsdCents: number | null;
    totalTransferredToLlcUsdCents: number | null;
    totalWithdrawnFromLlcUsdCents: number | null;
    personalExpensesPaidByCompanyUsdCents: number | null;
    businessExpensesPaidPersonallyUsdCents: number | null;
    fbarWithdrawalsTotalUsdCents: number | null;
    fbarPersonalTransfersToLlcUsdCents: number | null;
    fbarPersonalWithdrawalsFromLlcUsdCents: number | null;
    fbarPersonalExpensesPaidByCompanyUsdCents: number | null;
    fbarBusinessExpensesPaidPersonallyUsdCents: number | null;
    passportCopiesProvided: boolean;
    articlesOfOrganizationProvided: boolean;
    einLetterProvided: boolean;
    additionalDocumentsProvided: boolean;
    additionalDocumentsNotes: string;
    declarationAccepted: boolean;
  }>;
  owners: Array<{
    ownerIndex: number;
    email?: string;
    fullLegalName?: string;
    residenceCountry?: string;
    citizenshipCountry?: string;
    homeAddressDifferent?: boolean;
    usTaxId?: string;
    foreignTaxId?: string;
  }>;
};

const PROFILE_MAP: Record<string, string> = {
  llc_name: "llcName",
  llcname: "llcName",
  nombre_de_la_llc: "llcName",
  nombre_de_la_llc_: "llcName",
  formation_date: "formationDate",
  formationdate: "formationDate",
  data_formacao: "formationDate",
  fecha_de_formacion_de_su_llc: "formationDate",
  fecha_de_formacion: "formationDate",
  activities_description: "activitiesDescription",
  activitiesdescription: "activitiesDescription",
  descricao_atividades: "activitiesDescription",
  describa_brevemente_las_actividades_que_desempena_su_empresa: "activitiesDescription",
  describa_brevemente_las_actividades: "activitiesDescription",
  ein_number: "einNumber",
  einnumber: "einNumber",
  ein: "einNumber",
  numero_ein_de_la_empresa: "einNumber",
  numero_ein: "einNumber",
  llc_us_address_line1: "llcUsAddressLine1",
  llc_us_address_line2: "llcUsAddressLine2",
  llc_us_city: "llcUsCity",
  llc_us_state: "llcUsState",
  llc_us_zip: "llcUsZip",
  endereco_linha1: "llcUsAddressLine1",
  endereco_linha2: "llcUsAddressLine2",
  ciudad: "llcUsCity",
  ciudad_: "llcUsCity",
  estado: "llcUsState",
  direccion_de_la_empresa_llc_usa_direccion: "llcUsAddressLine1",
  direccion_de_la_empresa_llc_usa_direccion_linea_2: "llcUsAddressLine2",
  direccion_de_la_empresa_llc_usa_ciudad: "llcUsCity",
  direccion_de_la_empresa_llc_usa_estado: "llcUsState",
  direccion_de_la_empresa_llc_usa_codigo_postal: "llcUsZip",
  direccion: "llcUsAddressLine1",
  direccion_linea_2: "llcUsAddressLine2",
  codigo_postal: "llcUsZip",
  cidade: "llcUsCity",
  cep: "llcUsZip",
  zip: "llcUsZip",
  owner_email: "ownerEmail",
  owneremail: "ownerEmail",
  email: "ownerEmail",
  owner_full_legal_name: "ownerFullLegalName",
  owner_fulllegalname: "ownerFullLegalName",
  ownerfulllegalname: "ownerFullLegalName",
  nome_legal: "ownerFullLegalName",
  nombre_legal_completo_propietario_principal_nombres: "ownerFullLegalName",
  nombre_legal_completo_propietario_principal_apellidos: "ownerFullLegalNameLast",
  owner_residence_country: "ownerResidenceCountry",
  owner_residencecountry: "ownerResidenceCountry",
  pais_residencia: "ownerResidenceCountry",
  cual_es_tu_pais_de_residencia: "ownerResidenceCountry",
  owner_citizenship_country: "ownerCitizenshipCountry",
  owner_citizenshipcountry: "ownerCitizenshipCountry",
  pais_cidadania: "ownerCitizenshipCountry",
  cual_es_tu_pais_de_ciudadania: "ownerCitizenshipCountry",
  owner_home_address_different: "ownerHomeAddressDifferent",
  owner_homeaddressdifferent: "ownerHomeAddressDifferent",
  tu_direccion_particular_es_diferente_a_la_de_tu_empresa: "ownerHomeAddressDifferent",
  endereco_residencial_diferente_da_empresa: "ownerHomeAddressDifferent",
  owner_residential_address_line1: "ownerResidentialAddressLine1",
  endereco_residencial_linha_1: "ownerResidentialAddressLine1",
  owner_residential_address_line2: "ownerResidentialAddressLine2",
  endereco_residencial_linha_2: "ownerResidentialAddressLine2",
  owner_residential_city: "ownerResidentialCity",
  cidade_residencial: "ownerResidentialCity",
  owner_residential_state: "ownerResidentialState",
  estado_residencial: "ownerResidentialState",
  owner_residential_postal_code: "ownerResidentialPostalCode",
  cep_residencial: "ownerResidentialPostalCode",
  owner_residential_country: "ownerResidentialCountry",
  pais_residencial: "ownerResidentialCountry",
  direccion_particular_si_es_diferente_a_la_del_negocio_direccion: "ownerResidentialAddressLine1",
  direccion_particular_si_es_diferente_a_la_del_negocio_direccion_linea_2: "ownerResidentialAddressLine2",
  direccion_particular_si_es_diferente_a_la_del_negocio_ciudad: "ownerResidentialCity",
  direccion_particular_si_es_diferente_a_la_del_negocio_estado: "ownerResidentialState",
  direccion_particular_si_es_diferente_a_la_del_negocio_codigo_postal: "ownerResidentialPostalCode",
  direccion_particular_si_es_diferente_a_la_del_negocio_pais: "ownerResidentialCountry",
  owner_us_tax_id: "ownerUsTaxId",
  owner_ustaxid: "ownerUsTaxId",
  identificacion_fiscal_de_ee_uu_del_propietario_si_corresponde: "ownerUsTaxId",
  owner_foreign_tax_id: "ownerForeignTaxId",
  owner_foreigntaxid: "ownerForeignTaxId",
  identificacion_fiscal_personal_extranjera: "ownerForeignTaxId",
  llc_formation_cost_usd_cents: "llcFormationCostUsdCents",
  llc_formation_cost: "llcFormationCostUsdCents",
  custo_formacao: "llcFormationCostUsdCents",
  cuanto_te_costo_establecer_tu_llc: "llcFormationCostUsdCents",
  has_additional_owners: "hasAdditionalOwners",
  hay_otro_socio_para_agregar: "hasAdditionalOwners",
  total_assets_usd_cents: "totalAssetsUsdCents",
  total_assets: "totalAssetsUsdCents",
  activos_totales_del_negocio_hasta_el_31_de_diciembre: "totalAssetsUsdCents",
  ativos_totais_ate_31_dez_usd: "totalAssetsUsdCents",
  ativos_totais_da_empresa_ate_31_de_dezembro_usd: "totalAssetsUsdCents",
  has_us_bank_accounts: "hasUsBankAccounts",
  la_empresa_tiene_cuentas_bancarias_en_ee_uu_a_nombre_de_la_llc: "hasUsBankAccounts",
  possui_contas_bancarias_nos_eua: "hasUsBankAccounts",
  possui_contas_bancarias_nos_eua_em_nome_da_llc: "hasUsBankAccounts",
  aggregate_balance_over10k: "aggregateBalanceOver10k",
  el_saldo_agregado_mas_alto_de_todas_las_cuentas_supero_los_10000_usd_en_algun_momento_del_ano: "aggregateBalanceOver10k",
  saldo_agregado_superior_a_us_10000_no_ano_fbar: "aggregateBalanceOver10k",
  total_withdrawals_usd_cents: "totalWithdrawalsUsdCents",
  total_de_retiros_durante_el_ultimo_ano_fiscal: "totalWithdrawalsUsdCents",
  total_transferred_to_llc_usd_cents: "totalTransferredToLlcUsdCents",
  total_transferido_pessoalmente_para_llc_usd: "totalTransferredToLlcUsdCents",
  cantidad_total_de_dinero_que_transfirio_personalmente_a_la_llc: "totalTransferredToLlcUsdCents",
  total_withdrawn_from_llc_usd_cents: "totalWithdrawnFromLlcUsdCents",
  total_retirado_pessoalmente_da_llc_usd: "totalWithdrawnFromLlcUsdCents",
  cantidad_total_de_dinero_que_retiro_personalmente_de_la_llc: "totalWithdrawnFromLlcUsdCents",
  personal_expenses_paid_by_company_usd_cents: "personalExpensesPaidByCompanyUsdCents",
  despesas_pessoais_pagas_com_fundos_comerciais_usd: "personalExpensesPaidByCompanyUsdCents",
  monto_total_de_los_gastos_personales_que_pago_con_fondos_comerciales: "personalExpensesPaidByCompanyUsdCents",
  business_expenses_paid_personally_usd_cents: "businessExpensesPaidPersonallyUsdCents",
  despesas_comerciais_pagas_com_fundos_pessoais_usd: "businessExpensesPaidPersonallyUsdCents",
  monto_total_de_los_gastos_comerciales_que_pago_con_fondos_personales: "businessExpensesPaidPersonallyUsdCents",
  fbar_withdrawals_total_usd_cents: "fbarWithdrawalsTotalUsdCents",
  total_retiradas_ultimo_ano_fiscal_usd: "fbarWithdrawalsTotalUsdCents",
  fbar_personal_transfers_to_llc_usd_cents: "fbarPersonalTransfersToLlcUsdCents",
  fbar_personal_withdrawals_from_llc_usd_cents: "fbarPersonalWithdrawalsFromLlcUsdCents",
  fbar_personal_expenses_paid_by_company_usd_cents: "fbarPersonalExpensesPaidByCompanyUsdCents",
  despesas_pessoais_pagas_com_fundos_da_empresa_usd: "fbarPersonalExpensesPaidByCompanyUsdCents",
  fbar_business_expenses_paid_personally_usd_cents: "fbarBusinessExpensesPaidPersonallyUsdCents",
  despesas_da_empresa_pagas_com_fundos_pessoais_usd: "fbarBusinessExpensesPaidPersonallyUsdCents",
  passport_copies_provided: "passportCopiesProvided",
  copia_de_pasaportes_de_los_socios: "passportCopiesProvided",
  articles_of_organization_provided: "articlesOfOrganizationProvided",
  articles_of_organization: "articlesOfOrganizationProvided",
  ein_letter_provided: "einLetterProvided",
  ein_enviado_por_el_irs: "einLetterProvided",
  additional_documents_provided: "additionalDocumentsProvided",
  desea_enviar_un_documento_adicional: "additionalDocumentsProvided",
  additional_documents_notes: "additionalDocumentsNotes",
  documentos_adicionales: "additionalDocumentsNotes",
  que_documentos_todavia_no_ha_compartido: "additionalDocumentsNotes",
  declaration_accepted: "declarationAccepted",
};

function parseUsd(val: string): number | null {
  const s = String(val || "").trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

function parseBool(val: string): boolean {
  const v = String(val || "").trim().toLowerCase();
  return ["1", "true", "sim", "sí", "si", "yes", "s", "y"].includes(v);
}

/** Gera customerCode determinístico a partir do nome normalizado (sem aleatoriedade) */
function deterministicCustomerCode(companyNameNormalized: string): string {
  const hash = createHash("sha256").update(companyNameNormalized).digest("hex").slice(0, 12).toUpperCase();
  return `TAX-${hash}`;
}

/**
 * Mapeia uma linha do sheet para client + tax_profile + owners.
 * Exige companyName para ser válido.
 */
export function parseTaxFormRow(row: Record<string, string>): ParsedTaxFormRow | null {
  const companyName = [
    row.company_name,
    row.companyname,
    row.nome_da_empresa,
    row.empresa,
    row.nombre_de_la_llc,
    row.nombre_de_la_llc_,
  ]
    .find((v) => v?.trim())
    ?.trim();

  if (!companyName) return null;

  const companyNameNormalized = normalizeCompanyName(companyName);
  const customerCodeRaw = [
    row.customer_code,
    row.customercode,
    row.codigo,
    row.codigo_cliente,
  ]
    .find((v) => v?.trim())
    ?.trim();
  const customerCode = customerCodeRaw || null;

  const notesRaw = [row.notes, row.observacoes, row.notas].find((v) => v?.trim())?.trim();
  const notes = notesRaw || null;

  const client = {
    companyName,
    companyNameNormalized,
    customerCode,
    notes,
  };

  const taxProfile: ParsedTaxFormRow["taxProfile"] = {};
  for (const header of Object.keys(row)) {
    const field = PROFILE_MAP[header];
    if (!field) continue;
    const val = row[header];
    if (val === undefined || val === "") continue;
    switch (field) {
      case "formationDate":
        taxProfile.formationDate = val || null;
        break;
      case "llcFormationCostUsdCents":
      case "totalAssetsUsdCents":
      case "totalWithdrawalsUsdCents":
      case "totalTransferredToLlcUsdCents":
      case "totalWithdrawnFromLlcUsdCents":
      case "personalExpensesPaidByCompanyUsdCents":
      case "businessExpensesPaidPersonallyUsdCents":
      case "fbarWithdrawalsTotalUsdCents":
      case "fbarPersonalTransfersToLlcUsdCents":
      case "fbarPersonalWithdrawalsFromLlcUsdCents":
      case "fbarPersonalExpensesPaidByCompanyUsdCents":
      case "fbarBusinessExpensesPaidPersonallyUsdCents":
        const n = parseUsd(val);
        if (n !== null && n >= 0) (taxProfile as Record<string, number | null>)[field] = n;
        break;
      case "ownerFullLegalNameLast":
        taxProfile.ownerFullLegalName = [
          taxProfile.ownerFullLegalName,
          val,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        break;
      case "ownerHomeAddressDifferent":
      case "hasAdditionalOwners":
      case "hasUsBankAccounts":
      case "aggregateBalanceOver10k":
      case "passportCopiesProvided":
      case "articlesOfOrganizationProvided":
      case "einLetterProvided":
      case "additionalDocumentsProvided":
      case "declarationAccepted":
        (taxProfile as Record<string, boolean>)[field] = parseBool(val);
        break;
      default:
        (taxProfile as Record<string, string>)[field] = val;
    }
  }

  // Owners adicionais (2-5): colunas owner_2_*, propietario_2_*, ou cual_es_tu_pais_*_2, *_3, etc.
  const owners: ParsedTaxFormRow["owners"] = [];
  for (let idx = 2; idx <= 5; idx++) {
    const prefix = `owner_${idx}_`;
    const propPrefix = `nombre_legal_completo_propietario_${idx}`;
    const fullLegalName =
      [row[`${prefix}full_legal_name`], row[`owner${idx}fulllegalname`]]
        .concat(
          [
            row[`${propPrefix}_nombres`],
            row[`${propPrefix}_apellidos`],
          ].filter(Boolean)
        )
        .filter(Boolean)
        .join(" ")
        .trim() ||
      row[`${propPrefix}_nombres`] ||
      row[`${propPrefix}_apellidos`];
    const residenceCountry =
      row[`${prefix}residence_country`] ||
      row[`owner${idx}residencecountry`] ||
      row[`cual_es_tu_pais_de_residencia_${idx}`];
    const citizenshipCountry =
      row[`${prefix}citizenship_country`] ||
      row[`owner${idx}citizenshipcountry`] ||
      row[`cual_es_tu_pais_de_ciudadania_${idx}`];
    const homeAddr =
      row[`${prefix}home_address_different`] ||
      row[`owner${idx}homeaddressdifferent`] ||
      row[`tu_direccion_particular_es_diferente_a_la_de_tu_empresa_${idx}`];
    const usTaxId =
      row[`${prefix}us_tax_id`] ||
      row[`owner${idx}ustaxid`] ||
      row[`identificacion_fiscal_de_ee_uu_del_propietario_si_corresponde_${idx}`];
    const foreignTaxId =
      row[`${prefix}foreign_tax_id`] ||
      row[`owner${idx}foreigntaxid`] ||
      row[`identificacion_fiscal_personal_extranjera_${idx}`];

    const hasAny =
      fullLegalName?.trim() ||
      residenceCountry?.trim() ||
      citizenshipCountry?.trim() ||
      usTaxId?.trim() ||
      foreignTaxId?.trim();
    if (!hasAny) continue;

    owners.push({
      ownerIndex: idx,
      fullLegalName: fullLegalName?.trim() || undefined,
      residenceCountry: residenceCountry?.trim() || undefined,
      citizenshipCountry: citizenshipCountry?.trim() || undefined,
      homeAddressDifferent: parseBool(homeAddr ?? ""),
      usTaxId: usTaxId?.trim() || undefined,
      foreignTaxId: foreignTaxId?.trim() || undefined,
    });
  }

  if (!taxProfile.llcName && companyName) {
    taxProfile.llcName = companyName;
  }
  const hasResidentialData = !!(
    taxProfile.ownerResidentialAddressLine1?.trim() ||
    taxProfile.ownerResidentialAddressLine2?.trim() ||
    taxProfile.ownerResidentialCity?.trim() ||
    taxProfile.ownerResidentialState?.trim() ||
    taxProfile.ownerResidentialPostalCode?.trim() ||
    taxProfile.ownerResidentialCountry?.trim()
  );
  if (hasResidentialData && taxProfile.ownerHomeAddressDifferent !== false) {
    taxProfile.ownerHomeAddressDifferent = true;
  }
  // Regra: se hasUsBankAccounts=false, aggregateBalanceOver10k deve ser false
  if (taxProfile.hasUsBankAccounts === false) {
    taxProfile.aggregateBalanceOver10k = false;
  }
  // Regra: se ownerHomeAddressDifferent=false, zerar os campos de endereço residencial
  if (taxProfile.ownerHomeAddressDifferent !== true) {
    taxProfile.ownerResidentialAddressLine1 = undefined;
    taxProfile.ownerResidentialAddressLine2 = undefined;
    taxProfile.ownerResidentialCity = undefined;
    taxProfile.ownerResidentialState = undefined;
    taxProfile.ownerResidentialPostalCode = undefined;
    taxProfile.ownerResidentialCountry = undefined;
  }
  // Regra FBAR: se FBAR não aplicável, zerar os 5 campos FBAR
  const fbarApplicable = taxProfile.hasUsBankAccounts === true && taxProfile.aggregateBalanceOver10k === true;
  if (!fbarApplicable) {
    taxProfile.fbarWithdrawalsTotalUsdCents = null;
    taxProfile.fbarPersonalTransfersToLlcUsdCents = null;
    taxProfile.fbarPersonalWithdrawalsFromLlcUsdCents = null;
    taxProfile.fbarPersonalExpensesPaidByCompanyUsdCents = null;
    taxProfile.fbarBusinessExpensesPaidPersonallyUsdCents = null;
  }
  return {
    client,
    taxProfile: Object.keys(taxProfile).length > 0 ? taxProfile : {},
    owners,
  };
}

export function getDeterministicCustomerCode(companyNameNormalized: string): string {
  return deterministicCustomerCode(companyNameNormalized);
}

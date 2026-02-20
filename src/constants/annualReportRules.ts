/**
 * Regras de Annual Report por estado americano.
 * Define frequência e tipo de vencimento para cada estado.
 */

export type AnnualReportFrequency = "Anual" | "Bienal" | "Nenhum";

export type AnnualReportDueType =
  | "fixed-date"
  | "anniversary-month"
  | "anniversary-quarter"
  | "fiscal-month-4"
  | "after-formation-days";

export type AnnualReportRule = {
  stateCode: string;
  stateName: string;
  frequency: AnnualReportFrequency;
  dueType: AnnualReportDueType;
  month?: number; // 1-12 para fixed-date, anniversary-month
  day?: number; // 1-31 para fixed-date, anniversary-month
  offsetDays?: number; // Para after-formation-days
  note?: string;
};

/**
 * Regras de Annual Report por estado.
 * Estados não cadastrados não geram obrigações.
 */
export const ANNUAL_REPORT_RULES: AnnualReportRule[] = [
  // Wyoming - Anual, mês de aniversário
  {
    stateCode: "WY",
    stateName: "Wyoming",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário da formação",
  },
  // Florida - Anual, data fixa 1 de maio
  {
    stateCode: "FL",
    stateName: "Florida",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 5,
    day: 1,
    note: "Vencimento fixo em 1º de maio",
  },
  // Delaware - Anual, mês de aniversário
  {
    stateCode: "DE",
    stateName: "Delaware",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Nevada - Anual, último dia do mês de aniversário
  {
    stateCode: "NV",
    stateName: "Nevada",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Texas - Anual, mês de aniversário
  {
    stateCode: "TX",
    stateName: "Texas",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // California - Anual, trimestre de aniversário
  {
    stateCode: "CA",
    stateName: "California",
    frequency: "Anual",
    dueType: "anniversary-quarter",
    note: "Vencimento no último dia do trimestre de aniversário",
  },
  // New York - Bienal, mês de aniversário
  {
    stateCode: "NY",
    stateName: "New York",
    frequency: "Bienal",
    dueType: "anniversary-month",
    note: "Vencimento bienal no último dia do mês de aniversário",
  },
  // Colorado - Anual, mês de aniversário
  {
    stateCode: "CO",
    stateName: "Colorado",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Utah - Anual, mês de aniversário
  {
    stateCode: "UT",
    stateName: "Utah",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Montana - Anual, mês de aniversário
  {
    stateCode: "MT",
    stateName: "Montana",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // South Dakota - Anual, mês de aniversário
  {
    stateCode: "SD",
    stateName: "South Dakota",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // North Dakota - Anual, mês de aniversário
  {
    stateCode: "ND",
    stateName: "North Dakota",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Idaho - Anual, mês de aniversário
  {
    stateCode: "ID",
    stateName: "Idaho",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Oregon - Anual, mês de aniversário
  {
    stateCode: "OR",
    stateName: "Oregon",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Washington - Anual, mês de aniversário
  {
    stateCode: "WA",
    stateName: "Washington",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Alaska - Anual, mês de aniversário
  {
    stateCode: "AK",
    stateName: "Alaska",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Hawaii - Anual, mês de aniversário
  {
    stateCode: "HI",
    stateName: "Hawaii",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Maine - Anual, mês de aniversário
  {
    stateCode: "ME",
    stateName: "Maine",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // New Hampshire - Anual, mês de aniversário
  {
    stateCode: "NH",
    stateName: "New Hampshire",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Vermont - Anual, mês de aniversário
  {
    stateCode: "VT",
    stateName: "Vermont",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Massachusetts - Anual, mês de aniversário
  {
    stateCode: "MA",
    stateName: "Massachusetts",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Rhode Island - Anual, mês de aniversário
  {
    stateCode: "RI",
    stateName: "Rhode Island",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Connecticut - Anual, mês de aniversário
  {
    stateCode: "CT",
    stateName: "Connecticut",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // New Jersey - Anual, mês de aniversário
  {
    stateCode: "NJ",
    stateName: "New Jersey",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Pennsylvania - Anual, mês de aniversário
  {
    stateCode: "PA",
    stateName: "Pennsylvania",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Maryland - Anual, mês de aniversário
  {
    stateCode: "MD",
    stateName: "Maryland",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Virginia - Anual, mês de aniversário
  {
    stateCode: "VA",
    stateName: "Virginia",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // West Virginia - Anual, mês de aniversário
  {
    stateCode: "WV",
    stateName: "West Virginia",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // North Carolina - Anual, mês de aniversário
  {
    stateCode: "NC",
    stateName: "North Carolina",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Tennessee - Anual, mês de aniversário
  {
    stateCode: "TN",
    stateName: "Tennessee",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Kentucky - Anual, mês de aniversário
  {
    stateCode: "KY",
    stateName: "Kentucky",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Alabama - Anual, mês de aniversário
  {
    stateCode: "AL",
    stateName: "Alabama",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Mississippi - Anual, mês de aniversário
  {
    stateCode: "MS",
    stateName: "Mississippi",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Louisiana - Anual, mês de aniversário
  {
    stateCode: "LA",
    stateName: "Louisiana",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Arkansas - Anual, mês de aniversário
  {
    stateCode: "AR",
    stateName: "Arkansas",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Oklahoma - Anual, mês de aniversário
  {
    stateCode: "OK",
    stateName: "Oklahoma",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Kansas - Anual, mês de aniversário
  {
    stateCode: "KS",
    stateName: "Kansas",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Nebraska - Anual, mês de aniversário
  {
    stateCode: "NE",
    stateName: "Nebraska",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Iowa - Anual, mês de aniversário
  {
    stateCode: "IA",
    stateName: "Iowa",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Minnesota - Anual, mês de aniversário
  {
    stateCode: "MN",
    stateName: "Minnesota",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Wisconsin - Anual, mês de aniversário
  {
    stateCode: "WI",
    stateName: "Wisconsin",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Illinois - Anual, mês de aniversário
  {
    stateCode: "IL",
    stateName: "Illinois",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Michigan - Anual, mês de aniversário
  {
    stateCode: "MI",
    stateName: "Michigan",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Indiana - Anual, mês de aniversário
  {
    stateCode: "IN",
    stateName: "Indiana",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Georgia - Anual, mês de aniversário
  {
    stateCode: "GA",
    stateName: "Georgia",
    frequency: "Anual",
    dueType: "anniversary-month",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // California - já cadastrado acima
  // Estados sem obrigação (frequency = "Nenhum")
  {
    stateCode: "AZ",
    stateName: "Arizona",
    frequency: "Nenhum",
    dueType: "fixed-date",
    note: "Arizona não exige Annual Report",
  },
  {
    stateCode: "MO",
    stateName: "Missouri",
    frequency: "Nenhum",
    dueType: "fixed-date",
    note: "Missouri não exige Annual Report",
  },
  {
    stateCode: "NM",
    stateName: "New Mexico",
    frequency: "Nenhum",
    dueType: "fixed-date",
    note: "New Mexico não exige Annual Report",
  },
  {
    stateCode: "OH",
    stateName: "Ohio",
    frequency: "Nenhum",
    dueType: "fixed-date",
    note: "Ohio não exige Annual Report",
  },
  {
    stateCode: "SC",
    stateName: "South Carolina",
    frequency: "Nenhum",
    dueType: "fixed-date",
    note: "South Carolina não exige Annual Report",
  },
];

/**
 * Busca regra por código do estado.
 */
export function getAnnualReportRule(stateCode: string): AnnualReportRule | undefined {
  return ANNUAL_REPORT_RULES.find((r) => r.stateCode.toUpperCase() === stateCode.toUpperCase());
}

/**
 * Verifica se o estado tem obrigação de Annual Report.
 */
export function hasAnnualReportObligation(stateCode: string): boolean {
  const rule = getAnnualReportRule(stateCode);
  return rule?.frequency !== "Nenhum";
}

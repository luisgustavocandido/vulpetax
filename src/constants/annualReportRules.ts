/**
 * Regras de Annual Report por estado americano.
 * Define frequência e tipo de vencimento para cada estado.
 *
 * Referência atualizada em 2026.
 */

export type AnnualReportFrequency = "Anual" | "Bienal" | "Nenhum";

export type AnnualReportDueType =
  | "fixed-date"
  | "anniversary-month-start" // 1º dia do mês de aniversário
  | "anniversary-month-end" // Último dia do mês de aniversário
  | "anniversary-quarter"
  | "fiscal-month-4"
  | "after-formation-days"
  | "month-before-anniversary"; // Mês anterior ao aniversário

export type AnnualReportRule = {
  stateCode: string;
  stateName: string;
  frequency: AnnualReportFrequency;
  dueType: AnnualReportDueType;
  month?: number; // 1-12 para fixed-date
  day?: number; // 1-31 para fixed-date
  offsetDays?: number; // Para after-formation-days
  fee?: string; // Taxa aproximada
  note?: string;
};

/**
 * Regras de Annual Report por estado.
 * Estados não cadastrados não geram obrigações.
 */
export const ANNUAL_REPORT_RULES: AnnualReportRule[] = [
  // === ESTADOS COM ANNUAL REPORT ===

  // Alabama - Anual, 15 março
  {
    stateCode: "AL",
    stateName: "Alabama",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 3,
    day: 15,
    fee: "~$100+",
    note: "Vencimento fixo em 15 de março",
  },
  // Alaska - Bienal, 2 janeiro (a cada 2 anos)
  {
    stateCode: "AK",
    stateName: "Alaska",
    frequency: "Bienal",
    dueType: "fixed-date",
    month: 1,
    day: 2,
    fee: "~$100",
    note: "Vencimento bienal em 2 de janeiro",
  },
  // Arkansas - Anual, 1 maio
  {
    stateCode: "AR",
    stateName: "Arkansas",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 5,
    day: 1,
    fee: "~$150",
    note: "Vencimento fixo em 1º de maio",
  },
  // California - Bienal (LLC), 90 dias após abertura / depois bienal
  {
    stateCode: "CA",
    stateName: "California",
    frequency: "Bienal",
    dueType: "after-formation-days",
    offsetDays: 90,
    fee: "~$20",
    note: "Primeiro em 90 dias após formação, depois bienal",
  },
  // Colorado - Anual, fim do mês de aniversário
  {
    stateCode: "CO",
    stateName: "Colorado",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "~$10",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Connecticut - Anual, fim do mês de aniversário
  {
    stateCode: "CT",
    stateName: "Connecticut",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "~$80",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Delaware - Anual, 1 junho (LLC)
  {
    stateCode: "DE",
    stateName: "Delaware",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 6,
    day: 1,
    fee: "~$300",
    note: "Vencimento fixo em 1º de junho para LLCs",
  },
  // Florida - Anual, 1 maio
  {
    stateCode: "FL",
    stateName: "Florida",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 5,
    day: 1,
    fee: "~$138.75",
    note: "Vencimento fixo em 1º de maio",
  },
  // Georgia - Anual, 1 abril
  {
    stateCode: "GA",
    stateName: "Georgia",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 4,
    day: 1,
    fee: "~$50",
    note: "Vencimento fixo em 1º de abril",
  },
  // Hawaii - Anual, fim do trimestre de aniversário
  {
    stateCode: "HI",
    stateName: "Hawaii",
    frequency: "Anual",
    dueType: "anniversary-quarter",
    fee: "~$15",
    note: "Vencimento no fim do trimestre de aniversário",
  },
  // Idaho - Anual, fim do mês de aniversário
  {
    stateCode: "ID",
    stateName: "Idaho",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "$0",
    note: "Vencimento no último dia do mês de aniversário (sem taxa)",
  },
  // Illinois - Anual, antes do mês de aniversário
  {
    stateCode: "IL",
    stateName: "Illinois",
    frequency: "Anual",
    dueType: "month-before-anniversary",
    fee: "~$75",
    note: "Vencimento antes do mês de aniversário",
  },
  // Indiana - Bienal, mês de aniversário
  {
    stateCode: "IN",
    stateName: "Indiana",
    frequency: "Bienal",
    dueType: "anniversary-month-end",
    fee: "~$50",
    note: "Vencimento bienal no mês de aniversário",
  },
  // Iowa - Bienal, 1 abril
  {
    stateCode: "IA",
    stateName: "Iowa",
    frequency: "Bienal",
    dueType: "fixed-date",
    month: 4,
    day: 1,
    fee: "~$60",
    note: "Vencimento bienal em 1º de abril",
  },
  // Kansas - Anual, 15º dia do 4º mês fiscal
  {
    stateCode: "KS",
    stateName: "Kansas",
    frequency: "Anual",
    dueType: "fiscal-month-4",
    day: 15,
    fee: "~$55",
    note: "Vencimento no 15º dia do 4º mês fiscal",
  },
  // Kentucky - Anual, 30 junho
  {
    stateCode: "KY",
    stateName: "Kentucky",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 6,
    day: 30,
    fee: "~$15",
    note: "Vencimento fixo em 30 de junho",
  },
  // Louisiana - Anual, no aniversário
  {
    stateCode: "LA",
    stateName: "Louisiana",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "~$35",
    note: "Vencimento no mês de aniversário",
  },
  // Maine - Anual, 1 junho
  {
    stateCode: "ME",
    stateName: "Maine",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 6,
    day: 1,
    fee: "~$85",
    note: "Vencimento fixo em 1º de junho",
  },
  // Maryland - Anual, 15 abril
  {
    stateCode: "MD",
    stateName: "Maryland",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 4,
    day: 15,
    fee: "~$300+",
    note: "Vencimento fixo em 15 de abril",
  },
  // Massachusetts - Anual, 2,5 meses após ano fiscal
  {
    stateCode: "MA",
    stateName: "Massachusetts",
    frequency: "Anual",
    dueType: "fiscal-month-4",
    fee: "~$500+",
    note: "Vencimento 2,5 meses após fim do ano fiscal",
  },
  // Michigan - Anual, 15 fevereiro (LLC)
  {
    stateCode: "MI",
    stateName: "Michigan",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 2,
    day: 15,
    fee: "~$25",
    note: "Vencimento fixo em 15 de fevereiro para LLCs",
  },
  // Minnesota - Anual, 31 dezembro
  {
    stateCode: "MN",
    stateName: "Minnesota",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 12,
    day: 31,
    fee: "$0",
    note: "Vencimento fixo em 31 de dezembro (sem taxa)",
  },
  // Mississippi - Anual, 15 abril
  {
    stateCode: "MS",
    stateName: "Mississippi",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 4,
    day: 15,
    fee: "~$50",
    note: "Vencimento fixo em 15 de abril",
  },
  // Montana - Anual, 15 abril
  {
    stateCode: "MT",
    stateName: "Montana",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 4,
    day: 15,
    fee: "~$20",
    note: "Vencimento fixo em 15 de abril",
  },
  // Nebraska - Bienal, 1 abril
  {
    stateCode: "NE",
    stateName: "Nebraska",
    frequency: "Bienal",
    dueType: "fixed-date",
    month: 4,
    day: 1,
    fee: "~$26",
    note: "Vencimento bienal em 1º de abril",
  },
  // Nevada - Anual, fim do mês de aniversário
  {
    stateCode: "NV",
    stateName: "Nevada",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "~$350",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // New Hampshire - Anual, 1 abril
  {
    stateCode: "NH",
    stateName: "New Hampshire",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 4,
    day: 1,
    fee: "~$100",
    note: "Vencimento fixo em 1º de abril",
  },
  // New Jersey - Anual, mês anterior ao aniversário
  {
    stateCode: "NJ",
    stateName: "New Jersey",
    frequency: "Anual",
    dueType: "month-before-anniversary",
    fee: "~$50",
    note: "Vencimento no mês anterior ao aniversário",
  },
  // New York - Bienal, mês de aniversário
  {
    stateCode: "NY",
    stateName: "New York",
    frequency: "Bienal",
    dueType: "anniversary-month-end",
    fee: "~$9",
    note: "Vencimento bienal no mês de aniversário",
  },
  // North Carolina - Anual, 15 abril
  {
    stateCode: "NC",
    stateName: "North Carolina",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 4,
    day: 15,
    fee: "~$200",
    note: "Vencimento fixo em 15 de abril",
  },
  // North Dakota - Anual, 15 novembro
  {
    stateCode: "ND",
    stateName: "North Dakota",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 11,
    day: 15,
    fee: "~$50",
    note: "Vencimento fixo em 15 de novembro",
  },
  // Oklahoma - Anual, mês de aniversário
  {
    stateCode: "OK",
    stateName: "Oklahoma",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "~$25",
    note: "Vencimento no mês de aniversário",
  },
  // Oregon - Anual, no aniversário
  {
    stateCode: "OR",
    stateName: "Oregon",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "~$100",
    note: "Vencimento no mês de aniversário",
  },
  // Pennsylvania - Anual, 30 setembro
  {
    stateCode: "PA",
    stateName: "Pennsylvania",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 9,
    day: 30,
    fee: "~$7",
    note: "Vencimento fixo em 30 de setembro",
  },
  // Rhode Island - Anual, 1 maio
  {
    stateCode: "RI",
    stateName: "Rhode Island",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 5,
    day: 1,
    fee: "~$50",
    note: "Vencimento fixo em 1º de maio",
  },
  // South Dakota - Anual, 1º dia do mês de aniversário
  {
    stateCode: "SD",
    stateName: "South Dakota",
    frequency: "Anual",
    dueType: "anniversary-month-start",
    fee: "~$50",
    note: "Vencimento no 1º dia do mês de aniversário",
  },
  // Tennessee - Anual, 1º dia do 4º mês fiscal
  {
    stateCode: "TN",
    stateName: "Tennessee",
    frequency: "Anual",
    dueType: "fiscal-month-4",
    day: 1,
    fee: "~$300 mínimo",
    note: "Vencimento no 1º dia do 4º mês fiscal",
  },
  // Texas - Anual, 15 maio
  {
    stateCode: "TX",
    stateName: "Texas",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 5,
    day: 15,
    fee: "$0 (para muitas LLCs)",
    note: "Vencimento fixo em 15 de maio (muitas LLCs isentas)",
  },
  // Utah - Anual, fim do mês de aniversário
  {
    stateCode: "UT",
    stateName: "Utah",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "~$20",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Vermont - Anual, 15 março
  {
    stateCode: "VT",
    stateName: "Vermont",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 3,
    day: 15,
    fee: "~$35",
    note: "Vencimento fixo em 15 de março",
  },
  // Virginia - Anual, fim do mês de aniversário
  {
    stateCode: "VA",
    stateName: "Virginia",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "~$50",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // Washington - Anual, fim do mês de aniversário
  {
    stateCode: "WA",
    stateName: "Washington",
    frequency: "Anual",
    dueType: "anniversary-month-end",
    fee: "~$73",
    note: "Vencimento no último dia do mês de aniversário",
  },
  // West Virginia - Anual, 1 julho
  {
    stateCode: "WV",
    stateName: "West Virginia",
    frequency: "Anual",
    dueType: "fixed-date",
    month: 7,
    day: 1,
    fee: "~$25",
    note: "Vencimento fixo em 1º de julho",
  },
  // Wisconsin - Anual, fim do trimestre de aniversário
  {
    stateCode: "WI",
    stateName: "Wisconsin",
    frequency: "Anual",
    dueType: "anniversary-quarter",
    fee: "~$25",
    note: "Vencimento no fim do trimestre de aniversário",
  },
  // Wyoming - Anual, 1º dia do mês de aniversário
  {
    stateCode: "WY",
    stateName: "Wyoming",
    frequency: "Anual",
    dueType: "anniversary-month-start",
    fee: "~$60",
    note: "Vencimento no 1º dia do mês de aniversário",
  },
  // Washington DC - Bienal, 1 abril
  {
    stateCode: "DC",
    stateName: "Washington DC",
    frequency: "Bienal",
    dueType: "fixed-date",
    month: 4,
    day: 1,
    fee: "~$300",
    note: "Vencimento bienal em 1º de abril",
  },

  // === ESTADOS SEM OBRIGAÇÃO DE ANNUAL REPORT PARA LLC ===

  {
    stateCode: "AZ",
    stateName: "Arizona",
    frequency: "Nenhum",
    dueType: "fixed-date",
    note: "Arizona não exige Annual Report para LLC (Corp apresenta)",
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
    note: "South Carolina não exige Annual Report para LLC",
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
  return rule?.frequency !== "Nenhum" && rule?.frequency !== undefined;
}

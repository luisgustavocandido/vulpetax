/**
 * Tipos para filtros de billing (charges e annual reports).
 */

export type BillingChargeStatusFilter = "all" | "pending" | "overdue" | "paid" | "canceled" | "pending,overdue";
export type BillingPeriodFilter = "all" | "Mensal" | "Anual";
export type SortOrder = "dueDateAsc" | "dueDateDesc" | "companyAsc" | "companyDesc";

export type BillingChargesFilters = {
  status?: BillingChargeStatusFilter;
  period?: BillingPeriodFilter;
  q?: string;
  clientId?: string;
  state?: string; // sigla do estado (ex: "WY")
  dueFrom?: string; // YYYY-MM-DD
  dueTo?: string; // YYYY-MM-DD
  sort?: SortOrder;
  page?: number;
  limit?: number;
  windowDays?: number;
};

export type AnnualReportStatusFilter = "all" | "pending" | "overdue" | "done" | "canceled" | "pending,overdue";
export type AnnualReportFrequencyFilter = "all" | "Anual" | "Bienal";

export type AnnualReportsFilters = {
  status?: AnnualReportStatusFilter;
  frequency?: AnnualReportFrequencyFilter;
  state?: string; // "all" | sigla do estado (ex: "WY")
  year?: string; // "all" | "2024" | "2025" ...
  q?: string;
  dueFrom?: string; // YYYY-MM-DD
  dueTo?: string; // YYYY-MM-DD
  sort?: SortOrder;
  page?: number;
  limit?: number;
  windowMonths?: number;
};

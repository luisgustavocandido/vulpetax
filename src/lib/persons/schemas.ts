import { z } from "zod";

export const personGroupIdParamSchema = z.object({
  personGroupId: z.string().uuid(),
});

export type PersonGroupIdParam = z.infer<typeof personGroupIdParamSchema>;

export type PersonDashboardCompanies = {
  total: number;
  items: Array<{
    clientId: string;
    companyName: string;
    customerCode?: string;
  }>;
};

export type PersonDashboardProcesses = {
  totals: { open: number; in_progress: number; done: number };
  items: Array<{
    processId: string;
    clientId: string;
    companyName: string | null;
    status: "open" | "in_progress" | "done";
    progressPct: number;
    currentStageTitle?: string | null;
    updatedAt: string;
  }>;
};

export type PersonDashboardAnnualReports = {
  totals: { pending: number; overdue: number; done: number; canceled: number };
  items: Array<{
    id: string;
    clientId: string;
    companyName: string | null;
    llcState: string;
    periodYear: number;
    dueDate: string;
    status: string;
    frequency: string;
  }>;
};

export type PersonDashboardAddressCharges = {
  totals: { pending: number; overdue: number; paid: number; canceled: number };
  items: Array<{
    id: string;
    clientId: string;
    companyName: string | null;
    dueDate: string | null;
    status: string;
    period?: string | null;
    addressProvider?: string | null;
    addressLine1?: string | null;
  }>;
};

export type PersonDashboardPayload = {
  personGroupId: string;
  companies: PersonDashboardCompanies;
  processes: PersonDashboardProcesses;
  annualReports: PersonDashboardAnnualReports;
  addressCharges: PersonDashboardAddressCharges;
};

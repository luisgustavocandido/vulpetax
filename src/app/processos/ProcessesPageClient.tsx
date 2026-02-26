"use client";

import { useRouter, useSearchParams } from "next/navigation";
import ProcessesFilters from "./ProcessesFilters";
import ProcessesTable from "./ProcessesTable";
import StageSummaryCards from "./StageSummaryCards";

type ProcessListItem = {
  id: string;
  clientId: string;
  companyName: string | null;
  kind: string;
  status: "open" | "in_progress" | "done";
  totalSteps: number;
  doneSteps: number;
  inProgressSteps: number;
  pendingSteps: number;
  progressPct: number;
  paymentDate: string | null;
  updatedAt: string;
  createdAt: string;
};

type Summary = {
  all: number;
  open: number;
  in_progress: number;
  done: number;
};

type StageSummaryItem = {
  order: number;
  title: string;
  count: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
};

type ProcessesResponse = {
  items: ProcessListItem[];
  pagination: Pagination;
  summary: Summary;
  stageSummary: StageSummaryItem[];
  doneCount: number;
};

type Props = {
  initialData: ProcessesResponse;
  initialSearchParams: Record<string, string>;
};

export default function ProcessesPageClient({ initialData, initialSearchParams }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const data = initialData;
  const { pagination, items, stageSummary = [], doneCount = 0 } = data;

  const handleChangeParams = (updates: Record<string, string | null | undefined>) => {
    const u = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") u.delete(key);
      else u.set(key, value);
    }
    u.delete("page");
    router.push(`/processos?${u.toString()}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Processos</h1>
        <p className="text-sm text-slate-500">
          Acompanhamento de etapas por cliente e serviço.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-slate-600">Etapa atual (processos LLC)</h2>
        <StageSummaryCards stageSummary={stageSummary} doneCount={doneCount} />
      </div>

      <ProcessesFilters onChange={handleChangeParams} initialValues={initialSearchParams} />

      <ProcessesTable items={items} pagination={pagination} />
    </div>
  );
}


"use client";

import { useRouter } from "next/navigation";

type Process = {
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
  createdAt: string;
  updatedAt: string;
};

type Step = {
  id: string;
  order: number;
  title: string;
  assignee: string | null;
  department: string | null;
  status: "pending" | "in_progress" | "done";
  doneAt: string | null;
  updatedAt: string;
};

type Props = {
  data: { process: Process; steps: Step[] };
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function statusBadge(status: Process["status"]) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Concluído
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Em andamento
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      Em aberto
    </span>
  );
}

function stepStatusBadge(status: Step["status"]) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Concluída
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Em andamento
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      Pendente
    </span>
  );
}

export default function ProcessDetailClient({ data }: Props) {
  const router = useRouter();
  const { process, steps } = data;

  const handleUpdateStep = async (stepId: string, status: Step["status"]) => {
    try {
      const res = await fetch(`/api/processes/${process.id}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Erro ao atualizar etapa.");
        return;
      }
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar etapa.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Processo
          </h1>
          <p className="text-sm text-slate-600">
            {process.companyName ?? "—"} · {process.kind}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {statusBadge(process.status)}
          </div>
          <div className="flex flex-col items-end text-xs text-slate-500">
            <span>Atualizado em {formatDateTime(process.updatedAt)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">Progresso</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {process.progressPct}%
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${process.progressPct}%` }}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {process.doneSteps} de {process.totalSteps} etapas concluídas.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">Resumo de etapas</p>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <dt>Pendentes</dt>
              <dd>{process.pendingSteps}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Em andamento</dt>
              <dd>{process.inProgressSteps}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Concluídas</dt>
              <dd>{process.doneSteps}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">Metadados</p>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <dt>Criado em</dt>
              <dd>{formatDateTime(process.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Atualizado em</dt>
              <dd>{formatDateTime(process.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Checklist de etapas</h2>
        <div className="w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Ordem
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Etapa
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Responsável
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Setor
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Concluída em
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {steps.map((step) => (
                <tr key={step.id} className="align-top">
                  <td className="px-3 py-2 text-sm text-slate-700">{step.order}</td>
                  <td className="px-3 py-2 text-sm text-slate-800">{step.title}</td>
                  <td className="px-3 py-2 text-sm text-slate-700">
                    {step.assignee ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700">
                    {step.department ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {stepStatusBadge(step.status)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-600">
                    {formatDateTime(step.doneAt)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <div className="flex justify-end gap-2">
                      {step.status !== "done" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStep(step.id, "done")}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Concluir
                        </button>
                      )}
                      {step.status === "done" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStep(step.id, "pending")}
                          className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-200"
                        >
                          Reabrir
                        </button>
                      )}
                      {step.status !== "in_progress" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStep(step.id, "in_progress")}
                          className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                        >
                          Em andamento
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


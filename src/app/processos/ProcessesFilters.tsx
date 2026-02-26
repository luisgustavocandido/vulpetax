"use client";

import { useSearchParams, useRouter } from "next/navigation";

type Props = {
  onChange: (updates: Record<string, string | null | undefined>) => void;
  initialValues: Record<string, string>;
};

export default function ProcessesFilters({ onChange, initialValues }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get("q") ?? initialValues.q ?? "";
  const status = searchParams.get("status") ?? initialValues.status ?? "";
  const assignee = searchParams.get("assignee") ?? initialValues.assignee ?? "";
  const department = searchParams.get("department") ?? initialValues.department ?? "";
  const kind = searchParams.get("kind") ?? initialValues.kind ?? "";
  const paymentDateFrom = searchParams.get("paymentDateFrom") ?? initialValues.paymentDateFrom ?? "";
  const paymentDateTo = searchParams.get("paymentDateTo") ?? initialValues.paymentDateTo ?? "";
  const sort = searchParams.get("sort") ?? initialValues.sort ?? "updatedAt_desc";

  const handleSortChange = (value: string) => {
    const u = new URLSearchParams(searchParams.toString());
    if (value) u.set("sort", value);
    else u.delete("sort");
    u.delete("page");
    router.push(`/processos?${u.toString()}`);
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
      <div className="md:col-span-3">
        <label className="mb-1 block text-xs font-medium text-slate-500">Busca (empresa)</label>
        <input
          type="search"
          defaultValue={q}
          placeholder="Nome da empresa"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const value = (e.target as HTMLInputElement).value;
              onChange({ q: value || null });
            }
          }}
          onBlur={(e) => onChange({ q: e.target.value || null })}
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Status do processo</label>
        <select
          value={status}
          onChange={(e) => onChange({ status: e.target.value || null })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="open">Em aberto</option>
          <option value="in_progress">Em andamento</option>
          <option value="done">Concluídos</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Responsável</label>
        <input
          type="text"
          defaultValue={assignee}
          placeholder="Nome do responsável"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          onBlur={(e) => onChange({ assignee: e.target.value || null })}
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Setor</label>
        <input
          type="text"
          defaultValue={department}
          placeholder="Comercial, Administrativo..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          onBlur={(e) => onChange({ department: e.target.value || null })}
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de processo</label>
        <input
          type="text"
          defaultValue={kind}
          placeholder="LLC_PROCESS..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          onBlur={(e) => onChange({ kind: e.target.value || null })}
        />
      </div>
      <div className="md:col-span-1">
        <label className="mb-1 block text-xs font-medium text-slate-500">Ordenar</label>
        <select
          value={sort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="updatedAt_desc">Atualizado ↓</option>
          <option value="progress_asc">Progresso ↑</option>
          <option value="progress_desc">Progresso ↓</option>
          <option value="company_asc">Empresa A-Z</option>
          <option value="paymentDate_asc">Pagamento ↑</option>
          <option value="paymentDate_desc">Pagamento ↓</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Pagamento de</label>
        <input
          type="date"
          value={paymentDateFrom}
          onChange={(e) => onChange({ paymentDateFrom: e.target.value || null })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Pagamento até</label>
        <input
          type="date"
          value={paymentDateTo}
          onChange={(e) => onChange({ paymentDateTo: e.target.value || null })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}


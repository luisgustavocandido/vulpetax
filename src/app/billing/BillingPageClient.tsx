"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnnualReportTab } from "./AnnualReportTab";
import { US_STATES } from "@/constants/usStates";

const PAY_METHODS = [
  "Stripe",
  "Wise",
  "Binance",
  "Zelle",
  "Pix",
  "ACH",
  "Paypal",
  "USDT",
  "Revolut",
  "Outro",
];

type ChargeRow = {
  id: string;
  clientId: string;
  lineItemId: string;
  periodStart: string | null;
  periodEnd: string | null;
  amountCents: number;
  currency: string | null;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  paidMethod: string | null;
  notes: string | null;
  companyName: string | null;
  paymentMethod: string | null;
  billingPeriod: string | null;
  addressProvider: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  steNumber: string | null;
  llcState: string | null;
};

type Meta = {
  page: number;
  limit: number;
  total: number;
  totals: {
    pendingCents: number;
    overdueCents: number;
    paidCents: number;
  };
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const part = String(s).slice(0, 10);
  const [y, m, d] = part.split("-");
  return `${d}/${m}/${y}`;
}

function statusLabel(s: string, dueDate: string | null): string {
  if (s === "paid") return "Pago";
  if (s === "canceled") return "Cancelado";
  if (s === "overdue") return "Atrasada";
  if (s === "pending" && dueDate && dueDate < new Date().toISOString().slice(0, 10)) return "Atrasada";
  if (s === "pending") return "Pendente";
  return s;
}

function statusClass(s: string, dueDate: string | null): string {
  if (s === "paid") return "bg-green-100 text-green-800";
  if (s === "canceled") return "bg-slate-100 text-slate-600";
  if (s === "overdue" || (s === "pending" && dueDate && dueDate < new Date().toISOString().slice(0, 10))) return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function renderAddress(row: ChargeRow): string {
  const parts: string[] = [];
  if (row.addressProvider) parts.push(row.addressProvider);
  if (row.addressLine1) parts.push(row.addressLine1);
  if (row.addressLine2) parts.push(row.addressLine2);
  if (row.addressProvider === "New Mexico" && row.steNumber) parts.push(`STE ${row.steNumber}`);
  return parts.length ? parts.join(", ") : "—";
}

export function BillingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ data: ChargeRow[]; meta: Meta } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalCharge, setModalCharge] = useState<ChargeRow | null>(null);
  const [editCharge, setEditCharge] = useState<ChargeRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payPaidAt, setPayPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [payPaidMethod, setPayPaidMethod] = useState("Stripe");
  const [payPaidMethodOther, setPayPaidMethodOther] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteConfirmCharge, setDeleteConfirmCharge] = useState<ChargeRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const qRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTab = searchParams.get("tab") ?? "addresses";

  const status = searchParams.get("status") ?? "pending,overdue";
  const period = searchParams.get("period") ?? "all";
  const state = searchParams.get("state") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const qParam = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20));

  const fetchCharges = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("period", period);
    if (state) params.set("state", state);
    if (sort) params.set("sort", sort);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (qRef.current) params.set("q", qRef.current);
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("windowDays", "60");
    try {
      const res = await fetch(`/api/billing/charges?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Erro ao carregar");
      }
      const json = await res.json();
      setData({
        data: json.data ?? [],
        meta: json.meta ?? {
          page: 1,
          limit: 20,
          total: 0,
          totals: { pendingCents: 0, overdueCents: 0, paidCents: 0 },
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar cobranças");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status, period, state, sort, from, to, page, limit]);

  useEffect(() => {
    qRef.current = qParam;
    fetchCharges();
  }, [fetchCharges, qParam]);

  const debouncedSetQuery = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const u = new URLSearchParams(searchParams.toString());
      if (value.trim()) u.set("q", value.trim());
      else u.delete("q");
      u.delete("page");
      router.push(`/billing?${u.toString()}`);
      debounceRef.current = null;
    }, 300);
  }, [router, searchParams]);

  async function handleMarkPaid() {
    if (!modalCharge) return;
    setPaySubmitting(true);
    try {
      const method = payPaidMethod === "Outro" ? payPaidMethodOther : payPaidMethod;
      const res = await fetch(`/api/billing/charges/${modalCharge.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidAt: payPaidAt,
          paidMethod: method || "Manual",
          notes: payNotes || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Falha ao marcar como pago");
      setToast({ type: "success", message: "Cobrança marcada como paga." });
      setModalCharge(null);
      setPayPaidAt(new Date().toISOString().slice(0, 10));
      setPayNotes("");
      setPayPaidMethod("Stripe");
      setPayPaidMethodOther("");
      fetchCharges();
      router.refresh();
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Erro" });
    } finally {
      setPaySubmitting(false);
    }
  }

  async function handleCancel(row: ChargeRow) {
    if (!confirm("Cancelar esta cobrança?")) return;
    try {
      const res = await fetch(`/api/billing/charges/${row.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Falha ao cancelar");
      setToast({ type: "success", message: "Cobrança cancelada." });
      fetchCharges();
      router.refresh();
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Erro" });
    }
  }

  async function handleReopen(row: ChargeRow) {
    if (!confirm("Reabrir esta cobrança?")) return;
    try {
      const res = await fetch(`/api/billing/charges/${row.id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Falha ao reabrir");
      setToast({ type: "success", message: "Cobrança reaberta." });
      fetchCharges();
      router.refresh();
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Erro" });
    }
  }

  function openDeleteConfirm(row: ChargeRow) {
    setDeleteConfirmCharge(row);
  }

  async function confirmDeleteCharge() {
    if (!deleteConfirmCharge) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/billing/charges/${deleteConfirmCharge.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Falha ao excluir");
      setToast({ type: "success", message: "Cobrança excluída." });
      setDeleteConfirmCharge(null);
      fetchCharges();
      router.refresh();
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Erro" });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function openEditModal(row: ChargeRow) {
    setEditCharge(row);
    setEditAmount((row.amountCents / 100).toFixed(2));
    setEditDueDate(row.dueDate?.slice(0, 10) ?? "");
    setEditNotes(row.notes ?? "");
  }

  async function handleSaveEdit() {
    if (!editCharge) return;
    const amountCents = Math.round(parseFloat(editAmount) * 100);
    if (Number.isNaN(amountCents) || amountCents < 0) {
      setToast({ type: "error", message: "Valor inválido." });
      return;
    }
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/billing/charges/${editCharge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          dueDate: editDueDate || undefined,
          notes: editNotes.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Falha ao salvar");
      setToast({ type: "success", message: "Cobrança atualizada." });
      setEditCharge(null);
      fetchCharges();
      router.refresh();
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Erro" });
    } finally {
      setEditSubmitting(false);
    }
  }

  function handleRefresh() {
    fetchCharges();
    setToast({ type: "success", message: "Lista atualizada." });
  }

  const meta = data?.meta;
  const charges = data?.data ?? [];
  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Cobranças</h1>
        <p className="text-sm text-slate-500">
          Gestão de obrigações e cobranças
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
            onClick={() => {
              const u = new URLSearchParams(searchParams.toString());
              u.set("tab", "addresses");
              router.push(`/billing?${u.toString()}`);
            }}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === "addresses"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Endereços
          </button>
          <button
            type="button"
            onClick={() => {
              const u = new URLSearchParams(searchParams.toString());
              u.set("tab", "annual-report");
              router.push(`/billing?${u.toString()}`);
            }}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === "annual-report"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Annual Report
          </button>
        </nav>
      </div>

      {activeTab === "annual-report" ? (
        <AnnualReportTab />
      ) : (
        <>

      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            toast.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => { setError(null); fetchCharges(); }}
            className="ml-2 font-medium underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {meta && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pendentes</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCents(meta.totals.pendingCents)}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 shadow-sm">
            <p className="text-sm font-medium text-red-700">Atrasadas</p>
            <p className="mt-1 text-2xl font-semibold text-red-900">{formatCents(meta.totals.overdueCents)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pagas (mês atual)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCents(meta.totals.paidCents)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              u.set("status", e.target.value);
              u.delete("page");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Todos</option>
            <option value="pending,overdue">Pendentes + Atrasadas</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Atrasadas</option>
            <option value="paid">Pagas</option>
            <option value="canceled">Canceladas</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Periodicidade</label>
          <select
            value={period}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              u.set("period", e.target.value);
              u.delete("page");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Todas</option>
            <option value="Mensal">Mensal</option>
            <option value="Anual">Anual</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
          <select
            value={state}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("state", e.target.value);
              else u.delete("state");
              u.delete("page");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos os estados</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("from", e.target.value);
              else u.delete("from");
              u.delete("page");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("to", e.target.value);
              else u.delete("to");
              u.delete("page");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordenar</label>
          <select
            value={sort}
            onChange={(e) => {
              const u = new URLSearchParams(searchParams.toString());
              if (e.target.value) u.set("sort", e.target.value);
              else u.delete("sort");
              u.delete("page");
              router.push(`/billing?${u.toString()}`);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Padrão</option>
            <option value="dueDateAsc">Vencimento ↑</option>
            <option value="dueDateDesc">Vencimento ↓</option>
            <option value="companyAsc">Empresa A-Z</option>
            <option value="companyDesc">Empresa Z-A</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">Busca</label>
          <input
            type="search"
            defaultValue={qParam}
            placeholder="Empresa ou endereço"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === "Enter" && debouncedSetQuery((e.target as HTMLInputElement).value)}
            onChange={(e) => debouncedSetQuery(e.target.value)}
          />
        </div>
        <div className="md:col-span-1">
          <button
            type="button"
            onClick={handleRefresh}
            className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700"
          >
            Atualizar
          </button>
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            try {
              await fetch(`/api/billing/charges?status=all&windowDays=60&limit=1`);
              await fetchCharges();
              setToast({ type: "success", message: "Cobranças geradas/atualizadas (janela 60 dias)." });
            } finally {
              setLoading(false);
            }
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Gerar cobranças (60 dias)
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded bg-slate-200" />
          ))}
        </div>
      ) : charges.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-8 text-center text-slate-600">
          Nenhuma cobrança encontrada. Ajuste os filtros ou abra a página com &quot;Gerar cobranças&quot; para criar cobranças dos itens Endereço (Mensal/Anual).
        </div>
      ) : (
        <>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Endereço</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Periodicidade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Período</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Expira em</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Ações</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {charges.map((row) => {
                  const isOverdue = (row.status === "pending" || row.status === "overdue") && row.dueDate && row.dueDate < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={row.id} className={isOverdue ? "bg-red-50/50" : ""}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Link href={`/clients/${row.clientId}`} className="text-blue-600 hover:underline">
                          {row.companyName ?? "—"}
                        </Link>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-sm text-slate-700" title={renderAddress(row)}>
                        {renderAddress(row)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{row.billingPeriod ?? "—"}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span className={isOverdue ? "font-medium text-red-700" : "text-slate-600"}>
                          {formatDate(row.dueDate)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-900">
                        {formatCents(row.amountCents)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status, row.dueDate)}`}>
                          {row.status === "paid" && row.paidAt ? `Pago em ${formatDate(String(row.paidAt).slice(0, 10))}` : statusLabel(row.status, row.dueDate)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          {(row.status === "pending" || row.status === "overdue") && (
                            <button
                              type="button"
                              onClick={() => {
                                setModalCharge(row);
                                setPayPaidAt(row.periodStart?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
                                setPayNotes("");
                                setPayPaidMethod("Stripe");
                                setPayPaidMethodOther("");
                              }}
                              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                            >
                              Marcar como pago
                            </button>
                          )}
                          {(row.status === "pending" || row.status === "overdue") && (
                            <button
                              type="button"
                              onClick={() => handleCancel(row)}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                          )}
                          {row.status === "canceled" && (
                            <button
                              type="button"
                              onClick={() => handleReopen(row)}
                              className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                            >
                              Reabrir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openDeleteConfirm(row)}
                            className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Página {meta!.page} de {totalPages} ({meta!.total} itens)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    const u = new URLSearchParams(searchParams.toString());
                    u.set("page", String(page - 1));
                    router.push(`/billing?${u.toString()}`);
                  }}
                  className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const u = new URLSearchParams(searchParams.toString());
                    u.set("page", String(page + 1));
                    router.push(`/billing?${u.toString()}`);
                  }}
                  className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {modalCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Marcar como pago</h3>
            <p className="mt-1 text-sm text-slate-600">
              {modalCharge.companyName} — {formatCents(modalCharge.amountCents)}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Data de pagamento</label>
                <input
                  type="date"
                  value={payPaidAt}
                  onChange={(e) => setPayPaidAt(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Método de pagamento</label>
                <select
                  value={payPaidMethod}
                  onChange={(e) => setPayPaidMethod(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {PAY_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {payPaidMethod === "Outro" && (
                  <input
                    type="text"
                    value={payPaidMethodOther}
                    onChange={(e) => setPayPaidMethodOther(e.target.value)}
                    placeholder="Especificar"
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Observação</label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Referência, nota..."
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalCharge(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleMarkPaid}
                disabled={paySubmitting}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {paySubmitting ? "Salvando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Editar cobrança</h3>
            <p className="mt-1 text-sm text-slate-600">{editCharge.companyName}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Valor (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Expira em</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Observações</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Nota interna..."
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditCharge(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editSubmitting}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {editSubmitting ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="delete-dialog-title" className="text-lg font-semibold text-slate-900">
                  Excluir cobrança
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {deleteConfirmCharge.companyName} — {formatCents(deleteConfirmCharge.amountCents)}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  Excluir esta cobrança permanentemente? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmCharge(null)}
                disabled={deleteSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteCharge}
                disabled={deleteSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteSubmitting ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

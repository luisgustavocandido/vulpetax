"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientForm } from "@/components/ClientForm";
import { ClientDeleteButton } from "./ClientDeleteButton";
import { PdfPosVendaButton } from "@/components/PdfPosVendaButton";
import type { ClientFormData } from "@/components/ClientForm";
import type { InitialClientForEdit } from "@/lib/serialize/clientToInitialClient";

type ClientEditPageProps = {
  clientId: string;
  initialClient: InitialClientForEdit;
  /** Base path para links (ex: /clients ou /empresas). Default: /clients */
  basePath?: string;
};

type ProcessableLineItem = {
  id: string;
  kind: string;
  label: string;
  saleDate: string | null;
  hasProcess: boolean;
  existingProcessId: string | null;
};

type PersonGroupCompany = { id: string; companyName: string; customerCode: string };

/**
 * Wrapper client para a tela de edição de cliente.
 * Concentra Link, botões e ClientForm em uma única árvore client,
 * evitando "Invalid hook call" / useContext null ao navegar após salvar.
 */
export function ClientEditPage({ clientId, initialClient, basePath = "/clients" }: ClientEditPageProps) {
  const router = useRouter();
  const initialData: Partial<ClientFormData> & {
    lineItems?: ClientFormData["lineItems"];
    partners?: ClientFormData["partners"];
  } = {
    companyName: initialClient.companyName,
    customerCode: initialClient.customerCode ?? "",
    commercial: initialClient.commercial ?? "",
    sdr: initialClient.sdr ?? "",
    businessType: initialClient.businessType ?? "",
    anonymous: initialClient.anonymous ?? false,
    holding: initialClient.holding ?? false,
    affiliate: initialClient.affiliate ?? false,
    affiliateType: initialClient.affiliateType ?? null,
    affiliateOtherText: initialClient.affiliateOtherText ?? null,
    express: initialClient.express ?? false,
    notes: initialClient.notes ?? "",
    email: initialClient.email ?? "",
    personalAddressLine1: initialClient.personalAddressLine1 ?? "",
    personalAddressLine2: initialClient.personalAddressLine2 ?? "",
    personalCity: initialClient.personalCity ?? "",
    personalState: initialClient.personalState ?? "",
    personalPostalCode: initialClient.personalPostalCode ?? "",
    personalCountry: initialClient.personalCountry ?? "",
    einNumber: initialClient.einNumber ?? "",
    businessId: initialClient.businessId ?? "",
    companyAddressLine1: initialClient.companyAddressLine1 ?? "",
    companyAddressLine2: initialClient.companyAddressLine2 ?? "",
    formationDate: initialClient.formationDate ?? "",
    annualReportDate: initialClient.annualReportDate ?? "",
    lineItems: initialClient.lineItems ?? [],
    partners: initialClient.partners ?? [],
  };

  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [loadingProcessables, setLoadingProcessables] = useState(false);
  const [processableLineItems, setProcessableLineItems] = useState<ProcessableLineItem[]>([]);
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>("");
  const [creatingProcess, setCreatingProcess] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [conflictProcessId, setConflictProcessId] = useState<string | null>(null);

  const [llcProcessId, setLlcProcessId] = useState<string | null>(null);
  const [loadingLlcProcess, setLoadingLlcProcess] = useState(true);

  const [personGroupCompanies, setPersonGroupCompanies] = useState<PersonGroupCompany[]>([]);
  const [personGroupTotal, setPersonGroupTotal] = useState(0);
  const [loadingPersonGroup, setLoadingPersonGroup] = useState(false);

  useEffect(() => {
    const pgId = initialClient.personGroupId;
    if (!pgId) {
      setPersonGroupCompanies([]);
      setPersonGroupTotal(0);
      return;
    }
    let cancelled = false;
    setLoadingPersonGroup(true);
    const fetchByPerson = async () => {
      try {
        const res = await fetch(`/api/clients/by-person/${encodeURIComponent(pgId)}?limit=5`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data?: PersonGroupCompany[]; total?: number };
        if (!cancelled) {
          setPersonGroupCompanies(json.data ?? []);
          setPersonGroupTotal(json.total ?? 0);
        }
      } catch {
        if (!cancelled) {
          setPersonGroupCompanies([]);
          setPersonGroupTotal(0);
        }
      } finally {
        if (!cancelled) setLoadingPersonGroup(false);
      }
    };
    void fetchByPerson();
    return () => {
      cancelled = true;
    };
  }, [initialClient.personGroupId]);

  useEffect(() => {
    let cancelled = false;
    const fetchLlcProcess = async () => {
      setLoadingLlcProcess(true);
      try {
        const res = await fetch(`/api/processes/by-client/${clientId}`);
        if (!cancelled && res.ok) {
          const json = (await res.json()) as { id?: string };
          setLlcProcessId(json.id ?? null);
        } else if (!cancelled) {
          setLlcProcessId(null);
        }
      } catch {
        if (!cancelled) setLlcProcessId(null);
      } finally {
        if (!cancelled) setLoadingLlcProcess(false);
      }
    };
    void fetchLlcProcess();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!processModalOpen || processableLineItems.length > 0) return;
    let cancelled = false;
    const fetchProcessables = async () => {
      setLoadingProcessables(true);
      setProcessError(null);
      try {
        const res = await fetch(`/api/clients/${clientId}/processable-line-items`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          if (!cancelled) {
            setProcessError(j.error ?? "Erro ao carregar serviços do cliente.");
          }
          return;
        }
        const json = (await res.json()) as { lineItems?: ProcessableLineItem[] };
        if (!cancelled) {
          const list = json.lineItems ?? [];
          setProcessableLineItems(list);
          if (list.length > 0) {
            setSelectedLineItemId(list[0]!.id);
          }
        }
      } catch {
        if (!cancelled) {
          setProcessError("Erro ao carregar serviços do cliente.");
        }
      } finally {
        if (!cancelled) setLoadingProcessables(false);
      }
    };
    void fetchProcessables();
    return () => {
      cancelled = true;
    };
  }, [clientId, processModalOpen, processableLineItems.length]);

  const openProcessModal = () => {
    setProcessError(null);
    setConflictProcessId(null);
    setProcessModalOpen(true);
  };

  const closeProcessModal = () => {
    setProcessModalOpen(false);
    setProcessError(null);
    setConflictProcessId(null);
  };

  const handleCreateProcess = async () => {
    setProcessError(null);
    setConflictProcessId(null);
    const item = processableLineItems.find((li) => li.id === selectedLineItemId);
    if (!item) {
      setProcessError("Selecione um serviço.");
      return;
    }
    if (item.kind !== "LLC") {
      setProcessError("Por enquanto, só é possível criar processos para serviços do tipo LLC.");
      return;
    }
    setCreatingProcess(true);
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          lineItemId: item.id,
          kind: "LLC_PROCESS",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && json.existingProcessId) {
          setConflictProcessId(json.existingProcessId as string);
          setProcessError(json.error ?? "Já existe um processo para este serviço.");
          return;
        }
        setProcessError(json.error ?? "Erro ao criar processo.");
        return;
      }
      const id = (json as { id?: string }).id;
      if (id) {
        closeProcessModal();
        router.push(`/processos/${id}`);
      } else {
        setProcessError("Resposta inesperada da API de processos.");
      }
    } catch {
      setProcessError("Erro ao criar processo.");
    } finally {
      setCreatingProcess(false);
    }
  };

  const selectedItem = processableLineItems.find((li) => li.id === selectedLineItemId) ?? null;
  const disableCreate =
    !selectedItem || selectedItem.kind !== "LLC" || creatingProcess || loadingProcessables;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Editar empresa</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={basePath}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Voltar
          </Link>
          {loadingLlcProcess ? (
            <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 opacity-80">
              Carregando…
            </span>
          ) : llcProcessId ? (
            <Link
              href={`/processos/${llcProcessId}`}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Abrir processo LLC
            </Link>
          ) : (
            <button
              type="button"
              onClick={openProcessModal}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Criar processo
            </button>
          )}
          <PdfPosVendaButton clientId={clientId} />
          <ClientDeleteButton
            clientId={clientId}
            clientName={initialClient.companyName}
            redirectPath={basePath}
          />
        </div>
      </div>

      {initialClient.personGroupId && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
          {loadingPersonGroup ? (
            <p className="text-sm text-gray-500">Carregando empresas da mesma pessoa…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                Essa pessoa possui {personGroupTotal} {personGroupTotal === 1 ? "empresa" : "empresas"} conosco.
              </p>
              {personGroupCompanies.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-sm text-gray-600">
                  {personGroupCompanies.map((c) => (
                    <li key={c.id}>
                      {c.id === clientId ? (
                        <span>{c.companyName} (esta)</span>
                      ) : (
                        <Link href={`${basePath}/${c.id}`} className="text-indigo-600 hover:underline">
                          {c.companyName}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-4">
                <Link
                  href={`${basePath}/person/${initialClient.personGroupId}`}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Ver todas as empresas
                </Link>
                <Link
                  href={`/clientes/pagadores/${initialClient.personGroupId}`}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Abrir painel da pessoa
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <ClientForm
          key={clientId}
          initialData={initialData}
          clientId={clientId}
          successRedirectPath={basePath}
        />
      </div>

      {processModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Criar processo</h2>
            <p className="mt-1 text-sm text-slate-600">
              Selecione o serviço (line item) e crie um processo de acompanhamento para LLC.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Serviço (line item)
                </label>
                <select
                  value={selectedLineItemId}
                  onChange={(e) => setSelectedLineItemId(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  disabled={loadingProcessables}
                >
                  {loadingProcessables && (
                    <option value="">Carregando serviços…</option>
                  )}
                  {!loadingProcessables && processableLineItems.length === 0 && (
                    <option value="">Nenhum serviço encontrado para este cliente</option>
                  )}
                  {!loadingProcessables &&
                    processableLineItems.length > 0 && (
                      <>
                        {processableLineItems.map((li) => (
                          <option key={li.id} value={li.id}>
                            {li.label}
                            {li.hasProcess ? " (já possui processo)" : ""}
                          </option>
                        ))}
                      </>
                    )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Tipo de processo
                </label>
                <select
                  value="LLC_PROCESS"
                  disabled
                  className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
                >
                  <option value="LLC_PROCESS">LLC_PROCESS</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Por enquanto, apenas processos para LLC estão disponíveis.
                </p>
              </div>

              {selectedItem && selectedItem.kind !== "LLC" && (
                <p className="text-xs text-amber-700">
                  Este serviço não é do tipo LLC. Selecione um line item LLC para criar o processo.
                </p>
              )}

              {processError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {processError}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              {conflictProcessId && (
                <button
                  type="button"
                  onClick={() => {
                    closeProcessModal();
                    router.push(`/processos/${conflictProcessId}`);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Abrir processo existente
                </button>
              )}
              <button
                type="button"
                onClick={closeProcessModal}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateProcess}
                disabled={disableCreate}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingProcess ? "Criando…" : "Criar processo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

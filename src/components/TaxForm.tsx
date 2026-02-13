"use client";

import { useState } from "react";
import { UNIQUE_COUNTRY_CODES } from "@/lib/countryCodes";
type TaxProfile = {
  llcName?: string | null;
  formationDate?: string | null;
  activitiesDescription?: string | null;
  einNumber?: string | null;
  llcUsAddressLine1?: string | null;
  llcUsAddressLine2?: string | null;
  llcUsCity?: string | null;
  llcUsState?: string | null;
  llcUsZip?: string | null;
  ownerEmail?: string | null;
  ownerFullLegalName?: string | null;
  ownerResidenceCountry?: string | null;
  ownerCitizenshipCountry?: string | null;
  ownerHomeAddressDifferent?: boolean | null;
  ownerResidentialAddressLine1?: string | null;
  ownerResidentialAddressLine2?: string | null;
  ownerResidentialCity?: string | null;
  ownerResidentialState?: string | null;
  ownerResidentialPostalCode?: string | null;
  ownerResidentialCountry?: string | null;
  ownerUsTaxId?: string | null;
  ownerForeignTaxId?: string | null;
  llcFormationCostUsdCents?: number | null;
  hasAdditionalOwners?: boolean | null;
  totalAssetsUsdCents?: number | null;
  hasUsBankAccounts?: boolean | null;
  totalWithdrawalsUsdCents?: number | null;
  totalTransferredToLlcUsdCents?: number | null;
  totalWithdrawnFromLlcUsdCents?: number | null;
  personalExpensesPaidByCompanyUsdCents?: number | null;
  businessExpensesPaidPersonallyUsdCents?: number | null;
  passportCopiesProvided?: boolean | null;
  articlesOfOrganizationProvided?: boolean | null;
  einLetterProvided?: boolean | null;
  additionalDocumentsProvided?: boolean | null;
  additionalDocumentsNotes?: string | null;
  declarationAccepted?: boolean | null;
};

type TaxOwner = {
  ownerIndex: number;
  email?: string | null;
  fullLegalName?: string | null;
  residenceCountry?: string | null;
  citizenshipCountry?: string | null;
  homeAddressDifferent?: boolean | null;
  usTaxId?: string | null;
  foreignTaxId?: string | null;
};

type FormOwner = {
  ownerIndex: number;
  email: string;
  fullLegalName: string;
  residenceCountry: string;
  citizenshipCountry: string;
  homeAddressDifferent: boolean;
  usTaxId: string;
  foreignTaxId: string;
};

function toFormOwner(o: TaxOwner): FormOwner {
  return {
    ownerIndex: o.ownerIndex,
    email: o.email ?? "",
    fullLegalName: o.fullLegalName ?? "",
    residenceCountry: o.residenceCountry ?? "",
    citizenshipCountry: o.citizenshipCountry ?? "",
    homeAddressDifferent: o.homeAddressDifferent ?? false,
    usTaxId: o.usTaxId ?? "",
    foreignTaxId: o.foreignTaxId ?? "",
  };
}

function hasOwnerData(o: FormOwner): boolean {
  return !!(
    o.email?.trim() ||
    o.fullLegalName?.trim() ||
    o.residenceCountry?.trim() ||
    o.citizenshipCountry?.trim() ||
    o.usTaxId?.trim() ||
    o.foreignTaxId?.trim()
  );
}

function validateOwner(o: FormOwner): string | null {
  if (!hasOwnerData(o)) return null;
  if (!o.fullLegalName?.trim()) return "Nome legal completo é obrigatório para sócio adicional";
  if (!o.residenceCountry?.trim()) return "País de residência é obrigatório para sócio adicional";
  if (!o.citizenshipCountry?.trim()) return "País de cidadania é obrigatório para sócio adicional";
  return null;
}

type Props = {
  clientId: string;
  taxFormId?: string;
  companyName: string;
  initialProfile: TaxProfile | null;
  initialOwners: TaxOwner[];
  status: string;
  missingFields: string[];
  alerts: string[];
};

function toUsdInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function TaxForm({
  clientId,
  taxFormId,
  companyName,
  initialProfile,
  initialOwners,
  status,
  missingFields,
  alerts,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const p = initialProfile ?? {};
  const [form, setForm] = useState({
    llcName: p.llcName ?? companyName ?? "",
    formationDate: p.formationDate ?? "",
    activitiesDescription: p.activitiesDescription ?? "",
    einNumber: p.einNumber ?? "",
    llcUsAddressLine1: p.llcUsAddressLine1 ?? "",
    llcUsAddressLine2: p.llcUsAddressLine2 ?? "",
    llcUsCity: p.llcUsCity ?? "",
    llcUsState: p.llcUsState ?? "",
    llcUsZip: p.llcUsZip ?? "",
    ownerEmail: p.ownerEmail ?? "",
    ownerFullLegalName: p.ownerFullLegalName ?? "",
    ownerResidenceCountry: p.ownerResidenceCountry ?? "",
    ownerCitizenshipCountry: p.ownerCitizenshipCountry ?? "",
    ownerHomeAddressDifferent: p.ownerHomeAddressDifferent ?? false,
    ownerResidentialAddressLine1: p.ownerResidentialAddressLine1 ?? "",
    ownerResidentialAddressLine2: p.ownerResidentialAddressLine2 ?? "",
    ownerResidentialCity: p.ownerResidentialCity ?? "",
    ownerResidentialState: p.ownerResidentialState ?? "",
    ownerResidentialPostalCode: p.ownerResidentialPostalCode ?? "",
    ownerResidentialCountry: p.ownerResidentialCountry ?? "",
    ownerUsTaxId: p.ownerUsTaxId ?? "",
    ownerForeignTaxId: p.ownerForeignTaxId ?? "",
    llcFormationCostUsdCents: toUsdInput(p.llcFormationCostUsdCents ?? undefined),
    hasAdditionalOwners: p.hasAdditionalOwners ?? false,
    totalAssetsUsdCents: toUsdInput(p.totalAssetsUsdCents ?? undefined),
    hasUsBankAccounts: p.hasUsBankAccounts ?? false,
    totalWithdrawalsUsdCents: toUsdInput(p.totalWithdrawalsUsdCents ?? undefined),
    totalTransferredToLlcUsdCents: toUsdInput(p.totalTransferredToLlcUsdCents ?? undefined),
    totalWithdrawnFromLlcUsdCents: toUsdInput(p.totalWithdrawnFromLlcUsdCents ?? undefined),
    personalExpensesPaidByCompanyUsdCents: toUsdInput(p.personalExpensesPaidByCompanyUsdCents ?? undefined),
    businessExpensesPaidPersonallyUsdCents: toUsdInput(p.businessExpensesPaidPersonallyUsdCents ?? undefined),
    passportCopiesProvided: p.passportCopiesProvided ?? false,
    articlesOfOrganizationProvided: p.articlesOfOrganizationProvided ?? false,
    einLetterProvided: p.einLetterProvided ?? false,
    additionalDocumentsProvided: p.additionalDocumentsProvided ?? false,
    additionalDocumentsNotes: p.additionalDocumentsNotes ?? "",
    declarationAccepted: p.declarationAccepted ?? false,
    owners:
      initialOwners.length > 0
        ? [...initialOwners].sort((a, b) => a.ownerIndex - b.ownerIndex).map(toFormOwner)
        : [],
  });

  const parseUsd = (s: string): number | null => {
    const t = s.trim().replace(/\./g, "").replace(",", ".");
    const n = parseFloat(t);
    return Number.isNaN(n) ? null : Math.round(n * 100);
  };

  const nextOwnerIndex = (): number => {
    const used = new Set(form.owners.map((o) => o.ownerIndex));
    for (let i = 2; i <= 5; i++) if (!used.has(i)) return i;
    return -1;
  };

  const addOwner = () => {
    const idx = nextOwnerIndex();
    if (idx < 0) return;
    setForm((f) => ({
      ...f,
      owners: [
        ...f.owners,
        {
          ownerIndex: idx,
          email: "",
          fullLegalName: "",
          residenceCountry: "",
          citizenshipCountry: "",
          homeAddressDifferent: false,
          usTaxId: "",
          foreignTaxId: "",
        },
      ],
    }));
  };

  const removeOwner = (idx: number) => {
    setForm((f) => ({
      ...f,
      owners: f.owners.filter((o) => o.ownerIndex !== idx),
    }));
  };

  const updateOwner = (ownerIndex: number, field: keyof FormOwner, value: string | boolean) => {
    setForm((f) => ({
      ...f,
      owners: f.owners.map((o) =>
        o.ownerIndex === ownerIndex ? { ...o, [field]: value } : o
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const assetsVal = parseUsd(form.totalAssetsUsdCents);
    if (assetsVal === null || assetsVal < 0) {
      setMessage({ type: "error", text: "Ativos totais da empresa até 31 de dezembro é obrigatório (>= 0)." });
      return;
    }
    if (form.hasUsBankAccounts === undefined) {
      setMessage({ type: "error", text: "Selecione Sim ou Não para contas bancárias nos EUA." });
      return;
    }
    if (form.hasAdditionalOwners) {
      for (const o of form.owners) {
        const err = validateOwner(o);
        if (err) {
          setMessage({ type: "error", text: err });
          return;
        }
      }
    }
    setSaving(true);
    setMessage(null);
    try {
      const ownersPayload = form.hasAdditionalOwners
        ? form.owners
            .filter(hasOwnerData)
            .map((o) => ({
              ownerIndex: o.ownerIndex,
              email: o.email?.trim() || undefined,
              fullLegalName: o.fullLegalName?.trim() || undefined,
              residenceCountry: o.residenceCountry?.trim() || undefined,
              citizenshipCountry: o.citizenshipCountry?.trim() || undefined,
              homeAddressDifferent: o.homeAddressDifferent ?? false,
              usTaxId: o.usTaxId?.trim() || undefined,
              foreignTaxId: o.foreignTaxId?.trim() || undefined,
            }))
        : [];
      const payload = {
        llcName: form.llcName || undefined,
        formationDate: form.formationDate || undefined,
        activitiesDescription: form.activitiesDescription || undefined,
        einNumber: form.einNumber || undefined,
        llcUsAddressLine1: form.llcUsAddressLine1 || undefined,
        llcUsAddressLine2: form.llcUsAddressLine2 || undefined,
        llcUsCity: form.llcUsCity || undefined,
        llcUsState: form.llcUsState || undefined,
        llcUsZip: form.llcUsZip || undefined,
        ownerEmail: form.ownerEmail || undefined,
        ownerFullLegalName: form.ownerFullLegalName || undefined,
        ownerResidenceCountry: form.ownerResidenceCountry || undefined,
        ownerCitizenshipCountry: form.ownerCitizenshipCountry || undefined,
        ownerHomeAddressDifferent: form.ownerHomeAddressDifferent,
        ownerResidentialAddressLine1: form.ownerHomeAddressDifferent ? (form.ownerResidentialAddressLine1 || undefined) : undefined,
        ownerResidentialAddressLine2: form.ownerHomeAddressDifferent ? (form.ownerResidentialAddressLine2 || undefined) : undefined,
        ownerResidentialCity: form.ownerHomeAddressDifferent ? (form.ownerResidentialCity || undefined) : undefined,
        ownerResidentialState: form.ownerHomeAddressDifferent ? (form.ownerResidentialState || undefined) : undefined,
        ownerResidentialPostalCode: form.ownerHomeAddressDifferent ? (form.ownerResidentialPostalCode || undefined) : undefined,
        ownerResidentialCountry: form.ownerHomeAddressDifferent ? (form.ownerResidentialCountry || undefined) : undefined,
        ownerUsTaxId: form.ownerUsTaxId || undefined,
        ownerForeignTaxId: form.ownerForeignTaxId || undefined,
        llcFormationCostUsdCents: parseUsd(form.llcFormationCostUsdCents),
        hasAdditionalOwners: form.hasAdditionalOwners,
        totalAssetsUsdCents: parseUsd(form.totalAssetsUsdCents),
        hasUsBankAccounts: form.hasUsBankAccounts,
        totalWithdrawalsUsdCents: parseUsd(form.totalWithdrawalsUsdCents),
        totalTransferredToLlcUsdCents: parseUsd(form.totalTransferredToLlcUsdCents),
        totalWithdrawnFromLlcUsdCents: parseUsd(form.totalWithdrawnFromLlcUsdCents),
        personalExpensesPaidByCompanyUsdCents: parseUsd(form.personalExpensesPaidByCompanyUsdCents),
        businessExpensesPaidPersonallyUsdCents: parseUsd(form.businessExpensesPaidPersonallyUsdCents),
        passportCopiesProvided: form.passportCopiesProvided,
        articlesOfOrganizationProvided: form.articlesOfOrganizationProvided,
        einLetterProvided: form.einLetterProvided,
        additionalDocumentsProvided: form.additionalDocumentsProvided,
        additionalDocumentsNotes: form.additionalDocumentsNotes || undefined,
        declarationAccepted: form.declarationAccepted,
        owners: ownersPayload,
      };
      const url = taxFormId
        ? `/api/clients/${clientId}/tax/forms/${taxFormId}`
        : `/api/clients/${clientId}/tax`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error ?? "Erro ao salvar" });
        return;
      }
      setMessage({ type: "success", text: "Salvo com sucesso." });
      if (json.computed) {
        // Refresh would update status - for now we just show success
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = {
    INCOMPLETO: "bg-amber-100 text-amber-800",
    PENDENTE: "bg-blue-100 text-blue-800",
    PRONTO_PARA_ENVIO: "bg-green-100 text-green-800",
  }[status] ?? "bg-slate-100 text-slate-800";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Status do caso</h2>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusBadge}`}>
          {status.replace(/_/g, " ")}
        </span>
        {missingFields.length > 0 && (
          <p className="mt-2 text-xs text-amber-700">Campos faltando: {missingFields.join(", ")}</p>
        )}
        {alerts.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {alerts.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Contexto do serviço</p>
        <p className="mt-1">
          Declaração Form 5472 + 1120. Prazo padrão 15 de abril; com prorrogação 15 de outubro. Evitar multas e
          problemas conforme site vulpeinc.com.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Dados da LLC</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Nome da LLC *</label>
            <input
              type="text"
              value={form.llcName}
              onChange={(e) => setForm((f) => ({ ...f, llcName: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Data de formação *</label>
            <input
              type="date"
              value={form.formationDate}
              onChange={(e) => setForm((f) => ({ ...f, formationDate: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Descrição das atividades *</label>
            <textarea
              value={form.activitiesDescription}
              onChange={(e) => setForm((f) => ({ ...f, activitiesDescription: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">EIN</label>
            <input
              type="text"
              value={form.einNumber}
              onChange={(e) => setForm((f) => ({ ...f, einNumber: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Endereço EUA - Linha 1 *</label>
            <input
              type="text"
              value={form.llcUsAddressLine1}
              onChange={(e) => setForm((f) => ({ ...f, llcUsAddressLine1: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Linha 2</label>
            <input
              type="text"
              value={form.llcUsAddressLine2}
              onChange={(e) => setForm((f) => ({ ...f, llcUsAddressLine2: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Cidade *</label>
            <input
              type="text"
              value={form.llcUsCity}
              onChange={(e) => setForm((f) => ({ ...f, llcUsCity: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Estado *</label>
            <input
              type="text"
              value={form.llcUsState}
              onChange={(e) => setForm((f) => ({ ...f, llcUsState: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">CEP *</label>
            <input
              type="text"
              value={form.llcUsZip}
              onChange={(e) => setForm((f) => ({ ...f, llcUsZip: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Dados do proprietário principal</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">E-mail *</label>
            <input
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Nome legal completo *</label>
            <input
              type="text"
              value={form.ownerFullLegalName}
              onChange={(e) => setForm((f) => ({ ...f, ownerFullLegalName: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">País de residência *</label>
            <input
              type="text"
              value={form.ownerResidenceCountry}
              onChange={(e) => setForm((f) => ({ ...f, ownerResidenceCountry: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">País de cidadania *</label>
            <input
              type="text"
              value={form.ownerCitizenshipCountry}
              onChange={(e) => setForm((f) => ({ ...f, ownerCitizenshipCountry: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="ownerHomeAddressDifferent"
              checked={form.ownerHomeAddressDifferent}
              onChange={(e) => {
                const checked = e.target.checked;
                setForm((f) => ({
                  ...f,
                  ownerHomeAddressDifferent: checked,
                  ...(!checked && {
                    ownerResidentialAddressLine1: "",
                    ownerResidentialAddressLine2: "",
                    ownerResidentialCity: "",
                    ownerResidentialState: "",
                    ownerResidentialPostalCode: "",
                    ownerResidentialCountry: "",
                  }),
                }));
              }}
              className="rounded border-slate-300"
            />
            <label htmlFor="ownerHomeAddressDifferent" className="text-xs font-medium text-slate-600">
              Endereço residencial diferente do endereço da LLC *
            </label>
          </div>
          {form.ownerHomeAddressDifferent && (
            <div className="sm:col-span-2 space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <h4 className="text-xs font-semibold text-slate-700">
                Endereço residencial (se diferente do endereço da empresa)
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">Endereço *</label>
                  <input
                    type="text"
                    value={form.ownerResidentialAddressLine1}
                    onChange={(e) => setForm((f) => ({ ...f, ownerResidentialAddressLine1: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Linha 1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">Endereço (linha 2)</label>
                  <input
                    type="text"
                    value={form.ownerResidentialAddressLine2}
                    onChange={(e) => setForm((f) => ({ ...f, ownerResidentialAddressLine2: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Cidade *</label>
                  <input
                    type="text"
                    value={form.ownerResidentialCity}
                    onChange={(e) => setForm((f) => ({ ...f, ownerResidentialCity: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Estado/Província *</label>
                  <input
                    type="text"
                    value={form.ownerResidentialState}
                    onChange={(e) => setForm((f) => ({ ...f, ownerResidentialState: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Código postal *</label>
                  <input
                    type="text"
                    value={form.ownerResidentialPostalCode}
                    onChange={(e) => setForm((f) => ({ ...f, ownerResidentialPostalCode: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">País *</label>
                  <select
                    value={form.ownerResidentialCountry}
                    onChange={(e) => setForm((f) => ({ ...f, ownerResidentialCountry: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {UNIQUE_COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600">US Tax ID (se aplicável)</label>
            <input
              type="text"
              value={form.ownerUsTaxId}
              onChange={(e) => setForm((f) => ({ ...f, ownerUsTaxId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="hasAdditionalOwners"
              checked={form.hasAdditionalOwners}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  hasAdditionalOwners: e.target.checked,
                  owners: e.target.checked ? f.owners : [],
                }))
              }
              className="rounded border-slate-300"
            />
            <label htmlFor="hasAdditionalOwners" className="text-xs font-medium text-slate-600">
              Possui sócios adicionais (2–5)
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Custo de formação LLC (USD) *</label>
            <input
              type="text"
              placeholder="0,00"
              value={form.llcFormationCostUsdCents}
              onChange={(e) => setForm((f) => ({ ...f, llcFormationCostUsdCents: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {form.hasAdditionalOwners && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Sócios adicionais (2–5)</h3>
          {form.owners.length === 0 && (
            <p className="mb-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
              Você marcou que possui sócios adicionais. Adicione os dados de cada sócio abaixo.
            </p>
          )}
          <div className="space-y-4">
            {form.owners.map((o) => (
              <div
                key={o.ownerIndex}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Sócio {o.ownerIndex}</span>
                  <button
                    type="button"
                    onClick={() => removeOwner(o.ownerIndex)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">E-mail</label>
                    <input
                      type="email"
                      value={o.email}
                      onChange={(e) => updateOwner(o.ownerIndex, "email", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Nome legal completo *</label>
                    <input
                      type="text"
                      value={o.fullLegalName}
                      onChange={(e) => updateOwner(o.ownerIndex, "fullLegalName", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">País de residência *</label>
                    <input
                      type="text"
                      value={o.residenceCountry}
                      onChange={(e) => updateOwner(o.ownerIndex, "residenceCountry", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">País de cidadania *</label>
                    <input
                      type="text"
                      value={o.citizenshipCountry}
                      onChange={(e) => updateOwner(o.ownerIndex, "citizenshipCountry", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`homeAddrDiff-${o.ownerIndex}`}
                      checked={o.homeAddressDifferent}
                      onChange={(e) =>
                        updateOwner(o.ownerIndex, "homeAddressDifferent", e.target.checked)
                      }
                      className="rounded border-slate-300"
                    />
                    <label htmlFor={`homeAddrDiff-${o.ownerIndex}`} className="text-xs font-medium text-slate-600">
                      Endereço residencial diferente do endereço da LLC
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">US Tax ID (opcional)</label>
                    <input
                      type="text"
                      value={o.usTaxId}
                      onChange={(e) => updateOwner(o.ownerIndex, "usTaxId", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Foreign Tax ID (opcional)</label>
                    <input
                      type="text"
                      value={o.foreignTaxId}
                      onChange={(e) => updateOwner(o.ownerIndex, "foreignTaxId", e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {form.owners.length < 4 && (
            <button
              type="button"
              onClick={addOwner}
              className="mt-4 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Adicionar sócio
            </button>
          )}
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Ativos da empresa</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Ativos totais da empresa até 31 de dezembro *</label>
            <div className="mt-1 flex rounded-md border border-slate-300 shadow-sm">
              <span className="inline-flex items-center rounded-l-md border-r border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">$ USD</span>
              <input
                type="text"
                placeholder="0,00"
                value={form.totalAssetsUsdCents}
                onChange={(e) => setForm((f) => ({ ...f, totalAssetsUsdCents: e.target.value }))}
                className="block w-full flex-1 rounded-none rounded-r-md border-0 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">(dinheiro, estoque ao custo, equipamentos, etc.)</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">
              A empresa possui contas bancárias nos EUA em nome da LLC? *
            </label>
            <div className="mt-2 flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="hasUsBankAccounts"
                  checked={form.hasUsBankAccounts === true}
                  onChange={() => setForm((f) => ({ ...f, hasUsBankAccounts: true }))}
                  className="border-slate-300 text-slate-600 focus:ring-slate-500"
                />
                <span className="text-sm text-slate-700">Sim</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="hasUsBankAccounts"
                  checked={form.hasUsBankAccounts === false}
                  onChange={() => setForm((f) => ({ ...f, hasUsBankAccounts: false }))}
                  className="border-slate-300 text-slate-600 focus:ring-slate-500"
                />
                <span className="text-sm text-slate-700">Não</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Valor total transferido pessoalmente para a LLC (USD)</label>
            <input
              type="text"
              placeholder="0,00"
              value={form.totalTransferredToLlcUsdCents}
              onChange={(e) => setForm((f) => ({ ...f, totalTransferredToLlcUsdCents: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Valor total retirado pessoalmente da LLC (USD)</label>
            <input
              type="text"
              placeholder="0,00"
              value={form.totalWithdrawnFromLlcUsdCents}
              onChange={(e) => setForm((f) => ({ ...f, totalWithdrawnFromLlcUsdCents: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Valor total das despesas pessoais pagas com fundos comerciais (USD)</label>
            <input
              type="text"
              placeholder="0,00"
              value={form.personalExpensesPaidByCompanyUsdCents}
              onChange={(e) => setForm((f) => ({ ...f, personalExpensesPaidByCompanyUsdCents: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Valor total das despesas comerciais pagas com fundos pessoais (USD)</label>
            <input
              type="text"
              placeholder="0,00"
              value={form.businessExpensesPaidPersonallyUsdCents}
              onChange={(e) => setForm((f) => ({ ...f, businessExpensesPaidPersonallyUsdCents: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Envio de arquivos (checklist)</h3>
        <div className="space-y-2">
          {[
            { key: "passportCopiesProvided", label: "Cópias do passaporte *" },
            { key: "articlesOfOrganizationProvided", label: "Articles of Organization *" },
            { key: "einLetterProvided", label: "Carta do EIN" },
            { key: "additionalDocumentsProvided", label: "Documentos adicionais" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={key}
                checked={form[key as keyof typeof form] as boolean}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                className="rounded border-slate-300"
              />
              <label htmlFor={key} className="text-xs font-medium text-slate-600">
                {label}
              </label>
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600">Observações documentos adicionais</label>
            <textarea
              value={form.additionalDocumentsNotes}
              onChange={(e) => setForm((f) => ({ ...f, additionalDocumentsNotes: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Declaração final</h3>
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="declarationAccepted"
            checked={form.declarationAccepted}
            onChange={(e) => setForm((f) => ({ ...f, declarationAccepted: e.target.checked }))}
            className="mt-1 rounded border-slate-300"
          />
          <label htmlFor="declarationAccepted" className="text-xs font-medium text-slate-600">
            Li e compreendi as informações do formulário e confirmo a veracidade dos dados. *
          </label>
        </div>
      </section>

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-slate-800 px-6 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}

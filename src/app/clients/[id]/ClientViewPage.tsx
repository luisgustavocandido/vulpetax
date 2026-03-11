"use client";

import Link from "next/link";
import type {
  InitialClientForEdit,
  SerializedLineItem,
  SerializedPartner,
} from "@/lib/serialize/clientToInitialClient";

const KIND_LABELS: Record<string, string> = {
  LLC: "LLC",
  Endereco: "Endereço",
  Mensalidade: "Mensalidade",
  Gateway: "Gateway",
  ServicoAdicional: "Serviço Adicional",
  BancoTradicional: "Banco Tradicional",
  Outro: "Outro",
};

const ROLE_LABELS: Record<string, string> = {
  SocioPrincipal: "Sócio principal",
  Socio: "Sócio",
};

function formatDate(s: string | undefined): string {
  if (!s || s.length < 10) return "—";
  try {
    const [y, m, d] = s.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function empty(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" && value.trim() === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{empty(value)}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-gray-200 pb-2 text-base font-semibold uppercase tracking-wide text-gray-600">
        {title}
      </h2>
      {children}
    </section>
  );
}

export type ClientViewPageProps = {
  clientId: string;
  initialClient: InitialClientForEdit;
  basePath?: string;
};

export function ClientViewPage({
  clientId,
  initialClient,
  basePath = "/clients",
}: ClientViewPageProps) {
  const c = initialClient;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Ver empresa</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={basePath}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Voltar
          </Link>
          <Link
            href={`${basePath}/${clientId}`}
            className="rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Editar empresa
          </Link>
        </div>
      </div>

      <div className="space-y-8">
        {/* — EMPRESA */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <Section title="Empresa">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Empresa" value={c.companyName} />
              <Field label="Código do cliente" value={c.customerCode} />
              <Field label="Comercial" value={c.commercial} />
              <Field label="SDR" value={c.sdr} />
              <Field label="Tipo de Negócio" value={c.businessType} />
              <Field label="Anônimo" value={c.anonymous} />
              <Field label="Holding" value={c.holding} />
              <Field label="Afiliado" value={c.affiliate} />
              {c.affiliate && (
                <>
                  <Field label="Tipo de Afiliado" value={c.affiliateType} />
                  {c.affiliateType === "Outros" && (
                    <Field label="Especifique" value={c.affiliateOtherText} />
                  )}
                </>
              )}
              <Field label="Express" value={c.express} />
              <Field label="E-mail" value={c.email} />
              <div className="sm:col-span-2">
                <Field label="Observações" value={c.notes} />
              </div>
            </div>
          </Section>
        </div>

        {/* — DADOS DA EMPRESA */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <Section title="Dados da Empresa">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="EIN" value={c.einNumber} />
              <Field label="Business ID" value={c.businessId} />
              <Field label="Endereço (linha 1)" value={c.companyAddressLine1} />
              <Field label="Endereço (linha 2)" value={c.companyAddressLine2} />
              <Field
                label="Data de Formação"
                value={c.formationDate ? formatDate(c.formationDate) : undefined}
              />
              <Field
                label="Data Annual Report"
                value={c.annualReportDate ? formatDate(c.annualReportDate) : undefined}
              />
            </div>
          </Section>
        </div>

        {/* — ITENS */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <Section title="Itens">
            {c.lineItems.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum item.</p>
            ) : (
              <ul className="space-y-6">
                {c.lineItems.map((item: SerializedLineItem, i: number) => (
                  <li
                    key={item.id ?? i}
                    className="rounded-lg border border-gray-100 bg-gray-50/50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
                      <span className="font-medium text-gray-900">
                        {KIND_LABELS[item.kind] ?? item.kind}
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        {formatCents(item.valueCents)}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Descrição" value={item.description} />
                      <Field label="Sale Date" value={item.saleDate ? formatDate(item.saleDate) : undefined} />
                      <Field label="Periodicidade" value={item.billingPeriod} />
                      <Field label="Expiração" value={item.expirationDate ? formatDate(item.expirationDate) : undefined} />
                      <Field label="Endereço (provedor)" value={item.addressProvider} />
                      <Field label="STE" value={item.steNumber} />
                      <Field label="Endereço (linha 1)" value={item.addressLine1} />
                      <Field label="Endereço (linha 2)" value={item.addressLine2} />
                      <Field
                        label="Forma de pagamento"
                        value={item.paymentMethod === "Outro" ? item.paymentMethodCustom : item.paymentMethod}
                      />
                      <Field label="Comercial" value={item.commercial} />
                      <Field label="SDR" value={item.sdr} />
                      <Field label="Categoria LLC" value={item.llcCategory} />
                      <Field label="Estado da LLC" value={item.llcState} />
                      {item.llcCategory === "Personalizado" && (
                        <Field label="Categoria LLC (personalizada)" value={item.llcCustomCategory} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* — SÓCIOS */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <Section title="Sócios">
            {c.partners.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum sócio.</p>
            ) : (
              <ul className="space-y-6">
                {c.partners.map((p: SerializedPartner, i: number) => (
                  <li
                    key={i}
                    className={`rounded-lg border p-4 ${
                      p.isPayer
                        ? "border-indigo-200 bg-indigo-50/30"
                        : "border-gray-100 bg-gray-50/50"
                    }`}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
                      <span className="font-medium text-gray-900">{p.fullName}</span>
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                        {ROLE_LABELS[p.role] ?? p.role}
                      </span>
                      {p.isPayer && (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Cliente (Pagador)
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Participação" value={`${p.percentage}%`} />
                      <Field label="Cliente (Pagador)" value={p.isPayer} />
                      <Field label="Nome completo" value={p.fullName} />
                      {p.customer?.givenName != null && (
                        <Field label="Given name" value={p.customer.givenName} />
                      )}
                      {p.customer?.surName != null && (
                        <Field label="Sobrenome" value={p.customer.surName} />
                      )}
                      <Field label="E-mail" value={p.email ?? p.customer?.email} />
                      <Field label="Telefone" value={p.phone ?? p.customer?.phone} />
                      {p.customer?.citizenshipCountry != null && (
                        <Field label="País de cidadania" value={p.customer.citizenshipCountry} />
                      )}
                      <Field label="Endereço (linha 1)" value={p.addressLine1 ?? p.customer?.addressLine1} />
                      <Field label="Endereço (linha 2)" value={p.addressLine2 ?? p.customer?.addressLine2} />
                      <Field label="Cidade" value={p.city ?? p.customer?.city} />
                      <Field label="Estado" value={p.state ?? p.customer?.stateProvince} />
                      <Field label="CEP" value={p.postalCode ?? p.customer?.postalCode} />
                      <Field label="País" value={p.country ?? p.customer?.country} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

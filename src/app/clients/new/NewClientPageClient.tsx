"use client";

import { ClientForm } from "@/components/ClientForm";

type NewClientPageClientProps = {
  /** Título da página. Default: Novo cliente */
  pageTitle?: string;
  /** URL para redirecionar após criar. Default: /clients */
  successRedirectPath?: string;
};

export default function NewClientPageClient({
  pageTitle = "Novo cliente",
  successRedirectPath = "/clients",
}: NewClientPageClientProps = {}) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">{pageTitle}</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <ClientForm successRedirectPath={successRedirectPath} />
      </div>
    </div>
  );
}

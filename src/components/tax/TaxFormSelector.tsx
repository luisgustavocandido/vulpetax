"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TaxForm = {
  id: string;
  taxYear: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  clientId: string;
  currentTaxFormId: string;
};

export function TaxFormSelector({ clientId, currentTaxFormId }: Props) {
  const [forms, setForms] = useState<TaxForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/tax/forms`)
      .then((res) => res.json())
      .then((data) => {
        setForms(data.forms || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return <div className="mb-4 text-sm text-slate-500">Carregando formulários...</div>;
  }

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Formulários TAX</h2>
        <Link
          href={`/clients/${clientId}/tax/new`}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          + Adicionar novo TAX
        </Link>
      </div>
      {forms.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum formulário encontrado.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {forms.map((form) => (
            <Link
              key={form.id}
              href={`/clients/${clientId}/tax/${form.id}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                form.id === currentTaxFormId
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {form.taxYear} {form.status === "draft" && "(Rascunho)"}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

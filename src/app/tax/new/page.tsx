"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClientSearchStep } from "@/components/tax/ClientSearchStep";
import { ManualTaxFormStep } from "@/components/tax/ManualTaxFormStep";

type Step = "question" | "search" | "manual";

export default function NewTaxFormPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("question");
  const [isExistingClient, setIsExistingClient] = useState<boolean | null>(null);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());

  const handleContinue = () => {
    if (isExistingClient === true) {
      setStep("search");
    } else if (isExistingClient === false) {
      setStep("manual");
    }
  };

  if (step === "search") {
    return (
      <ClientSearchStep
        taxYear={taxYear}
        onBack={() => setStep("question")}
        onCancel={() => router.push("/tax")}
      />
    );
  }

  if (step === "manual") {
    return (
      <ManualTaxFormStep
        taxYear={taxYear}
        onBack={() => setStep("question")}
        onCancel={() => router.push("/tax")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Criar novo TAX</h1>
        <p className="mt-1 text-sm text-slate-500">Preencha as informações abaixo para começar</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700">
            O cliente adquiriu a LLC ou algum serviço com a gente? *
          </label>
          <div className="mt-3 flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="isExistingClient"
                checked={isExistingClient === true}
                onChange={() => setIsExistingClient(true)}
                className="border-slate-300 text-slate-600 focus:ring-slate-500"
              />
              <span className="text-sm text-slate-700">Sim</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="isExistingClient"
                checked={isExistingClient === false}
                onChange={() => setIsExistingClient(false)}
                className="border-slate-300 text-slate-600 focus:ring-slate-500"
              />
              <span className="text-sm text-slate-700">Não</span>
            </label>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="taxYear" className="block text-sm font-medium text-slate-700">
            Ano Fiscal *
          </label>
          <input
            type="number"
            id="taxYear"
            min="2000"
            max="2100"
            value={taxYear}
            onChange={(e) => setTaxYear(parseInt(e.target.value, 10))}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <p className="mt-1 text-xs text-slate-500">O ano fiscal para o qual este formulário será preenchido</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleContinue}
            disabled={isExistingClient === null}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Continuar
          </button>
          <Link
            href="/tax"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  );
}

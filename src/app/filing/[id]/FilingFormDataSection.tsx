"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaxFilingFormData } from "@/app/actions/tax-filings";
import type { TaxFiling } from "@/db";

type Props = {
  filingId: string;
  filing: TaxFiling;
};

export function FilingFormDataSection({ filingId, filing }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const totalAssetsStr = (formData.get("totalAssetsYearEndUsd") as string)?.trim();
    const hasUsVal = formData.get("hasUsBankAccounts") as string;
    const fbarVal = formData.get("aggregateBalanceOver10k") as string;
    const totalAssetsYearEndUsd = totalAssetsStr
      ? parseFloat(totalAssetsStr.replace(",", "."))
      : null;

    startTransition(async () => {
      await updateTaxFilingFormData(filingId, {
        totalAssetsYearEndUsd: totalAssetsYearEndUsd != null && !Number.isNaN(totalAssetsYearEndUsd) ? totalAssetsYearEndUsd : null,
        hasUsBankAccounts: hasUsVal === "sim" ? true : hasUsVal === "nao" ? false : null,
        aggregateBalanceOver10k: fbarVal === "sim" ? true : fbarVal === "nao" ? false : null,
      });
      router.refresh();
    });
  }

  return (
    <div className="card mb-8">
      <div className="card-body">
        <h2 className="mb-3 section-title">Dados do ano (formulário VulpeTax)</h2>
      <form action={submit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Ativos totais da empresa até 31/12 (USD)</label>
          <input
            name="totalAssetsYearEndUsd"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={filing.totalAssetsYearEndUsd != null ? String(filing.totalAssetsYearEndUsd) : ""}
            className="input"
          />
        </div>
        <div>
          <label className="label">
            Possui contas bancárias nos EUA em nome da LLC?
          </label>
          <select
            name="hasUsBankAccounts"
            className="select"
            defaultValue={filing.hasUsBankAccounts === true ? "sim" : filing.hasUsBankAccounts === false ? "nao" : ""}
          >
            <option value="">—</option>
            <option value="nao">NÃO</option>
            <option value="sim">SIM</option>
          </select>
        </div>
        <div>
          <label className="label">
            Saldo agregado superior a USD 10.000 no ano? (FBAR)
          </label>
          <select
            name="aggregateBalanceOver10k"
            className="select"
            defaultValue={filing.aggregateBalanceOver10k === true ? "sim" : filing.aggregateBalanceOver10k === false ? "nao" : ""}
          >
            <option value="">—</option>
            <option value="nao">NÃO</option>
            <option value="sim">SIM</option>
          </select>
          <p className="hint">
            Formulário 114 (FBAR) possui custo adicional de USD 100,00.
          </p>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary"
          >
            {isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

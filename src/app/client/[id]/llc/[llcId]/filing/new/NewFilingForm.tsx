"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaxFiling } from "@/app/actions/tax-filings";

type Props = {
  clientId: string;
  llcId: string;
  existingYears: number[];
  yearOptions: number[];
};

export function NewFilingForm({
  clientId,
  llcId,
  existingYears,
  yearOptions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const year = parseInt(formData.get("taxYear") as string, 10);
    if (existingYears.includes(year)) {
      alert("Já existe uma declaração para este ano.");
      return;
    }
    startTransition(async () => {
      const { id } = await createTaxFiling({ llcId, taxYear: year });
      router.push(`/filing/${id}`);
    });
  }

  return (
    <form action={submit} className="max-w-sm space-y-4">
      <div>
        <label className="label">Ano fiscal *</label>
        <select
          name="taxYear"
          required
          className="select"
        >
          <option value="">Selecione o ano</option>
          {yearOptions.map((y) => (
            <option key={y} value={y} disabled={existingYears.includes(y)}>
              {y} {existingYears.includes(y) ? "(já existe)" : ""}
            </option>
          ))}
        </select>
        <p className="hint">
          Form 5472 + pro forma 1120 são obrigatórios por ano, mesmo com receita zero.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary"
        >
          {isPending ? "Criando…" : "Criar declaração"}
        </button>
        <a
          href={`/client/${clientId}`}
          className="btn btn-secondary"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CreateLLCInput } from "@/app/actions/llcs";

type Props = {
  clientId: string;
  action: (input: CreateLLCInput) => Promise<{ id: string }>;
};

export function LLCForm({ clientId, action }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    const name = formData.get("name") as string;
    const ein = formData.get("ein") as string;
    const state = formData.get("state") as string;
    const formationDateStr = formData.get("formationDate") as string;
    const addressLine1 = (formData.get("addressLine1") as string) || undefined;
    const addressLine2 = (formData.get("addressLine2") as string) || undefined;
    const city = (formData.get("city") as string) || undefined;
    const stateAddress = (formData.get("stateAddress") as string) || undefined;
    const zip = (formData.get("zip") as string) || undefined;
    const businessActivity = (formData.get("businessActivity") as string) || undefined;
    const formationCostStr = (formData.get("formationCostUsd") as string) || undefined;
    const formationCostUsd = formationCostStr ? parseFloat(formationCostStr.replace(",", ".")) : undefined;

    if (!name?.trim() || !ein?.trim() || !state || !formationDateStr) return;

    startTransition(async () => {
      const { id } = await action({
        clientId,
        name: name.trim(),
        ein: ein.trim().replace(/\D/g, "").slice(0, 9),
        state,
        formationDate: new Date(formationDateStr),
        addressLine1: addressLine1?.trim(),
        addressLine2: addressLine2?.trim(),
        city: city?.trim(),
        stateAddress: stateAddress?.trim() || undefined,
        zip: zip?.trim(),
        businessActivity: businessActivity?.trim(),
        formationCostUsd: formationCostUsd != null && !Number.isNaN(formationCostUsd) ? formationCostUsd : undefined,
      });
      router.push(`/client/${clientId}`);
    });
  }

  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Nome da LLC *</label>
        <input
          name="name"
          type="text"
          required
          placeholder="Ex: Silva Holdings LLC"
          className="input"
        />
      </div>
      <div>
        <label className="label">EIN (apenas números) *</label>
        <input
          name="ein"
          type="text"
          required
          placeholder="12-3456789"
          maxLength={10}
          className="input"
        />
      </div>
      <div>
        <label className="label">Estado da formação *</label>
        <select
          name="state"
          required
          className="select"
        >
          <option value="">Selecione</option>
          <option value="WY">Wyoming</option>
          <option value="DE">Delaware</option>
          <option value="NM">New Mexico</option>
          <option value="FL">Florida</option>
          <option value="TX">Texas</option>
        </select>
      </div>
      <div>
        <label className="label">Data de formação *</label>
        <input
          name="formationDate"
          type="date"
          required
          className="input"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Endereço (linha 1)</label>
        <input
          name="addressLine1"
          type="text"
          className="input"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Endereço (linha 2)</label>
        <input
          name="addressLine2"
          type="text"
          className="input"
        />
      </div>
      <div>
        <label className="label">Cidade</label>
        <input name="city" type="text" className="input" />
      </div>
      <div>
        <label className="label">Estado (2 letras)</label>
        <input
          name="stateAddress"
          type="text"
          maxLength={2}
          placeholder="WY"
          className="input"
        />
      </div>
      <div>
        <label className="label">ZIP</label>
        <input name="zip" type="text" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Atividade principal (Form 1120)</label>
        <input
          name="businessActivity"
          type="text"
          placeholder="Ex: Consulting, Software"
          className="input"
        />
      </div>
      <div>
        <label className="label">Custo de constituição da LLC (USD)</label>
        <input
          name="formationCostUsd"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          className="input"
        />
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary"
        >
          {isPending ? "Salvando…" : "Salvar LLC"}
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

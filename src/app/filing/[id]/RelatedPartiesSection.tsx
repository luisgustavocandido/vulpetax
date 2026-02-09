"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRelatedParty, deleteRelatedParty } from "@/app/actions/related-parties";
import type { RelatedParty } from "@/db";

const PARTY_TYPES = [
  { value: "owner", label: "Titular (owner)" },
  { value: "owner_company", label: "Empresa do titular" },
  { value: "other", label: "Outro" },
] as const;

const PARTY_TYPE_LABELS: Record<string, string> = {
  owner: "Titular (owner)",
  owner_company: "Empresa do titular",
  other: "Outro",
};

type Props = {
  taxFilingId: string;
  relatedParties: RelatedParty[];
};

export function RelatedPartiesSection({
  taxFilingId,
  relatedParties,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const name = (formData.get("name") as string)?.trim();
    const partyType = formData.get("partyType") as string;
    const address = (formData.get("address") as string)?.trim() || undefined;
    const country = (formData.get("country") as string)?.trim();
    const tin = (formData.get("tin") as string)?.trim() || undefined;
    if (!name || !partyType || !country) return;
    startTransition(async () => {
      await createRelatedParty({
        taxFilingId,
        name,
        partyType,
        address,
        country,
        tin,
      });
      router.refresh();
    });
  }

  function remove(partyId: string) {
    if (!confirm("Remover este related party?")) return;
    startTransition(async () => {
      await deleteRelatedParty(partyId);
      router.refresh();
    });
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 section-title">Partes relacionadas (Form 5472)</h2>
      <p className="mb-4 text-sm text-neutral-600">
        Mínimo 1 obrigatório. Cadastre o titular estrangeiro e, se houver,
        empresa do titular ou outros relacionados.
      </p>
      <div className="card">
        <div className="card-body">
        <form action={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome *</label>
            <input
              name="name"
              type="text"
              required
              className="input"
            />
          </div>
          <div>
            <label className="label">Tipo *</label>
            <select
              name="partyType"
              required
              className="select"
            >
              <option value="">Selecione</option>
              {PARTY_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">País *</label>
            <input
              name="country"
              type="text"
              required
              placeholder="Brasil"
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Endereço</label>
            <input
              name="address"
              type="text"
              className="input"
            />
          </div>
          <div>
            <label className="label">TIN / CPF</label>
            <input
              name="tin"
              type="text"
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary"
            >
              {isPending ? "Adicionando…" : "Adicionar parte relacionada"}
            </button>
          </div>
        </form>
        </div>
      </div>
      {relatedParties.length > 0 && (
        <ul className="mt-4 space-y-2">
          {relatedParties.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm"
            >
              <span>
                <strong>{p.name}</strong> — {PARTY_TYPE_LABELS[p.partyType] ?? p.partyType} · {p.country}
              </span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={isPending}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

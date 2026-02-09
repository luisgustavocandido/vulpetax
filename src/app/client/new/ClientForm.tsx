"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CreateClientInput } from "@/app/actions/clients";

type Props = {
  action: (input: CreateClientInput) => Promise<{ id: string }>;
};

export function ClientForm({ action }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const phone = (formData.get("phone") as string) || undefined;
    const country = formData.get("country") as string;
    const citizenshipCountry = (formData.get("citizenshipCountry") as string) || undefined;
    const address = (formData.get("address") as string) || undefined;
    const addressDifferentFromLLC = (formData.get("addressDifferentFromLLC") as string) === "sim";
    const usTin = (formData.get("usTin") as string) || undefined;
    const foreignTin = (formData.get("foreignTin") as string) || undefined;
    const idType = (formData.get("idType") as string) || undefined;
    const idNumber = (formData.get("idNumber") as string) || undefined;

    if (!fullName?.trim() || !email?.trim() || !country?.trim()) return;

    startTransition(async () => {
      const { id } = await action({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone?.trim(),
        country: country.trim(),
        citizenshipCountry: citizenshipCountry?.trim(),
        address: address?.trim(),
        addressDifferentFromLLC,
        usTin: usTin?.trim(),
        foreignTin: foreignTin?.trim(),
        idType: idType?.trim(),
        idNumber: idNumber?.trim(),
      });
      router.push(`/client/${id}`);
    });
  }

  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Nome completo *</label>
        <input
          name="fullName"
          type="text"
          required
          className="input"
        />
      </div>
      <div>
        <label className="label">E-mail *</label>
        <input
          name="email"
          type="email"
          required
          className="input"
        />
      </div>
      <div>
        <label className="label">Telefone</label>
        <input
          name="phone"
          type="tel"
          className="input"
        />
      </div>
      <div>
        <label className="label">País de residência *</label>
        <select
          name="country"
          required
          className="select"
        >
          <option value="">Selecione</option>
          <option value="Brasil">Brasil</option>
          <option value="Argentina">Argentina</option>
          <option value="Chile">Chile</option>
          <option value="Colômbia">Colômbia</option>
          <option value="México">México</option>
          <option value="Peru">Peru</option>
          <option value="Uruguai">Uruguai</option>
          <option value="Venezuela">Venezuela</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div>
        <label className="label">País de cidadania</label>
        <select name="citizenshipCountry" className="select">
          <option value="">Selecione</option>
          <option value="Brasil">Brasil</option>
          <option value="Argentina">Argentina</option>
          <option value="Chile">Chile</option>
          <option value="Colômbia">Colômbia</option>
          <option value="México">México</option>
          <option value="Peru">Peru</option>
          <option value="Uruguai">Uruguai</option>
          <option value="Venezuela">Venezuela</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Endereço particular</label>
        <input
          name="address"
          type="text"
          placeholder="Endereço, cidade, país"
          className="input"
        />
      </div>
      <div>
        <label className="label">
          Endereço particular diferente do endereço da empresa?
        </label>
        <select name="addressDifferentFromLLC" className="select">
          <option value="nao">NÃO</option>
          <option value="sim">SIM</option>
        </select>
      </div>
      <div>
        <label className="label">
          Identificação fiscal EUA (ITIN/SSN), se aplicável
        </label>
        <input name="usTin" type="text" className="input" />
      </div>
      <div>
        <label className="label">CPF / TIN estrangeiro</label>
        <input
          name="foreignTin"
          type="text"
          placeholder="Ex: 123.456.789-00"
          className="input"
        />
      </div>
      <div>
        <label className="label">Tipo doc. (passport / RG)</label>
        <input
          name="idType"
          type="text"
          className="input"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Número do documento</label>
        <input
          name="idNumber"
          type="text"
          className="input"
        />
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary"
        >
          {isPending ? "Salvando…" : "Salvar cliente"}
        </button>
        <a
          href="/"
          className="btn btn-secondary"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}

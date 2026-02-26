"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { createPersonGroupSchema, type CreatePersonGroupInput } from "@/lib/personGroups/validators";
import { CountrySelectForAddress } from "@/components/CountrySelectForAddress";

const DEFAULT_ADDRESS = {
  line1: "",
  line2: null as string | null,
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "",
};

export function PersonGroupForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreatePersonGroupInput>({
    resolver: zodResolver(createPersonGroupSchema) as import("react-hook-form").Resolver<CreatePersonGroupInput>,
    defaultValues: {
      fullName: "",
      givenName: "",
      surName: "",
      citizenshipCountry: "",
      phone: "",
      email: "",
      address: DEFAULT_ADDRESS,
    },
  });

  const { register, control, formState: { errors } } = form;

  const handleSubmit = async (data: CreatePersonGroupInput) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/person-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao cadastrar");
        setSubmitting(false);
        return;
      }
      const personGroupId = json.personGroupId as string;
      router.push(`/persons/${personGroupId}`);
      router.refresh();
      setSubmitting(false);
    } catch {
      setError("Erro de rede ou servidor.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Dados pessoais</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Nome completo *</label>
            <input
              {...register("fullName")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Given Name *</label>
            <input {...register("givenName")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
            {errors.givenName && <p className="mt-1 text-sm text-red-600">{errors.givenName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Sobrenome *</label>
            <input {...register("surName")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
            {errors.surName && <p className="mt-1 text-sm text-red-600">{errors.surName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cidadania *</label>
            <Controller
              name="citizenshipCountry"
              control={control}
              render={({ field }) => (
                <CountrySelectForAddress
                  name="citizenshipCountry"
                  value={field.value}
                  onChange={field.onChange}
                  required
                />
              )}
            />
            {errors.citizenshipCountry && <p className="mt-1 text-sm text-red-600">{errors.citizenshipCountry.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone</label>
            <input {...register("phone")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">E-mail pessoal *</label>
            <input
              type="email"
              {...register("email")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-700">Endereço pessoal</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-600">Linha 1 *</label>
              <input {...register("address.line1")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              {errors.address?.line1 && <p className="mt-1 text-sm text-red-600">{errors.address.line1.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-600">Linha 2</label>
              <input {...register("address.line2")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Cidade *</label>
              <input {...register("address.city")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              {errors.address?.city && <p className="mt-1 text-sm text-red-600">{errors.address.city.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-600">Estado/Província *</label>
              <input {...register("address.stateProvince")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              {errors.address?.stateProvince && <p className="mt-1 text-sm text-red-600">{errors.address.stateProvince.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-600">Código postal *</label>
              <input {...register("address.postalCode")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              {errors.address?.postalCode && <p className="mt-1 text-sm text-red-600">{errors.address.postalCode.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-600">País *</label>
              <Controller
                name="address.country"
                control={control}
                render={({ field }) => (
                  <CountrySelectForAddress
                    name="address.country"
                    value={field.value}
                    onChange={field.onChange}
                    required
                  />
                )}
              />
              {errors.address?.country && <p className="mt-1 text-sm text-red-600">{errors.address.country.message}</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Salvando…" : "Cadastrar cliente"}
        </button>
        <Link
          href="/clientes"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

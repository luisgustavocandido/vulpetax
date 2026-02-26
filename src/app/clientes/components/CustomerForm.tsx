"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateCustomerSchema, type UpdateCustomerInput } from "@/lib/customers/validators";
import { CountrySelectForAddress } from "@/components/CountrySelectForAddress";
import type { CustomerFull } from "@/lib/customers/repo";

type CustomerFormProps = {
  customerId: string;
  initialData: CustomerFull;
};

export function CustomerForm({ customerId, initialData }: CustomerFormProps) {
  const router = useRouter();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<UpdateCustomerInput>({
    resolver: zodResolver(updateCustomerSchema),
    defaultValues: {
      fullName: initialData.fullName,
      givenName: initialData.givenName,
      surName: initialData.surName,
      citizenshipCountry: initialData.citizenshipCountry,
      phone: initialData.phone ?? "",
      email: initialData.email,
      address: {
        line1: initialData.address.line1,
        line2: initialData.address.line2 ?? "",
        city: initialData.address.city,
        stateProvince: initialData.address.stateProvince,
        postalCode: initialData.address.postalCode,
        country: initialData.address.country,
      },
    },
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;
  const citizenshipCountry = watch("citizenshipCountry");
  const addressCountry = watch("address.country");

  async function onSubmit(data: UpdateCustomerInput) {
    setSubmitting(true);
    setToast(null);
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          phone: data.phone?.trim() || null,
          address: {
            ...data.address,
            line2: data.address.line2?.trim() || null,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          type: "error",
          message: json.error ?? "Erro ao salvar. Tente novamente.",
        });
        setSubmitting(false);
        return;
      }
      setToast({ type: "success", message: "Cliente atualizado com sucesso." });
      setTimeout(() => {
        router.push("/clientes?tab=customers");
        router.refresh();
      }, 800);
    } catch {
      setToast({ type: "error", message: "Erro de rede. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {toast && (
        <div
          role="alert"
          className={`rounded-md px-4 py-3 text-sm ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Nome completo *</label>
          <input
            {...register("fullName")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.fullName && (
            <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Given name *</label>
          <input
            {...register("givenName")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.givenName && (
            <p className="mt-1 text-xs text-red-600">{errors.givenName.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Sobrenome *</label>
          <input
            {...register("surName")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.surName && (
            <p className="mt-1 text-xs text-red-600">{errors.surName.message}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Cidadania *</label>
          <CountrySelectForAddress
            name="citizenshipCountry"
            value={citizenshipCountry}
            onChange={(v) => setValue("citizenshipCountry", v, { shouldValidate: true })}
            required
            className="mt-1"
          />
          {errors.citizenshipCountry && (
            <p className="mt-1 text-xs text-red-600">{errors.citizenshipCountry.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Telefone</label>
          <input
            {...register("phone")}
            type="tel"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">E-mail *</label>
          <input
            {...register("email")}
            type="email"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-800">Endereço</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Endereço (linha 1) *</label>
            <input
              {...register("address.line1")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.address?.line1 && (
              <p className="mt-1 text-xs text-red-600">{errors.address.line1.message}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Endereço (linha 2)</label>
            <input
              {...register("address.line2")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cidade *</label>
            <input
              {...register("address.city")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.address?.city && (
              <p className="mt-1 text-xs text-red-600">{errors.address.city.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Estado/Província *</label>
            <input
              {...register("address.stateProvince")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.address?.stateProvince && (
              <p className="mt-1 text-xs text-red-600">{errors.address.stateProvince.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Código postal *</label>
            <input
              {...register("address.postalCode")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.address?.postalCode && (
              <p className="mt-1 text-xs text-red-600">{errors.address.postalCode.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">País *</label>
            <CountrySelectForAddress
              name="address.country"
              value={addressCountry}
              onChange={(v) => setValue("address.country", v, { shouldValidate: true })}
              required
              className="mt-1"
            />
            {errors.address?.country && (
              <p className="mt-1 text-xs text-red-600">{errors.address.country.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/clientes?tab=customers")}
          disabled={submitting}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { getBaseUrlFromHeaders } from "@/lib/api";
import { notFound } from "next/navigation";
import { CustomerForm } from "../../../components/CustomerForm";
import type { CustomerFull } from "@/lib/customers/repo";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarClientePagadorPage({ params }: PageProps) {
  const { id } = await params;
  const headersList = await headers();
  const base = getBaseUrlFromHeaders(headersList);
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${base}/api/customers/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    if (res.status === 404) notFound();
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">Erro ao carregar cliente</p>
          <p className="mt-1 text-sm text-red-700">
            {res.status === 500 ? "Erro interno. Tente novamente." : "Cliente não encontrado."}
          </p>
          <Link href="/clientes?tab=customers" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Voltar para Clientes (Pagadores)
          </Link>
        </div>
      </div>
    );
  }

  const initialData = (await res.json()) as CustomerFull;

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/clientes?tab=customers"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Voltar para Clientes (Pagadores)
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">
          Editar Cliente (Pagador)
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {initialData.fullName}
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CustomerForm customerId={id} initialData={initialData} />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";

export default function ClientNotFound() {
  return (
    <div className="p-6">
      <p className="text-gray-600">Cliente não encontrado.</p>
      <Link href="/clients" className="mt-4 inline-block text-blue-600 hover:underline">
        Voltar para clientes
      </Link>
    </div>
  );
}

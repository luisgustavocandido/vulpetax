"use client";

import Link from "next/link";

export default function EmpresaNotFound() {
  return (
    <div className="p-6">
      <p className="text-gray-600">Empresa não encontrada.</p>
      <Link href="/empresas" className="mt-4 inline-block text-blue-600 hover:underline">
        Voltar para empresas
      </Link>
    </div>
  );
}

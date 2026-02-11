"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  clientId: string;
  clientName: string;
};

export function ClientTabs({ clientId, clientName }: Props) {
  const pathname = usePathname();
  const isTax = pathname.includes("/tax");

  return (
    <div className="mb-6">
      <div className="mb-2 text-sm font-medium text-slate-600">{clientName}</div>
      <div className="flex gap-1 border-b border-slate-200">
        <Link
          href={`/clients/${clientId}`}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            !isTax
              ? "border-slate-800 text-slate-900"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          Dados
        </Link>
        <Link
          href={`/clients/${clientId}/tax`}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            isTax
              ? "border-slate-800 text-slate-900"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          TAX (Não Residentes)
        </Link>
      </div>
    </div>
  );
}

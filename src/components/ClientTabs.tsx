"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  clientId: string;
  clientName: string;
  /** Base path para links (ex: /clients ou /empresas). Default: /clients */
  basePath?: string;
};

export function ClientTabs({ clientId, clientName, basePath = "/clients" }: Props) {
  const pathname = usePathname();
  const isTax = pathname.includes("/tax");

  return (
    <div className="mb-6">
      <div className="mb-2 text-sm font-medium text-slate-600">{clientName}</div>
      <div className="flex gap-1 border-b border-slate-200">
        <Link
          href={`${basePath}/${clientId}`}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            !isTax
              ? "border-slate-800 text-slate-900"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          Dados
        </Link>
        <Link
          href={`${basePath}/${clientId}/tax`}
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

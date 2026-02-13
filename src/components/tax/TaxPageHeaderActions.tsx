"use client";

import Link from "next/link";
import { CreateTaxFormButton } from "./CreateTaxFormButton";

export function TaxPageHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <CreateTaxFormButton />
      <Link
        href="/clients"
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Clientes
      </Link>
    </div>
  );
}

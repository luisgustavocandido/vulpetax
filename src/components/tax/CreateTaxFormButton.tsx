"use client";

import Link from "next/link";

export function CreateTaxFormButton() {
  return (
    <Link
      href="/tax/new"
      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      + Novo TAX
    </Link>
  );
}

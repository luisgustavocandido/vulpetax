import { Suspense } from "react";
import { BillingPageClient } from "./BillingPageClient";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><p className="text-slate-500">Carregando…</p></div>}>
      <BillingPageClient />
    </Suspense>
  );
}

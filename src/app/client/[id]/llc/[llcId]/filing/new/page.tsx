import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/app/actions/clients";
import { getLLC } from "@/app/actions/llcs";
import { getTaxFilingsByLLC } from "@/app/actions/tax-filings";
import { NewFilingForm } from "./NewFilingForm";

export default async function NewFilingPage({
  params,
}: {
  params: Promise<{ id: string; llcId: string }>;
}) {
  const { id: clientId, llcId } = await params;
  const client = await getClient(clientId);
  const llc = await getLLC(llcId);
  if (!client || !llc || llc.clientId !== clientId) notFound();

  const existingFilings = await getTaxFilingsByLLC(llcId);
  const existingYears = new Set(existingFilings.map((f) => f.taxYear));
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 1 - i);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/client/${clientId}`}
          className="btn btn-ghost -ml-2 px-2 py-1"
        >
          ← {client.fullName}
        </Link>
        <h1 className="page-title">Nova declaração — {llc.name}</h1>
      </div>
      <div className="card">
        <div className="card-body">
          <NewFilingForm
            clientId={clientId}
            llcId={llcId}
            existingYears={Array.from(existingYears)}
            yearOptions={yearOptions}
          />
        </div>
      </div>
    </div>
  );
}

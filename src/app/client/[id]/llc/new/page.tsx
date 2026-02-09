import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/app/actions/clients";
import { createLLC } from "@/app/actions/llcs";
import { LLCForm } from "./LLCForm";

export default async function NewLLCPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;
  const client = await getClient(clientId);
  if (!client) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/client/${clientId}`}
          className="btn btn-ghost -ml-2 px-2 py-1"
        >
          ← {client.fullName}
        </Link>
        <h1 className="page-title">Nova LLC</h1>
      </div>
      <div className="card">
        <div className="card-body">
          <LLCForm clientId={clientId} action={createLLC} />
        </div>
      </div>
    </div>
  );
}

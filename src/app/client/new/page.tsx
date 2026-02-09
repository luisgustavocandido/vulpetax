import Link from "next/link";
import { createClient } from "@/app/actions/clients";
import { ClientForm } from "./ClientForm";

export default function NewClientPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/"
          className="btn btn-ghost -ml-2 px-2 py-1"
        >
          ← Voltar
        </Link>
        <h1 className="page-title">Novo cliente</h1>
      </div>
      <div className="card">
        <div className="card-body">
          <ClientForm action={createClient} />
        </div>
      </div>
    </div>
  );
}

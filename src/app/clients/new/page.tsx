import { ClientForm } from "@/components/ClientForm";

export default function NewClientPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Novo cliente</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <ClientForm />
      </div>
    </div>
  );
}

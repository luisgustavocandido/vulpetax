import Link from "next/link";
import { PersonGroupForm } from "../components/PersonGroupForm";

export default function NewClientePage() {
  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Link href="/clientes" className="text-sm text-blue-600 hover:underline">
            ← Clientes
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Cadastrar cliente (pessoa)</h1>
        <p className="text-sm text-gray-600">
          Preencha os dados pessoais. O vínculo com empresa pode ser feito em outro fluxo.
        </p>
      </div>
      <PersonGroupForm />
    </div>
  );
}

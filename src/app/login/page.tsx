import { getUsers } from "@/app/actions/users";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const users = await getUsers();

  return (
    <div className="flex min-h-[60vh] items-start justify-center pt-6">
      <div className="card w-full max-w-sm">
        <div className="card-body">
          <h1 className="text-xl font-semibold text-neutral-900">
            VulpeTax — Controle interno
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Selecione seu usuário para registrar ações no audit log.
          </p>
          <div className="mt-5">
            {users.length === 0 ? (
              <p className="text-sm text-amber-700">
                Nenhum usuário cadastrado. Rode{" "}
                <code className="rounded bg-neutral-100 px-1">POST /seed</code>{" "}
                para criar um admin.
              </p>
            ) : (
              <LoginForm users={users} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

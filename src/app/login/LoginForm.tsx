"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSessionUser } from "./actions";

type User = { id: string; email: string; name: string; role: string };

export function LoginForm({ users }: { users: User[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const userId = formData.get("userId") as string;
    if (!userId) return;
    startTransition(async () => {
      await setSessionUser(userId);
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <div>
        <label className="label">Usuário</label>
        <select
          name="userId"
          required
          className="select"
        >
          <option value="">Selecione</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email}) — {u.role}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary w-full"
      >
        {isPending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClient } from "@/app/actions/clients";

type Props = {
  clientId: string;
  clientName: string;
};

export function ClientDeleteButton({ clientId, clientName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Excluir o cliente "${clientName}"? Todas as LLCs e declarações serão removidas.`))
      return;
    startTransition(async () => {
      await deleteClient(clientId);
      router.replace("/");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "Excluindo…" : "Excluir"}
    </button>
  );
}

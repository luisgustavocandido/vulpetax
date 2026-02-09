"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLLC } from "@/app/actions/llcs";

type Props = {
  llcId: string;
  llcName: string;
};

export function LLCDeleteButton({ llcId, llcName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Excluir a LLC "${llcName}"? Todas as declarações fiscais desta LLC serão removidas.`
      )
    )
      return;
    startTransition(async () => {
      await deleteLLC(llcId);
      router.refresh();
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

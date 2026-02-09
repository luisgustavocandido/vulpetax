"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaxFilingStatus } from "@/app/actions/tax-filings";

type Props = {
  filingId: string;
  currentStatus: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  ready_to_file: "Pronto para enviar",
  filed: "Enviado",
  extension: "Extensão",
};

export function StatusSelect({ filingId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value as "draft" | "ready_to_file" | "filed" | "extension";
    startTransition(async () => {
      await updateTaxFilingStatus(filingId, status);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-neutral-700">Status:</label>
      <select
        value={currentStatus}
        onChange={change}
        disabled={isPending}
        className="select-sm disabled:opacity-50"
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

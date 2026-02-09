"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptDeclaration } from "@/app/actions/tax-filings";
import type { TaxFiling } from "@/db";

type Props = {
  filingId: string;
  filing: TaxFiling;
};

export function DeclarationAccept({ filingId, filing }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const accepted = filing.declarationAcceptedAt != null;

  function handleAccept() {
    startTransition(async () => {
      await acceptDeclaration(filingId);
      router.refresh();
    });
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="mb-2 section-title">Declaração final</h2>
      {accepted ? (
        <p className="text-sm text-green-700">
          ✓ Declaração aceita em{" "}
          {filing.declarationAcceptedAt
            ? new Date(filing.declarationAcceptedAt).toLocaleString("pt-BR")
            : "—"}
          .
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-600">
            Declaro que li e compreendi o formulário e que as informações fornecidas são verdadeiras e completas.
          </p>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isPending}
            className="btn btn-primary"
          >
            {isPending ? "…" : "Aceitar declaração"}
          </button>
        </>
      )}
      </div>
    </div>
  );
}

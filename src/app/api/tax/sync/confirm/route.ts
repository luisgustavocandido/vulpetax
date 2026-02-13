import { NextRequest, NextResponse } from "next/server";
import {
  fetchTaxFormRows,
  applyTaxFormSync,
  updateSyncState,
} from "@/lib/sync/runTaxFormSync";
import {
  tryAdvisoryLock,
  releaseAdvisoryLock,
} from "@/lib/advisoryLock";
import { logSecurityEvent } from "@/lib/logger";
import { sanitizeErrorMessage } from "@/lib/sanitizeError";

function getIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? null;
}

/** POST /api/tax/sync/confirm — grava sincronização. Protegido por passcode (middleware). */
export async function POST(request: NextRequest) {
  const ip = getIp(request);

  const acquired = await tryAdvisoryLock("taxForm");
  if (!acquired) {
    return NextResponse.json(
      { error: "Uma sincronização já está em execução. Aguarde a conclusão." },
      { status: 409 }
    );
  }

  logSecurityEvent("sync_manual_attempt", { type: "tax_form", ip });

  try {
    const { rows } = await fetchTaxFormRows();
    const result = await applyTaxFormSync(rows);

    return NextResponse.json({
      rowsTotal: result.rowsTotal,
      rowsImported: result.rowsImported,
      rowsErrors: result.rowsErrors,
      profileUsed: "google_sheets_tax_form",
      importHistoryId: result.importHistoryId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSyncState("error", msg);
    logSecurityEvent("sync_failed", { type: "tax_form", error: msg.slice(0, 200), ip });
    return NextResponse.json(
      { error: "Erro ao sincronizar: " + sanitizeErrorMessage(err) },
      { status: 500 }
    );
  } finally {
    await releaseAdvisoryLock("taxForm");
  }
}

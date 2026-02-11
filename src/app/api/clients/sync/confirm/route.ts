import { NextRequest, NextResponse } from "next/server";
import {
  fetchPosVendaRows,
  applyPosVendaSync,
  updateSyncState,
} from "@/lib/sync/runPosVendaSync";
import {
  clientsSyncConfirmRateLimitCheck,
  clientsSyncConfirmRateLimitConsume,
} from "@/lib/syncRateLimit";
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

/** POST /api/clients/sync/confirm — grava sincronização. Protegido por passcode (middleware). */
export async function POST(request: NextRequest) {
  const ip = getIp(request);

  if (!clientsSyncConfirmRateLimitCheck(ip)) {
    return NextResponse.json(
      { error: "Aguarde 60 segundos antes de confirmar outra sincronização." },
      { status: 429 }
    );
  }

  const acquired = await tryAdvisoryLock("posvenda");
  if (!acquired) {
    return NextResponse.json(
      { error: "Uma sincronização já está em execução. Aguarde a conclusão." },
      { status: 409 }
    );
  }

  clientsSyncConfirmRateLimitConsume(ip);
  logSecurityEvent("sync_manual_attempt", { type: "posvenda", ip });

  try {
    const { rows } = await fetchPosVendaRows();
    const result = await applyPosVendaSync(rows);

    return NextResponse.json({
      rowsTotal: result.rowsTotal,
      rowsImported: result.rowsImported,
      rowsErrors: result.rowsErrors,
      profileUsed: "google_sheets_posvenda_llc",
      importHistoryId: result.importHistoryId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSyncState("error", msg);
    logSecurityEvent("sync_failed", { type: "posvenda", error: msg.slice(0, 200), ip });
    return NextResponse.json(
      { error: "Erro ao sincronizar: " + sanitizeErrorMessage(err) },
      { status: 500 }
    );
  } finally {
    await releaseAdvisoryLock("posvenda");
  }
}

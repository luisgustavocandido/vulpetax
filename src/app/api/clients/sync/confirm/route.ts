import { NextRequest, NextResponse } from "next/server";
import {
  fetchPosVendaRows,
  applyPosVendaSync,
  updateSyncState,
} from "@/lib/sync/runPosVendaSync";
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
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos para sincronizações grandes

export async function POST(request: NextRequest) {
  const ip = getIp(request);

  const acquired = await tryAdvisoryLock("posvenda");
  if (!acquired) {
    return NextResponse.json(
      { error: "Uma sincronização já está em execução. Aguarde a conclusão." },
      { status: 409 }
    );
  }

  logSecurityEvent("sync_manual_attempt", { type: "posvenda", ip });

  try {
    console.log(`[sync/confirm] Iniciando sincronização - IP: ${ip}`);
    const startTime = Date.now();
    
    const { rows } = await fetchPosVendaRows();
    console.log(`[sync/confirm] Linhas obtidas: ${rows.length} (${Date.now() - startTime}ms)`);
    
    const result = await applyPosVendaSync(rows);
    const totalTime = Date.now() - startTime;
    console.log(`[sync/confirm] Sincronização concluída em ${totalTime}ms - Importadas: ${result.rowsImported}, Erros: ${result.rowsErrors}`);

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

import { NextRequest, NextResponse } from "next/server";
import { fetchTaxFormRows, buildTaxFormPreview } from "@/lib/sync/runTaxFormSync";
import {
  taxSyncPreviewRateLimitCheck,
  taxSyncPreviewRateLimitConsume,
} from "@/lib/syncRateLimit";

function getIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? null;
}

/** POST /api/tax/sync/preview — pré-visualização sem gravar. Protegido por passcode (middleware). */
export async function POST(request: NextRequest) {
  const ip = getIp(request);

  if (!taxSyncPreviewRateLimitCheck(ip)) {
    return NextResponse.json(
      { error: "Aguarde 60 segundos antes de solicitar outro preview." },
      { status: 429 }
    );
  }

  taxSyncPreviewRateLimitConsume(ip);

  try {
    const { rows } = await fetchTaxFormRows();
    const preview = await buildTaxFormPreview(rows);

    return NextResponse.json({
      fetchedRows: preview.fetchedRows,
      validRows: preview.validRows,
      invalidRows: preview.invalidRows,
      wouldCreate: preview.wouldCreate,
      wouldUpdate: preview.wouldUpdate,
      wouldSkip: preview.wouldSkip,
      errors: preview.errors,
      sample: preview.sample,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao obter prévia da planilha.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

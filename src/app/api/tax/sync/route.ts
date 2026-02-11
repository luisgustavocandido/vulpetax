import { NextRequest, NextResponse } from "next/server";
import { runTaxFormSync } from "@/lib/sync/runTaxFormSync";
import { syncRateLimitCheck, syncRateLimitConsume } from "@/lib/syncRateLimit";

function getIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? null;
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);

  if (!syncRateLimitCheck(ip)) {
    return NextResponse.json(
      { error: "Aguarde 60 segundos antes de sincronizar novamente." },
      { status: 429 }
    );
  }

  syncRateLimitConsume(ip);

  try {
    const result = await runTaxFormSync({ dryRun: false });

    if (result.status === "error") {
      return NextResponse.json(
        {
          error: result.error ?? "Erro ao sincronizar",
          rowsTotal: result.rowsTotal,
          rowsImported: result.rowsImported,
          rowsErrors: result.rowsErrors,
          errors: result.errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rowsTotal: result.rowsTotal,
      rowsImported: result.rowsImported,
      rowsErrors: result.rowsErrors,
      status: "ok",
      errors: result.errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar com o Google Sheets.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

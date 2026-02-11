import { NextRequest, NextResponse } from "next/server";
import { runTaxFormSync } from "@/lib/sync/runTaxFormSync";
import {
  tryAdvisoryLock,
  releaseAdvisoryLock,
} from "@/lib/advisoryLock";
import { getCronSecret } from "@/lib/cronAuth";

export async function POST(request: NextRequest) {
  if (!getCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const acquired = await tryAdvisoryLock("taxForm");
  if (!acquired) {
    return NextResponse.json(
      { error: "sync_already_running" },
      { status: 409 }
    );
  }

  try {
    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const result = await runTaxFormSync({ dryRun });

    if (result.status === "error") {
      return NextResponse.json(
        {
          rowsTotal: result.rowsTotal,
          rowsImported: result.rowsImported,
          rowsErrors: result.rowsErrors,
          status: "error",
          error: result.error,
          errors: result.errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rowsTotal: result.rowsTotal,
      rowsImported: result.rowsImported,
      rowsErrors: result.rowsErrors,
      status: result.status,
      errors: result.errors,
      ...(dryRun && { dryRun: true }),
    });
  } finally {
    await releaseAdvisoryLock("taxForm");
  }
}

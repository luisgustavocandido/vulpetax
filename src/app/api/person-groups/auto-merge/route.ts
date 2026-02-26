import { NextRequest, NextResponse } from "next/server";
import { getAllPersonGroupProfiles } from "@/lib/personGroups/repo";
import {
  buildProfiles,
  buildClusters,
  runAutoMerge,
} from "@/lib/personGroups/autoMerge";
import { autoMergeBodySchema } from "@/lib/personGroups/schemas";

/**
 * POST /api/person-groups/auto-merge
 * Body: minScore (default 0.9), maxMerges (default 200), dryRun (default true).
 * dryRun=true: não altera DB, retorna plano. dryRun=false: executa merges de alta confiança (name_only nunca é executado).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido (JSON esperado)" },
      { status: 400 }
    );
  }

  const parsed = autoMergeBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Payload inválido";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { minScore, maxMerges, dryRun } = parsed.data;

  try {
    const rows = await getAllPersonGroupProfiles();
    const profiles = buildProfiles(rows);
    const clusters = buildClusters(profiles);

    const result = await runAutoMerge(clusters, {
      minScore,
      maxMerges,
      dryRun,
    });

    if (!dryRun && result.mergesPlannedOrExecuted > 0) {
      console.log(
        "[person-groups/auto-merge] Executed",
        result.mergesPlannedOrExecuted,
        "merges, moved",
        result.movedCompaniesTotal,
        "companies. Merges:",
        result.merges.map((m) => ({
          target: m.targetPersonGroupId.slice(0, 8),
          sources: m.sourcePersonGroupIds.length,
          reason: m.reason,
        }))
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/person-groups/auto-merge]", err);
    return NextResponse.json(
      { error: "Erro ao executar auto-merge" },
      { status: 500 }
    );
  }
}

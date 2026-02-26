import { NextRequest, NextResponse } from "next/server";
import { mergePersonGroupsBodySchema } from "@/lib/personGroups/schemas";
import {
  ensurePersonGroupExists,
  mergePersonGroups,
} from "@/lib/personGroups/repo";

/**
 * POST /api/person-groups/merge
 * Mescla grupos de pessoa: move empresas dos sourcePersonGroupIds para targetPersonGroupId.
 * Requer autenticação (middleware). Body validado com Zod.
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

  const parsed = mergePersonGroupsBodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten();
    const message =
      first.formErrors[0] ||
      (first.fieldErrors.targetPersonGroupId?.[0]) ||
      (first.fieldErrors.sourcePersonGroupIds?.[0]) ||
      "Payload inválido";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { targetPersonGroupId, sourcePersonGroupIds } = parsed.data;

  if (sourcePersonGroupIds.includes(targetPersonGroupId)) {
    return NextResponse.json(
      { error: "O grupo destino não pode estar na lista de origens" },
      { status: 409 }
    );
  }

  const targetExists = await ensurePersonGroupExists(targetPersonGroupId);
  if (!targetExists) {
    return NextResponse.json(
      { error: "Grupo destino não encontrado" },
      { status: 404 }
    );
  }

  for (const sourceId of sourcePersonGroupIds) {
    const exists = await ensurePersonGroupExists(sourceId);
    if (!exists) {
      return NextResponse.json(
        { error: `Grupo de origem não encontrado: ${sourceId.slice(0, 8)}...` },
        { status: 404 }
      );
    }
  }

  const { movedCompanies } = await mergePersonGroups({
    targetPersonGroupId,
    sourcePersonGroupIds,
  });

  return NextResponse.json({
    ok: true,
    movedCompanies,
    targetPersonGroupId,
  });
}

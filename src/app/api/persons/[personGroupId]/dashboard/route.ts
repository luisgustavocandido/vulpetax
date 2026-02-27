import { NextRequest, NextResponse } from "next/server";
import {
  getPersonDashboard,
  personGroupExists,
  getEmptyPersonDashboardPayload,
} from "@/lib/persons/repo";
import { personGroupIdParamSchema } from "@/lib/persons/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personGroupId: string }> }
) {
  const parsed = personGroupIdParamSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "personGroupId inválido" },
      { status: 400 }
    );
  }

  const personGroupId = parsed.data.personGroupId;
  let payload = await getPersonDashboard(personGroupId);

  if (!payload) {
    const exists = await personGroupExists(personGroupId);
    if (exists) {
      payload = getEmptyPersonDashboardPayload(personGroupId);
    } else {
      return NextResponse.json(
        { error: "Grupo da pessoa não encontrado ou sem empresas" },
        { status: 404 }
      );
    }
  }

  return NextResponse.json(payload);
}

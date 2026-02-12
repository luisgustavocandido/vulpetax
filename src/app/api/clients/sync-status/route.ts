import { NextResponse } from "next/server";
import { db } from "@/db";
import { syncState } from "@/db/schema";
import { eq } from "drizzle-orm";

const SYNC_KEY = "posvenda_llc";

export const dynamic = 'force-dynamic';

export async function GET() {
  const [row] = await db
    .select({
      lastSyncedAt: syncState.lastSyncedAt,
      lastRunStatus: syncState.lastRunStatus,
      lastRunError: syncState.lastRunError,
    })
    .from(syncState)
    .where(eq(syncState.key, SYNC_KEY))
    .limit(1);

  return NextResponse.json({
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
    lastRunStatus: row?.lastRunStatus ?? null,
    lastRunError: row?.lastRunError ?? null,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getAllPersonGroupProfiles } from "@/lib/personGroups/repo";
import {
  buildProfiles,
  buildClusters,
  getMergeCandidateStats,
  type ClusterReason,
} from "@/lib/personGroups/autoMerge";

export type MergeCandidateProfile = {
  personGroupId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  companiesCount: number;
};

export type MergeCandidatesResponse = {
  clusters: Array<{
    score: number;
    reason: ClusterReason;
    targetPersonGroupId: string;
    sourcePersonGroupIds: string[];
    profiles: MergeCandidateProfile[];
  }>;
  stats: {
    totalGroups: number;
    candidates: number;
    autoExecutable: number;
    needsReview: number;
  };
};

/**
 * GET /api/person-groups/merge-candidates
 * Query: mode=preview|auto (ignorado no MVP), minScore (default 0.85), limit (default 100), reason (opcional: filtrar por reason).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minScore = Math.max(0, Math.min(1, Number(searchParams.get("minScore")) || 0.85));
    const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 100));
    const reasonFilter = searchParams.get("reason")?.trim() || null;

    const rows = await getAllPersonGroupProfiles();
    const profiles = buildProfiles(rows);
    const allClusters = buildClusters(profiles);

    let clusters = allClusters.filter((c) => c.score >= minScore);
    if (reasonFilter) {
      clusters = clusters.filter((c) => c.reason === reasonFilter);
    }
    clusters = clusters.slice(0, limit);

    const stats = getMergeCandidateStats(allClusters, minScore);
    stats.totalGroups = profiles.length;

    return NextResponse.json({
      clusters,
      stats,
    } satisfies MergeCandidatesResponse);
  } catch (err) {
    console.error("[GET /api/person-groups/merge-candidates]", err);
    return NextResponse.json(
      { error: "Erro ao buscar candidatos de merge" },
      { status: 500 }
    );
  }
}

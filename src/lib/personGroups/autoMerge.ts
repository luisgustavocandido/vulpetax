import type { PersonGroupProfileRow } from "./repo";
import { mergePersonGroups } from "./repo";

export type PersonGroupProfile = {
  personGroupId: string;
  displayNameNorm: string | null;
  emailNorm: string | null;
  phoneNorm: string | null;
  companiesCount: number;
  updatedAtMax: Date;
  /** Valores originais para exibição */
  displayName: string | null;
  email: string | null;
  phone: string | null;
};

function normalizeName(s: string | null | undefined): string | null {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeEmail(s: string | null | undefined): string | null {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  return t || null;
}

function normalizePhone(s: string | null | undefined): string | null {
  if (s == null || typeof s !== "string") return null;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export function buildProfiles(rows: PersonGroupProfileRow[]): PersonGroupProfile[] {
  return rows.map((r) => ({
    personGroupId: r.personGroupId,
    displayNameNorm: normalizeName(r.displayName),
    emailNorm: normalizeEmail(r.email),
    phoneNorm: normalizePhone(r.phone),
    companiesCount: r.companiesCount,
    updatedAtMax: r.updatedAtMax instanceof Date ? r.updatedAtMax : new Date(r.updatedAtMax),
    displayName: r.displayName ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
  }));
}

export type ClusterReason =
  | "email"
  | "phone"
  | "email+phone"
  | "name+phone"
  | "name_only";

export type MergeCluster = {
  score: number;
  reason: ClusterReason;
  targetPersonGroupId: string;
  sourcePersonGroupIds: string[];
  profiles: Array<{
    personGroupId: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    companiesCount: number;
  }>;
};

function scoreForReason(reason: ClusterReason): number {
  switch (reason) {
    case "email+phone":
    case "email":
      return 1.0;
    case "phone":
      return 0.98;
    case "name+phone":
      return 0.92;
    case "name_only":
      return 0.6;
    default:
      return 0.6;
  }
}

/**
 * Escolhe o grupo destino: maior companiesCount, depois maior updatedAtMax, depois menor UUID.
 */
export function pickTarget(profiles: PersonGroupProfile[]): PersonGroupProfile {
  const sorted = [...profiles].sort((a, b) => {
    if (b.companiesCount !== a.companiesCount) return b.companiesCount - a.companiesCount;
    const tA = a.updatedAtMax.getTime();
    const tB = b.updatedAtMax.getTime();
    if (tB !== tA) return tB - tA;
    return a.personGroupId.localeCompare(b.personGroupId);
  });
  return sorted[0];
}

/**
 * Agrupa perfis em clusters por chaves de união (email+phone, email, phone, name+phone, name_only).
 * Cada perfil entra no primeiro cluster que se aplicar; clusters têm pelo menos 2 perfis.
 */
export function buildClusters(profiles: PersonGroupProfile[]): MergeCluster[] {
  const assigned = new Set<string>();
  const clusters: MergeCluster[] = [];

  function takeUnassigned(): PersonGroupProfile[] {
    return profiles.filter((p) => !assigned.has(p.personGroupId));
  }

  function addCluster(
    group: PersonGroupProfile[],
    reason: ClusterReason
  ): void {
    if (group.length < 2) return;
    group.forEach((p) => assigned.add(p.personGroupId));
    const target = pickTarget(group);
    const sourceIds = group
      .filter((p) => p.personGroupId !== target.personGroupId)
      .map((p) => p.personGroupId);
    clusters.push({
      score: scoreForReason(reason),
      reason,
      targetPersonGroupId: target.personGroupId,
      sourcePersonGroupIds: sourceIds,
      profiles: group.map((p) => ({
        personGroupId: p.personGroupId,
        name: p.displayName,
        email: p.email,
        phone: p.phone,
        companiesCount: p.companiesCount,
      })),
    });
  }

  const remaining = () => takeUnassigned();

  // 1) email+phone (ambos presentes)
  const byEmailPhone = new Map<string, PersonGroupProfile[]>();
  for (const p of remaining()) {
    if (p.emailNorm && p.phoneNorm) {
      const key = `ep:${p.emailNorm}|${p.phoneNorm}`;
      const list = byEmailPhone.get(key) ?? [];
      list.push(p);
      byEmailPhone.set(key, list);
    }
  }
  byEmailPhone.forEach((group) => addCluster(group, "email+phone"));

  // 2) email
  const byEmail = new Map<string, PersonGroupProfile[]>();
  for (const p of remaining()) {
    if (p.emailNorm) {
      const key = `e:${p.emailNorm}`;
      const list = byEmail.get(key) ?? [];
      list.push(p);
      byEmail.set(key, list);
    }
  }
  byEmail.forEach((group) => addCluster(group, "email"));

  // 3) phone
  const byPhone = new Map<string, PersonGroupProfile[]>();
  for (const p of remaining()) {
    if (p.phoneNorm) {
      const key = `p:${p.phoneNorm}`;
      const list = byPhone.get(key) ?? [];
      list.push(p);
      byPhone.set(key, list);
    }
  }
  byPhone.forEach((group) => addCluster(group, "phone"));

  // 4) name+phone
  const byNamePhone = new Map<string, PersonGroupProfile[]>();
  for (const p of remaining()) {
    if (p.displayNameNorm && p.phoneNorm) {
      const key = `np:${p.displayNameNorm}|${p.phoneNorm}`;
      const list = byNamePhone.get(key) ?? [];
      list.push(p);
      byNamePhone.set(key, list);
    }
  }
  byNamePhone.forEach((group) => addCluster(group, "name+phone"));

  // 5) name_only
  const byName = new Map<string, PersonGroupProfile[]>();
  for (const p of remaining()) {
    if (p.displayNameNorm) {
      const key = `n:${p.displayNameNorm}`;
      const list = byName.get(key) ?? [];
      list.push(p);
      byName.set(key, list);
    }
  }
  byName.forEach((group) => addCluster(group, "name_only"));

  return clusters;
}

const AUTO_EXECUTABLE_REASONS: ClusterReason[] = [
  "email",
  "phone",
  "email+phone",
  "name+phone",
];

export function isAutoExecutable(reason: ClusterReason): boolean {
  return AUTO_EXECUTABLE_REASONS.includes(reason);
}

export type MergeCandidateStats = {
  totalGroups: number;
  candidates: number;
  autoExecutable: number;
  needsReview: number;
};

export function getMergeCandidateStats(
  clusters: MergeCluster[],
  minScore: number
): MergeCandidateStats {
  const above = clusters.filter((c) => c.score >= minScore);
  const auto = above.filter((c) => isAutoExecutable(c.reason));
  const review = above.filter((c) => c.reason === "name_only");
  return {
    totalGroups: 0, // preenchido pelo chamador com total de perfis
    candidates: above.length,
    autoExecutable: auto.length,
    needsReview: review.length,
  };
}

export type AutoMergeResultItem = {
  targetPersonGroupId: string;
  sourcePersonGroupIds: string[];
  movedCompanies: number;
  reason: string;
  score: number;
};

export type AutoMergeResult = {
  dryRun: boolean;
  mergesPlannedOrExecuted: number;
  movedCompaniesTotal: number;
  merges: AutoMergeResultItem[];
};

/**
 * Executa (ou simula) os merges para clusters que passam no minScore e não são name_only quando executando.
 */
export async function runAutoMerge(
  clusters: MergeCluster[],
  options: {
    minScore: number;
    maxMerges: number;
    dryRun: boolean;
  }
): Promise<AutoMergeResult> {
  const toRun = clusters
    .filter((c) => c.score >= options.minScore)
    .filter((c) => options.dryRun || isAutoExecutable(c.reason))
    .slice(0, options.maxMerges);

  const merges: AutoMergeResultItem[] = [];
  let movedCompaniesTotal = 0;

  if (options.dryRun) {
    for (const c of toRun) {
      const movedCompanies = c.profiles
        .filter((p) => p.personGroupId !== c.targetPersonGroupId)
        .reduce((sum, p) => sum + p.companiesCount, 0);
      merges.push({
        targetPersonGroupId: c.targetPersonGroupId,
        sourcePersonGroupIds: c.sourcePersonGroupIds,
        movedCompanies,
        reason: c.reason,
        score: c.score,
      });
      movedCompaniesTotal += movedCompanies;
    }
    return {
      dryRun: true,
      mergesPlannedOrExecuted: merges.length,
      movedCompaniesTotal,
      merges,
    };
  }

  for (const c of toRun) {
    const { movedCompanies } = await mergePersonGroups({
      targetPersonGroupId: c.targetPersonGroupId,
      sourcePersonGroupIds: c.sourcePersonGroupIds,
    });
    merges.push({
      targetPersonGroupId: c.targetPersonGroupId,
      sourcePersonGroupIds: c.sourcePersonGroupIds,
      movedCompanies,
      reason: c.reason,
      score: c.score,
    });
    movedCompaniesTotal += movedCompanies;
  }

  return {
    dryRun: false,
    mergesPlannedOrExecuted: merges.length,
    movedCompaniesTotal,
    merges,
  };
}

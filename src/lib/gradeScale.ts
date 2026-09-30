import { db } from "./supabase";

export interface GradeScaleRow {
  id?: string;
  tenant_id?: string;
  grade: string;
  points: number | null;
  rank: number | null;
  min_mark: number | null;
  max_mark: number | null;
  achievement_label: string | null;
  is_pass: boolean;
  counts_in_cgpa: boolean;
  counts_as_completed: boolean;
  effective_from?: string;
  effective_to?: string | null;
}

// In-memory cache for the user's session (one fetch per page load, no polling)
let cachedScale: GradeScaleRow[] | null = null;
let fetchPromise: Promise<GradeScaleRow[]> | null = null;

/**
 * Fetches the grading scale from grade_scales table for the logged-in user's tenant.
 * RLS enforces tenant boundary (my_tenant_id()).
 * Cached in-memory for the session (no background polling).
 */
export async function fetchGradeScale(): Promise<GradeScaleRow[]> {
  if (cachedScale !== null) {
    return cachedScale;
  }
  if (fetchPromise !== null) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const { data, error } = await db
        .from("grade_scales")
        .select("*")
        .order("rank", { ascending: true, nullsFirst: false });

      if (error) {
        console.warn("[gradeScale] fetchGradeScale query warning:", error.message);
        return [];
      }

      if (data && Array.isArray(data)) {
        // Sort by rank ascending (null ranks at end), then alphabetical
        const sorted = [...data].sort((a, b) => {
          const rankA = a.rank ?? 9999;
          const rankB = b.rank ?? 9999;
          if (rankA !== rankB) return rankA - rankB;
          return String(a.grade || "").localeCompare(String(b.grade || ""));
        });
        cachedScale = sorted;
        return sorted;
      }
      return [];
    } catch (err) {
      console.error("[gradeScale] Failed to fetch grade scale:", err);
      return [];
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Clears the session memory cache (e.g. upon user logout).
 */
export function clearGradeScaleCache(): void {
  cachedScale = null;
  fetchPromise = null;
}

/**
 * Finds the definition for a given grade string from the provided scale or session cache.
 */
export function findGradeDefinition(
  grade: string,
  scale?: GradeScaleRow[] | null
): GradeScaleRow | undefined {
  if (!grade) return undefined;
  const cleanGrade = String(grade).trim().toUpperCase();
  const targetScale = scale ?? cachedScale ?? [];
  return targetScale.find(
    (row) => String(row.grade).trim().toUpperCase() === cleanGrade
  );
}

/**
 * Returns the numerical grade points for a grade.
 * Returns null if the grade is unknown or non-graded (e.g. EX, HL).
 * NEVER defaults to 0.00 for unknown grades.
 */
export function points(grade: string, scale?: GradeScaleRow[] | null): number | null {
  const defn = findGradeDefinition(grade, scale);
  if (!defn) {
    return null; // Unknown grade: never default to 0
  }
  return defn.points !== null && defn.points !== undefined ? Number(defn.points) : null;
}

/**
 * Checks if a grade is passing according to the tenant's scale.
 * Unknown grades return false. NEVER defaults to a pass.
 */
export function isPass(grade: string, scale?: GradeScaleRow[] | null): boolean {
  const defn = findGradeDefinition(grade, scale);
  if (!defn) {
    return false; // Unknown grade: never default to pass
  }
  return Boolean(defn.is_pass);
}

/**
 * Checks if a grade counts toward CGPA calculations.
 * Non-graded passes (EX, CT, HL) and withdrawals return false.
 * Unknown grades return false.
 */
export function countsInCgpa(grade: string, scale?: GradeScaleRow[] | null): boolean {
  const defn = findGradeDefinition(grade, scale);
  if (!defn) {
    return false;
  }
  return Boolean(defn.counts_in_cgpa);
}

/**
 * Checks if a grade counts toward total completed credits (e.g. passes, EX, CT, HL).
 * Unknown grades return false.
 */
export function countsAsCompleted(
  grade: string,
  scale?: GradeScaleRow[] | null
): boolean {
  const defn = findGradeDefinition(grade, scale);
  if (!defn) {
    return false;
  }
  return Boolean(defn.counts_as_completed);
}

/**
 * Returns human-readable label for a grade.
 * An unknown grade returns "Unknown grade X".
 */
export function label(grade: string, scale?: GradeScaleRow[] | null): string {
  if (!grade || String(grade).trim() === "") {
    return "Unknown grade (blank)";
  }
  const cleanGrade = String(grade).trim().toUpperCase();
  const defn = findGradeDefinition(cleanGrade, scale);
  if (!defn) {
    return `Unknown grade ${cleanGrade}`;
  }
  return defn.achievement_label || defn.grade;
}

/**
 * Formats a grade with its mark range and achievement label for display.
 * e.g., "A (4.00 | 80–89% - Excellent Pass)" or "EX (Exempted)"
 * Unknown grades return "Unknown grade X".
 */
export function formatGradeOption(
  defn: GradeScaleRow
): string {
  const parts: string[] = [defn.grade];
  const details: string[] = [];

  if (defn.points !== null && defn.points !== undefined) {
    details.push(Number(defn.points).toFixed(2));
  } else if (!defn.counts_in_cgpa && defn.is_pass) {
    details.push("Neutral");
  }

  if (defn.min_mark !== null && defn.max_mark !== null && defn.min_mark !== undefined && defn.max_mark !== undefined) {
    details.push(`${defn.min_mark}–${defn.max_mark}%`);
  }

  if (defn.achievement_label) {
    details.push(defn.achievement_label);
  }

  if (details.length > 0) {
    return `${defn.grade} (${details.join(" | ")})`;
  }
  return defn.grade;
}

/**
 * Returns list of grade definitions ordered by rank for select dropdowns.
 */
export function gradesForDropdown(
  scale?: GradeScaleRow[] | null
): GradeScaleRow[] {
  const targetScale = scale ?? cachedScale ?? [];
  return [...targetScale].sort((a, b) => {
    const rankA = a.rank ?? 9999;
    const rankB = b.rank ?? 9999;
    if (rankA !== rankB) return rankA - rankB;
    return String(a.grade || "").localeCompare(String(b.grade || ""));
  });
}

/**
 * Helper to get status presentation for UI course tables.
 * Returns { isUnknown, isPass, isNeutral, badgeText }
 */
export function evaluateGradeStatus(
  grade: string,
  rawStatus?: string,
  scale?: GradeScaleRow[] | null
): {
  isUnknown: boolean;
  isPass: boolean;
  isNeutral: boolean;
  badgeText: string;
} {
  const cleanGrade = String(grade || "").trim().toUpperCase();
  const defn = findGradeDefinition(cleanGrade, scale);

  if (!defn) {
    return {
      isUnknown: true,
      isPass: false,
      isNeutral: false,
      badgeText: `Unknown grade ${cleanGrade || "N/A"}`,
    };
  }

  const pass = Boolean(defn.is_pass);
  const neutral = pass && !defn.counts_in_cgpa;

  let badgeText = "PASSED";
  if (!pass) {
    badgeText = "FAILED";
  } else if (neutral) {
    badgeText = defn.achievement_label ? `PASSED (${cleanGrade})` : `EXEMPT (${cleanGrade})`;
  } else if (rawStatus && rawStatus.toUpperCase().includes("PASS")) {
    badgeText = "PASSED";
  }

  return {
    isUnknown: false,
    isPass: pass,
    isNeutral: neutral,
    badgeText,
  };
}

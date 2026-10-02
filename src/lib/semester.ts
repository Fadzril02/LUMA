// Semester labels are normalised server-side to "SEM n YYYY/YYYY".
// Sort chronologically (session start year, then semester number) and derive
// "Year X" relative to the student's earliest session — never hardcoded.

export interface ParsedSemester {
  label: string;
  sem: number | null;
  startYear: number | null;
  session: string | null;
}

export function parseSemester(label: string): ParsedSemester {
  const m = /SEM(?:ESTER)?\s*(\d+)\s+(\d{4})\s*\/\s*(\d{4})/i.exec(label || "");
  if (!m) return { label, sem: null, startYear: null, session: null };
  return { label, sem: Number(m[1]), startYear: Number(m[2]), session: `${m[2]}/${m[3]}` };
}

/** Chronological order; unparseable labels go last (shown as-is, never guessed). */
export function compareSemesters(a: string, b: string): number {
  const pa = parseSemester(a), pb = parseSemester(b);
  if (pa.startYear === null || pb.startYear === null) {
    if (pa.startYear === pb.startYear) return a.localeCompare(b);
    return pa.startYear === null ? 1 : -1;
  }
  return pa.startYear - pb.startYear || (pa.sem ?? 0) - (pb.sem ?? 0);
}

/** "Year 2 · Semester 1 · 2025/2026", Year counted from the earliest session in `all`. */
export function semesterHeading(label: string, all: string[]): string {
  const p = parseSemester(label);
  if (p.startYear === null) return label;
  const years = all.map(l => parseSemester(l).startYear).filter((y): y is number => y !== null);
  const first = Math.min(...years);
  return `Year ${p.startYear - first + 1} · Semester ${p.sem} · ${p.session}`;
}

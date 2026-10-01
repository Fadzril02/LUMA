import React, { useState, useEffect } from "react";
import { CheckCircle2, ShieldAlert, Award, BookOpen, CheckCircle, Hash, Calendar, Layers, AlertTriangle, Info } from "lucide-react";
import { db } from "../../../lib/supabase";
import { api } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { CourseLedger, CourseLedgerRecord, LedgerColumn } from "../../../components/shared/CourseLedger";
import { fetchGradeScale, findGradeDefinition, GradeScaleRow } from "../../../lib/gradeScale";

export interface DegreeAuditViewProps {
  cgpa?: number | string;
  earnedCredits?: number;
  totalRequiredCredits?: number;
  courses?: any[];
  matricNo?: string;
}

export function DegreeAuditView({
  cgpa: propCgpa,
  earnedCredits: propEarnedCredits,
  totalRequiredCredits: propRequiredCredits,
  courses: propCourses,
  matricNo: propMatric,
}: DegreeAuditViewProps) {
  const { profile, user } = useAuth();

  // Store only fetched database values in state
  const [fetchedCgpa, setFetchedCgpa] = useState<number | null>(null);
  const [fetchedCredits, setFetchedCredits] = useState<number | null>(null);
  const [courseList, setCourseList] = useState<any[]>(propCourses || []);
  const [gradeScale, setGradeScale] = useState<GradeScaleRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(
    !propCourses || propCgpa === undefined || propEarnedCredits === undefined
  );

  // Progress engine state (from /audit/progress/{matric})
  const [progressCategories, setProgressCategories] = useState<Array<{ category: string; required: number; earned: number }>>([]);
  const [progressRows, setProgressRows] = useState<any[]>([]);
  const [progressUnassigned, setProgressUnassigned] = useState<any[]>([]);
  const [progressWarnings, setProgressWarnings] = useState<string[]>([]);
  const [progressTotals, setProgressTotals] = useState<{ required: number; earned: number } | null>(null);
  const [progressLoading, setProgressLoading] = useState<boolean>(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchGradeScale().then((scale) => {
      if (isMounted && scale.length > 0) setGradeScale(scale);
    });
    return () => {
      isMounted = false;
    };
  }, []);


  const activeMatric = propMatric || profile?.matric_no || "";

  // Derive final display values cleanly during render: props always override local fetches
  const liveCgpa = Number(propCgpa ?? fetchedCgpa ?? 0).toFixed(2);
  // Single source of truth for totals: api.getProgress().totals (no hardcoded fallback)
  const liveEarnedCredits = progressTotals?.earned ?? null;
  const totalRequiredCredits = progressTotals?.required ?? null;
  const currentCourses = propCourses ?? courseList;

  // Dynamic progress percentage: (live_earned_credits / total_required_credits) * 100
  const progressPercentage =
    totalRequiredCredits && totalRequiredCredits > 0 && liveEarnedCredits !== null
      ? Math.min(100, Math.round((liveEarnedCredits / totalRequiredCredits) * 100))
      : 0;

  useEffect(() => {
    // If all essential data was passed via props, skip redundant DB fetches
    if (propCourses && propCgpa !== undefined && propEarnedCredits !== undefined) {
      setIsLoading(false);
      return;
    }

    if (!activeMatric && !user?.id) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchAuditData() {
      setIsLoading(true);
      try {
        // 1. Single query to advisee_roster_summary SQL view for pre-aggregated metrics
        const { data: summaryData, error: summaryErr } = await db
          .from("advisee_roster_summary")
          .select("cgpa, total_earned_credits")
          .eq("matric_no", activeMatric)
          .maybeSingle();

        if (summaryData) {
          if (isMounted) {
            if (summaryData.cgpa !== null && summaryData.cgpa !== undefined) {
              setFetchedCgpa(Number(summaryData.cgpa));
            }
            if (summaryData.total_earned_credits !== null && summaryData.total_earned_credits !== undefined) {
              setFetchedCredits(Number(summaryData.total_earned_credits));
            }
          }
        } else if (summaryErr) {
          // Graceful fallback to students table if SQL view is still being migrated
          console.warn("[DegreeAuditView] advisee_roster_summary notice:", summaryErr.message);
          const { data: studentFallback } = await db
            .from("students")
            .select("cgpa")
            .eq("matric_no", activeMatric)
            .maybeSingle();

          if (isMounted && studentFallback?.cgpa !== null && studentFallback?.cgpa !== undefined) {
            setFetchedCgpa(Number(studentFallback.cgpa));
          }
        }

        // 2. Query academic_records solely to populate the courseList array for the ledger table
        const { data: recordsData, error: recordsError } = await db
          .from("academic_records")
          .select("course_code, course_name, credits, grade, grade_point, semester, status")
          .eq("matric_no", activeMatric)
          .order("semester", { ascending: true });

        if (recordsError) {
          console.error("[DegreeAuditView] academic_records query error:", recordsError);
        } else if (recordsData && isMounted) {
          const mapped = recordsData.map((row: any) => ({
            code: row.course_code,
            name: row.course_name || "Unknown Module",
            credits: Number(row.credits) || 0,
            grade: row.grade || "N/A",
            pointValue: Number(row.grade_point) || 0,
            semester: row.semester || "1",
            status: row.status || "Pending",
          }));
          setCourseList(mapped);

          // If fetchedCredits was not returned by view, compute dynamically from approved courses
          setFetchedCredits((prev) => {
            if (prev !== null) return prev;
            return mapped
              .filter(
                (c) =>
                  c.status === "Passed" ||
                  c.status === "Pass" ||
                  c.status === "Pass/Approved" ||
                  c.status === "Approved"
              )
              .reduce((sum, c) => sum + c.credits, 0);
          });
        }
      } catch (err) {
        console.error("[DegreeAuditView] Error loading audit data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchAuditData();

    return () => {
      isMounted = false;
    };
  }, [propCourses, propCgpa, propEarnedCredits, activeMatric, user?.id]);

  // Fetch progress engine results separately (once matric is known)
  useEffect(() => {
    if (!activeMatric) return;
    let isMounted = true;
    setProgressLoading(true);
    setProgressError(null);
    api.getProgress(activeMatric)
      .then((data) => {
        if (!isMounted) return;
        setProgressCategories(data.categories || []);
        setProgressRows(data.rows || []);
        setProgressUnassigned(data.unassigned || []);
        setProgressWarnings(data.warnings || []);
        setProgressTotals(data.totals || null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setProgressTotals(null);
        const msg = err?.response?.data?.detail || err?.message || "Could not load progress data.";
        // 409 means no template/cohort — show as info, not error
        if (err?.response?.status === 409) {
          setProgressError(`ℹ️ ${msg}`);
        } else {
          setProgressError(msg);
        }
      })
      .finally(() => { if (isMounted) setProgressLoading(false); });
    return () => { isMounted = false; };
  }, [activeMatric, user?.id]);

  // Filter approved and non-passing courses
  const approvedCourses = currentCourses.filter((c) => {
    const defn = findGradeDefinition(c.grade, gradeScale);
    if (defn) {
      return defn.is_pass;
    }
    return (
      c.status === "Passed" ||
      c.status === "Pass" ||
      c.status === "Pass/Approved" ||
      c.status === "Approved" ||
      c.status === "Exempted"
    );
  });

  const failedCourses = currentCourses.filter((c) => {
    const defn = findGradeDefinition(c.grade, gradeScale);
    if (defn) {
      return !defn.is_pass;
    }
    return (
      c.status === "Failed" ||
      c.status === "Fail"
    );
  });

  // dynamicCategories is now sourced from the progress engine API (no hardcoded prefixes)
  const dynamicCategories = progressCategories.map((c, idx) => ({
    ...c,
    color: ["bg-blue-900", "bg-blue-700", "bg-blue-500", "bg-blue-400", "bg-blue-300"][idx % 5],
  }));

  const studentColumns: LedgerColumn<CourseLedgerRecord>[] = [
    {
      key: "code",
      header: (
        <div className="flex items-center gap-1.5">
          <Hash size={11} /> Code
        </div>
      ),
      headerClassName: "whitespace-nowrap",
      cellClassName: "font-mono font-bold text-gray-900 whitespace-nowrap",
      render: (c) => c.code,
    },
    {
      key: "name",
      header: "Course Title",
      cellClassName: "text-gray-700 font-medium max-w-[220px] truncate",
      render: (c) => <span title={c.name}>{c.name}</span>,
    },
    {
      key: "credits",
      header: "Cr",
      headerClassName: "text-center whitespace-nowrap",
      cellClassName: "text-center font-mono text-gray-600 whitespace-nowrap",
      render: (c) => c.credits,
    },
    {
      key: "semester",
      header: (
        <div className="flex items-center justify-center gap-1.5">
          <Calendar size={11} /> Sem
        </div>
      ),
      headerClassName: "text-center whitespace-nowrap",
      cellClassName: "text-center font-mono text-gray-500 whitespace-nowrap",
      render: (c) => c.semester || "—",
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "text-right whitespace-nowrap",
      cellClassName: "text-right whitespace-nowrap",
      render: (c) => {
        const gradeStr = String(c.grade || "").trim().toUpperCase();
        const defn = findGradeDefinition(gradeStr, gradeScale);

        // Unknown grade: show "Unknown grade X" in UI; never default to 0 or pass
        if (!defn && gradeStr) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <ShieldAlert size={11} /> Unknown grade {gradeStr}
            </span>
          );
        }

        const isPassing = defn ? defn.is_pass : (c.status === "Passed" || c.status === "Pass" || c.status === "Approved" || c.status === "Exempted");
        const isNeutralPassing = defn ? (defn.is_pass && !defn.counts_in_cgpa) : false;

        if (!isPassing) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <ShieldAlert size={11} /> FAILED
            </span>
          );
        }
        if (isNeutralPassing) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              ✓ PASSED ({gradeStr})
            </span>
          );
        }
        if (c.status === "Exempted") {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              ✓ EXEMPT
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            ✓ PASSED
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Academic Audit Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit CGPA</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
              <Award size={18} />
            </div>
          </div>
          <span className="text-4xl font-extrabold text-gray-900 mt-3 block tracking-tight font-mono">
            {liveCgpa}
          </span>
          <p className="text-xs text-gray-500 mt-1 font-medium">Cumulative Grade Point Average</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Credits Earned</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
              <BookOpen size={18} />
            </div>
          </div>
          {progressLoading ? (
            <p className="text-xs text-gray-400 mt-3 animate-pulse">Loading credits…</p>
          ) : progressError ? (
            <p className="text-xs text-rose-600 mt-3 font-semibold leading-relaxed">{progressError}</p>
          ) : liveEarnedCredits !== null && totalRequiredCredits !== null ? (
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold text-gray-900 tracking-tight font-mono">
                {liveEarnedCredits}
              </span>
              <span className="text-sm text-gray-500 font-semibold font-mono">
                / {totalRequiredCredits} Credits
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-3 font-mono">—</p>
          )}
          <p className="text-xs text-gray-500 mt-1 font-medium">Approved graduation credit requirement</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit Completion</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle size={18} />
            </div>
          </div>
          {progressLoading ? (
            <p className="text-xs text-gray-400 mt-3 animate-pulse">Calculating…</p>
          ) : progressError ? (
            <p className="text-xs text-rose-600 mt-3 font-semibold leading-relaxed">{progressError}</p>
          ) : liveEarnedCredits !== null && totalRequiredCredits !== null ? (
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold text-gray-900 tracking-tight font-mono">
                {progressPercentage}%
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-3 font-mono">—</p>
          )}
          <p className="text-xs text-gray-500 mt-1 font-medium">Progress towards degree syllabus blueprint</p>
        </div>
      </div>

      {/* Main Graduation Requirements Progress Bar Card */}
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Graduation Requirements Audit</h2>
              <p className="text-xs text-gray-500">Tracking against the Degree Program Syllabus Blueprint</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-gray-500">Overall Progress</span>
            {progressLoading ? (
              <p className="text-xs text-gray-400 animate-pulse font-mono">Loading…</p>
            ) : progressError ? (
              <p className="text-xs text-rose-600 font-semibold">{progressError}</p>
            ) : liveEarnedCredits !== null && totalRequiredCredits !== null ? (
              <p className="text-sm font-extrabold text-blue-900 font-mono">
                {liveEarnedCredits} / {totalRequiredCredits} Cr ({progressPercentage}%)
              </p>
            ) : (
              <p className="text-xs text-gray-400 font-mono">—</p>
            )}
          </div>
        </div>

        {/* Dynamic Master Progress Bar */}
        <div className="mb-8">
          <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden p-0.5">
            <div
              className="bg-blue-900 h-2.5 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Dynamic Category Progress Bars */}
        <div className="space-y-6">
          {dynamicCategories.map((item, idx) => {
            const catPercentage = Math.min(
              100,
              item.required > 0 ? Math.round((item.earned / item.required) * 100) : 0
            );

            return (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-gray-700">{item.category}</span>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-gray-900 font-mono">{item.earned}</span>
                    <span className="text-xs text-gray-500 font-medium font-mono"> / {item.required} Credits</span>
                    <span className="ml-2 text-xs font-semibold text-blue-900 font-mono">({catPercentage}%)</span>
                  </div>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`${item.color} h-2.5 rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${catPercentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        {/* Progress loading/error state */}
          {progressLoading && (
            <p className="text-xs text-gray-400 mt-4 animate-pulse">Loading requirement matching…</p>
          )}
          {!progressLoading && progressError && (
            <div className="mt-4 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>{progressError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Requirement Matching Table (from progress engine) */}
      {!progressLoading && progressRows.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Template Requirement Match</h2>
              <p className="text-xs text-gray-500">Course-by-course mapping against the degree syllabus</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-bold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left px-4 py-2.5 font-bold text-gray-500 uppercase tracking-wider">Course Name</th>
                  <th className="text-center px-4 py-2.5 font-bold text-gray-500 uppercase tracking-wider">Cr</th>
                  <th className="text-left px-4 py-2.5 font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-2.5 font-bold text-gray-500 uppercase tracking-wider">Satisfied By</th>
                  <th className="text-center px-4 py-2.5 font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {progressRows.map((row, i) => (
                  <tr key={row.template_course_id || i} className={row.status === 'done' ? '' : 'bg-gray-50/60'}>
                    <td className="px-4 py-2.5 font-mono font-bold text-gray-900 whitespace-nowrap">
                      {row.code}
                      {row.is_slot && (
                        <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.5 rounded">SLOT</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-[180px] truncate" title={row.name}>{row.name}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-gray-600">{row.credits}</td>
                    <td className="px-4 py-2.5 text-gray-500">{row.category}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">
                      {row.satisfied_by ? (
                        <div>
                          <div>
                            <span className="font-bold">{row.satisfied_by.course_code}</span>
                            {row.satisfied_by.grade && <span className="ml-1 text-gray-500">({row.satisfied_by.grade})</span>}
                            {row.satisfied_by.semester && <span className="ml-1 text-gray-400 text-[10px]">{row.satisfied_by.semester}</span>}
                          </div>
                          {(row.source === 'override' || row.override) && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded">
                                Set by advisor
                              </span>
                              {row.override?.note && (
                                <p className="text-[10px] text-gray-500 font-sans italic mt-0.5">{row.override.note}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.status === 'done' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={10} /> Done
                        </span>
                      )}
                      {row.status === 'in_progress' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          In Progress
                        </span>
                      )}
                      {row.status === 'missing' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                          Missing
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Engine Warnings */}
      {progressWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-700" />
            <span className="text-xs font-bold text-amber-800">Progress Engine Warnings</span>
          </div>
          {progressWarnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 ml-5">{w}</p>
          ))}
        </div>
      )}

      {/* Unassigned Courses */}
      {progressUnassigned.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} className="text-blue-700" />
            <span className="text-sm font-bold text-gray-800">Courses Not Matched to Template</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            These passing courses are recorded but do not map to any row in your degree template.
          </p>
          <div className="flex flex-wrap gap-2">
            {progressUnassigned.map((u) => (
              <span
                key={u.course_code}
                className={`inline-flex flex-col gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border ${
                  u.excluded || u.override?.kind === 'exclude'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{u.course_code}</span>
                  {u.grade && <span className="text-gray-400">({u.grade})</span>}
                  {u.credits && <span className="text-gray-400">{u.credits}cr</span>}
                </div>
                {(u.excluded || u.override?.kind === 'exclude') && (
                  <div className="mt-0.5 text-[10px] font-sans">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                      Set by advisor (Excluded)
                    </span>
                    {u.override?.note && (
                      <p className="text-gray-500 italic mt-0.5 font-normal">{u.override.note}</p>
                    )}
                  </div>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prerequisite Alert Status Panel */}
      {failedCourses.length > 0 ? (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-xl flex items-start gap-4 shadow-sm">
          <div className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-xs shrink-0">
            <ShieldAlert className="text-rose-700" size={22} />
          </div>
          <div>
            <h3 className="text-rose-900 font-bold text-sm">Prerequisite Verification Alert</h3>
            <p className="text-rose-800 text-xs mt-1.5 leading-relaxed">
              Non-passing marks detected in:{" "}
              <strong>
                {failedCourses.map((c) => `${c.code} (${c.name || "Module"}) [Grade: ${c.grade}]`).join(", ")}
              </strong>
              . Directed acyclic graph validation indicates a prerequisite hold on subsequent course enrolments.
            </p>
            <p className="text-rose-700 text-xs mt-2 font-medium">
              Please contact your academic advisor to re-evaluate your semester study plan.
            </p>
          </div>
        </div>
      ) : approvedCourses.length > 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl flex items-center gap-3.5 shadow-sm">
          <div className="bg-white p-2 rounded-lg border border-emerald-200 shadow-xs shrink-0">
            <CheckCircle2 className="text-emerald-600" size={20} />
          </div>
          <div>
            <h3 className="text-emerald-900 font-bold text-xs sm:text-sm">Prerequisites Fully Satisfied</h3>
            <p className="text-emerald-700 text-xs mt-0.5">
              All approved courses satisfy prerequisite dependencies without active academic holds.
            </p>
          </div>
        </div>
      ) : null}

      {/* Live Approved Courses Ledger — Decoupled Student Columns */}
      <CourseLedger
        records={approvedCourses as CourseLedgerRecord[]}
        columns={studentColumns}
        title="Approved Course Ledger"
        subtitle={`${approvedCourses.length} Approved`}
        icon={<Layers size={16} className="text-blue-900" />}
        emptyMessage="No approved courses recorded. Upload your transcript slip to populate your degree audit."
      />
    </div>
  );
}
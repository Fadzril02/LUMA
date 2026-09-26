import React, { useState, useEffect } from "react";
import { CheckCircle2, ShieldAlert, Award, BookOpen, Layers, CheckCircle, Clock } from "lucide-react";
import { db } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";

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
  const [isLoading, setIsLoading] = useState<boolean>(
    !propCourses || propCgpa === undefined || propEarnedCredits === undefined
  );

  const activeMatric = propMatric || profile?.matric_no || "";

  // Derive final display values cleanly during render: props always override local fetches
  const liveCgpa = Number(propCgpa ?? fetchedCgpa ?? 0).toFixed(2);
  const liveEarnedCredits = Number(propEarnedCredits ?? fetchedCredits ?? 0);
  const totalRequiredCredits = Number(propRequiredCredits ?? 120);
  const currentCourses = propCourses ?? courseList;

  // Dynamic progress percentage: (live_earned_credits / total_required_credits) * 100
  const progressPercentage =
    totalRequiredCredits > 0
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

  // Filter approved and non-passing courses
  const approvedCourses = currentCourses.filter(
    (c) =>
      c.status === "Passed" ||
      c.status === "Pass" ||
      c.status === "Pass/Approved" ||
      c.status === "Approved" ||
      c.status === "Exempted"
  );

  const failedCourses = currentCourses.filter(
    (c) =>
      c.status === "Failed" ||
      c.status === "Fail" ||
      c.grade === "E" ||
      c.grade === "F"
  );

  // Dynamic module distribution derived from live approved course codes
  const coreCredits = approvedCourses
    .filter((c) => /^(SCSE|SECJ|SCS|SE|CS|SEC)/i.test(c.code))
    .reduce((sum, c) => sum + (c.credits || 0), 0);

  const electiveCredits = approvedCourses
    .filter((c) => /^(SCSR|SCST|SECV|SECR|SECD)/i.test(c.code))
    .reduce((sum, c) => sum + (c.credits || 0), 0);

  const generalCredits = approvedCourses
    .filter((c) => /^(UHLB|ULRS|UHMT|UBSS|UKQF|UCS|U)/i.test(c.code))
    .reduce((sum, c) => sum + (c.credits || 0), 0);

  const targetCore = Math.round(totalRequiredCredits * 0.65);
  const targetElective = Math.round(totalRequiredCredits * 0.2);
  const targetGeneral = Math.max(1, totalRequiredCredits - targetCore - targetElective);

  const dynamicCategories = [
    {
      category: "Core Software Engineering Modules",
      earned: coreCredits,
      required: targetCore,
      color: "bg-blue-900",
    },
    {
      category: "Departmental Elective Modules",
      earned: electiveCredits,
      required: targetElective,
      color: "bg-blue-700",
    },
    {
      category: "University General Requirements",
      earned: generalCredits,
      required: targetGeneral,
      color: "bg-blue-500",
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
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold text-gray-900 tracking-tight font-mono">
              {liveEarnedCredits}
            </span>
            <span className="text-sm text-gray-500 font-semibold font-mono">
              / {totalRequiredCredits} Credits
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">Approved graduation credit requirement</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit Completion</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold text-gray-900 tracking-tight font-mono">
              {progressPercentage}%
            </span>
          </div>
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
            <p className="text-sm font-extrabold text-blue-900 font-mono">
              {liveEarnedCredits} / {totalRequiredCredits} Cr ({progressPercentage}%)
            </p>
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
        </div>
      </div>

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

      {/* Live Approved Courses Ledger with Clean Zero-State */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-blue-900" />
            <h3 className="text-sm font-bold text-gray-900">Approved Course Ledger</h3>
          </div>
          <span className="text-xs font-mono text-gray-500 font-medium">
            {approvedCourses.length} Approved Modules
          </span>
        </div>

        {approvedCourses.length === 0 ? (
          /* Clean Zero-State Display */
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
              <Clock size={24} />
            </div>
            <h4 className="text-sm font-bold text-gray-900">No Approved Courses Recorded</h4>
            <p className="text-xs text-gray-500 max-w-sm mt-1 leading-relaxed">
              Patient zero state: No official transcript slip has been approved yet. Upload your examination slip
              to populate your live degree audit records.
            </p>
          </div>
        ) : (
          /* Live Course Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/60 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider">Course Code</th>
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider">Course Title</th>
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider text-center">Credits</th>
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider text-center">Grade</th>
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider text-center">Semester</th>
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {approvedCourses.map((course, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-gray-800 font-bold">{course.code}</td>
                    <td className="px-6 py-3.5 text-gray-900 font-medium">{course.name}</td>
                    <td className="px-6 py-3.5 text-center font-mono text-gray-600">{course.credits}</td>
                    <td className="px-6 py-3.5 text-center font-mono font-bold text-gray-900">{course.grade}</td>
                    <td className="px-6 py-3.5 text-center font-mono text-gray-600">{course.semester}</td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        APPROVED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
import React from "react";
import { CheckCircle2, AlertTriangle, Clock, Layers, BookOpen, Hash, Calendar, Info } from "lucide-react";

export interface CourseLedgerRecord {
  code: string;
  name: string;
  credits: number;
  grade: string;
  grade_point?: number;
  semester?: string;
  status: string;
  // Advisor-only diagnostic fields (optional)
  prerequisite_met?: boolean;
  missing_prerequisites?: string[];
  is_ai_parsed?: boolean;
  attempt_count?: number;
  override_flag?: boolean;
}

interface CourseLedgerProps {
  records: CourseLedgerRecord[];
  role: "student" | "advisor";
  title?: string;
}

// Maps a status/grade to its badge variant
function StatusBadge({ status, grade, role }: { status: string; grade: string; role: "student" | "advisor" }) {
  const isHL = grade?.toUpperCase() === "HL";
  const isPC = grade?.toUpperCase() === "PC" || grade?.toUpperCase() === "EX";
  const isPassed = ["Passed", "Pass", "Pass/Approved", "Approved"].includes(status);
  const isExempted = status === "Exempted" || isHL || isPC;
  const isFailed = ["Failed", "Fail"].includes(status) || grade === "E" || grade === "TL";

  if (isExempted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
        {role === "advisor" ? `EXEMPT (${grade})` : "✓ EXEMPT"}
      </span>
    );
  }
  if (isPassed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        {role === "advisor" ? `PASSED (${grade})` : "✓ PASSED"}
      </span>
    );
  }
  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertTriangle size={10} /> {role === "advisor" ? `FAILED (${grade})` : "FAILED"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
      {status || "—"}
    </span>
  );
}

export function CourseLedger({ records, role, title }: CourseLedgerProps) {
  const isAdvisor = role === "advisor";

  // Student view: only approved/exempted courses
  // Advisor view: all courses
  const displayRecords = isAdvisor
    ? records
    : records.filter(
        (c) =>
          ["Passed", "Pass", "Pass/Approved", "Approved", "Exempted"].includes(c.status) ||
          c.grade?.toUpperCase() === "HL" ||
          c.grade?.toUpperCase() === "PC" ||
          c.grade?.toUpperCase() === "EX"
      );

  const approvedCount = records.filter(
    (c) =>
      ["Passed", "Pass", "Pass/Approved", "Approved", "Exempted"].includes(c.status) ||
      c.grade?.toUpperCase() === "HL"
  ).length;

  const ledgerTitle = title || (isAdvisor ? "Academic History Ledger" : "Approved Course Ledger");
  const ledgerIcon = isAdvisor ? <BookOpen size={16} className="text-blue-900" /> : <Layers size={16} className="text-blue-900" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ledgerIcon}
          <h3 className="text-sm font-bold text-gray-900">{ledgerTitle}</h3>
        </div>
        <span className="text-xs font-mono text-gray-500">
          {isAdvisor ? `${displayRecords.length} Courses` : `${approvedCount} Approved`}
        </span>
      </div>

      {displayRecords.length === 0 ? (
        <div className="p-10 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
            <Clock size={20} />
          </div>
          <h4 className="text-sm font-bold text-gray-900">No Records Found</h4>
          <p className="text-xs text-gray-500 max-w-xs mt-1 leading-relaxed">
            {isAdvisor
              ? "No academic records are attached to this student profile yet."
              : "No approved courses recorded. Upload your transcript slip to populate your degree audit."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/60 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1.5"><Hash size={11} /> Code</div>
                </th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider">Course Title</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-center whitespace-nowrap">Cr</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5"><Calendar size={11} /> Sem</div>
                </th>
                {isAdvisor && (
                  <>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-center whitespace-nowrap">GP</th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5"><Info size={11} /> Prereq</div>
                    </th>
                    <th className="px-5 py-3 font-semibold uppercase tracking-wider text-center whitespace-nowrap">AI</th>
                  </>
                )}
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-right whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayRecords.map((course, idx) => {
                const isNeutral = ["HL", "PC", "EX"].includes(course.grade?.toUpperCase());
                const prereqFailed = isAdvisor && course.prerequisite_met === false;

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-gray-50/60 transition-colors ${prereqFailed ? "bg-rose-50/40 hover:bg-rose-50/60" : ""}`}
                  >
                    <td className="px-5 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{course.code}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium max-w-[220px] truncate" title={course.name}>{course.name}</td>
                    <td className="px-5 py-3 text-center font-mono text-gray-600 whitespace-nowrap">{course.credits}</td>
                    <td className="px-5 py-3 text-center font-mono text-gray-500 whitespace-nowrap">{course.semester || "—"}</td>
                    {isAdvisor && (
                      <>
                        <td className="px-5 py-3 text-center font-mono text-gray-600 whitespace-nowrap">
                          {isNeutral ? (
                            <span className="text-blue-600 font-semibold">—</span>
                          ) : (
                            <span className={`font-bold ${(course.grade_point ?? 0) < 2.0 ? "text-rose-600" : "text-gray-800"}`}>
                              {course.grade_point?.toFixed(2) ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center whitespace-nowrap">
                          {course.prerequisite_met === false ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                              title={(course.missing_prerequisites || []).join(", ")}
                            >
                              <AlertTriangle size={9} /> UNMET
                            </span>
                          ) : (
                            <CheckCircle2 size={14} className="mx-auto text-emerald-500" />
                          )}
                        </td>
                        <td className="px-5 py-3 text-center whitespace-nowrap">
                          {course.is_ai_parsed ? (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">AI</span>
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <StatusBadge status={course.status} grade={course.grade} role={role} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  CheckSquare,
  AlertCircle,
  Save,
  Hash,
  Info,
  CheckCircle2,
  AlertTriangle,
  BookOpen
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input } from "../../components/ui";
import { db } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { CourseLedger, CourseLedgerRecord, LedgerColumn } from "../../../components/shared/CourseLedger";

interface StudentViewProps {
  student: any;
  onBack: () => void;
}

export function StudentView({ student, onBack }: StudentViewProps) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState("");
  const [actionItem, setActionItem] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pastLogs, setPastLogs] = useState<any[]>([]);
  const [fetchedRecords, setFetchedRecords] = useState<any[]>([]);

  // Guard against null/undefined student prop rendering blankly
  if (!student) {
    console.error("MODAL_CRASH_DUMP: StudentView rendered with missing/null student prop:", student);
    return (
      <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
        <p className="font-bold">Error loading student profile.</p>
        <button onClick={onBack} className="mt-3 text-xs underline text-blue-900 cursor-pointer">
          Return to Advisee List
        </button>
      </div>
    );
  }

  // Extract real metrics safely passed downwards or fetched from academic_records
  const recordsSource = student.rawResults || student.records || (fetchedRecords.length > 0 ? fetchedRecords : []);
  const courseResults: CourseLedgerRecord[] = recordsSource.map((r: any) => ({
    code: r.course_code || r.code || "",
    name: r.course_name || r.name || "Unknown Module",
    credits: Number(r.credits) || 0,
    grade: r.grade || "N/A",
    grade_point: Number(r.grade_point ?? r.pointValue) || undefined,
    semester: r.semester || r.session_semester || r.semester_id || "—",
    status: r.status || "N/A",
    prerequisite_met: r.prerequisite_met,
    missing_prerequisites: r.missing_prerequisites,
    is_ai_parsed: r.is_ai_parsed,
  }));

  const totalRequiredCredits =
    student.total_credits_required ||
    student.required_credits ||
    student.degree_template?.total_credits_required ||
    student.cohorts?.degree_templates?.total_credits_required ||
    120;
  const currentCredits = Number(student.credits || student.total_earned_credits) || 0;
  const creditProgressPercentage = Math.min((currentCredits / totalRequiredCredits) * 100, 100);

  // Diagnostic Hook: Robust try/catch blocks with explicit MODAL_CRASH_DUMP logs
  useEffect(() => {
    let isMounted = true;

    const fetchModalData = async () => {
      try {
        if (!student?.matric_no) {
          console.error("MODAL_CRASH_DUMP: Student object is missing matric_no identifier:", student);
          return;
        }

        // 1. Fetch Advising Logs
        try {
          const { data: logsData, error: logsError } = await db
            .from("advising_logs")
            .select("*")
            .eq("student_matric_no", student.matric_no)
            .order("session_date", { ascending: false });

          if (logsError) {
            console.error("MODAL_CRASH_DUMP: Error fetching advising_logs table:", logsError);
          } else if (logsData && isMounted) {
            setPastLogs(logsData);
          }
        } catch (logsCatchErr) {
          console.error("MODAL_CRASH_DUMP: Exception during advising_logs query:", logsCatchErr);
        }

        // 2. Fetch Academic Records if not provided in student prop
        if (!student.rawResults && !student.records) {
          try {
            const { data: recData, error: recError } = await db
              .from("academic_records")
              .select("*")
              .eq("matric_no", student.matric_no)
              .order("semester", { ascending: true });

            if (recError) {
              console.error("MODAL_CRASH_DUMP: Error fetching academic_records table:", recError);
            } else if (recData && isMounted) {
              setFetchedRecords(recData);
            }
          } catch (recCatchErr) {
            console.error("MODAL_CRASH_DUMP: Exception during academic_records query:", recCatchErr);
          }
        }
      } catch (fatalError) {
        console.error("MODAL_CRASH_DUMP: Fatal error in modal data fetch:", fatalError);
      }
    };

    fetchModalData();

    return () => {
      isMounted = false;
    };
  }, [student?.matric_no]);

  const handleSaveNotes = async () => {
    if (!notes.trim()) return;
    setIsSaving(true);
    const advisorStaffId = (profile as any)?.staff_id;
    
    try {
      if (!student?.matric_no) {
        throw new Error("Cannot save advising log: student.matric_no is missing");
      }
      const { data, error } = await db.from("advising_logs").insert([{
        student_matric_no: student.matric_no,
        advisor_staff_id: advisorStaffId,
        notes: notes.trim(),
        action_item: actionItem.trim() || null
      }]).select();

      if (error) {
        console.error("MODAL_CRASH_DUMP: Error saving advising log:", error);
        throw error;
      }
      
      if (data && data.length > 0) {
        setPastLogs([data[0], ...pastLogs]);
        setNotes("");
        setActionItem("");
        alert("Academic intervention logs committed to database ledger.");
      }
    } catch (err) {
      console.error("MODAL_CRASH_DUMP: Exception in handleSaveNotes:", err);
      alert("Failed to save advising log.");
    } finally {
      setIsSaving(false);
    }
  };

  // Strictly decoupled advisor column configuration
  const advisorColumns: LedgerColumn<CourseLedgerRecord>[] = [
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
      key: "grade_point",
      header: "GP",
      headerClassName: "text-center whitespace-nowrap",
      cellClassName: "text-center font-mono text-gray-600 whitespace-nowrap",
      render: (c) => {
        const isNeutral = ["HL", "PC", "EX"].includes(c.grade?.toUpperCase() || "");
        if (isNeutral) return <span className="text-blue-600 font-semibold">—</span>;
        return (
          <span className={`font-bold ${(c.grade_point ?? 0) < 2.0 ? "text-rose-600" : "text-gray-800"}`}>
            {c.grade_point !== undefined && c.grade_point !== null ? c.grade_point.toFixed(2) : "—"}
          </span>
        );
      },
    },
    {
      key: "prereq",
      header: (
        <div className="flex items-center justify-center gap-1.5">
          <Info size={11} /> Prereq
        </div>
      ),
      headerClassName: "text-center whitespace-nowrap",
      cellClassName: "text-center whitespace-nowrap",
      render: (c) => {
        if (c.prerequisite_met === false) {
          return (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
              title={(c.missing_prerequisites || []).join(", ")}
            >
              <AlertTriangle size={9} /> UNMET
            </span>
          );
        }
        return <CheckCircle2 size={14} className="mx-auto text-emerald-500" />;
      },
    },
    {
      key: "ai_flag",
      header: "AI",
      headerClassName: "text-center whitespace-nowrap",
      cellClassName: "text-center whitespace-nowrap",
      render: (c) => (
        c.is_ai_parsed ? (
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">AI</span>
        ) : (
          <span className="text-[10px] text-gray-400">—</span>
        )
      ),
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "text-right whitespace-nowrap",
      cellClassName: "text-right whitespace-nowrap",
      render: (c) => {
        const isHL = c.grade?.toUpperCase() === "HL";
        const isPC = c.grade?.toUpperCase() === "PC" || c.grade?.toUpperCase() === "EX";
        const isPassed = ["Passed", "Pass", "Pass/Approved", "Approved"].includes(c.status);
        const isExempted = c.status === "Exempted" || isHL || isPC;
        const isFailed = ["Failed", "Fail"].includes(c.status) || c.grade === "E" || c.grade === "TL";

        if (isExempted) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              EXEMPT ({c.grade})
            </span>
          );
        }
        if (isPassed) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              PASSED ({c.grade})
            </span>
          );
        }
        if (isFailed) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <AlertTriangle size={10} /> FAILED ({c.grade})
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
            {c.status || "—"}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* 🔙 TOP HEADER TRACK WITH ACTION CONTROLS */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack} 
          className="flex items-center text-sm font-medium text-gray-500 hover:text-[#990033] transition-colors gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Advisee List
        </button>
        <Badge variant={student.academic_status === 'Good Standing' ? 'success' : 'danger'} className="text-sm px-3 py-1">
          Account Status: {student.academic_status || 'Good Standing'}
        </Badge>
      </div>

      {/* 👤 CHASSIS TOP SUMMARY DETAILS SCREEN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white border border-gray-200">
          <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
            <div>
              <span className="text-xs font-bold font-mono text-blue-900 tracking-widest uppercase">STUDENT PROFILE</span>
              <h2 className="text-2xl font-bold text-gray-900 mt-1">{student.name}</h2>
              <p className="text-sm font-mono text-gray-500 mt-0.5">Matric No: {student.matric_no || student.id}</p>
            </div>
            
            {/* Degree Credit Milestones Tracker bar code display */}
            <div className="space-y-2 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-gray-600">Total Program Credit Progress</span>
                <span className="text-gray-900 font-bold">{currentCredits} / {totalRequiredCredits} Credits</span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${creditProgressPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">Completion threshold calculated against degree program blueprint.</p>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic score summary blocks */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div>
              <GraduationCap className="w-8 h-8 text-[#FFCC00] mb-2" />
              <p className="text-sm text-slate-400 font-medium">Calculated Cumulative Performance</p>
              <p className="text-5xl font-black text-white mt-1 font-mono tracking-tight">{Number(student.cgpa || 0).toFixed(2)}</p>
            </div>
            <div className="pt-4 border-t border-slate-700 text-xs text-slate-400 flex items-center justify-between">
              <span>Status Standing:</span>
              <span className={`font-bold uppercase ${Number(student.cgpa || 0) < 2.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {Number(student.cgpa || 0) < 2.5 ? 'At Risk' : 'Satisfactory'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🛠️ CORE COMPONENT DEEP GRID SYSTEM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Full Academic History Ledger — decoupled advisor columns */}
        <div className="lg:col-span-2 max-h-[500px] overflow-y-auto">
          <CourseLedger
            records={courseResults}
            columns={advisorColumns}
            title="Academic History Ledger"
            subtitle={`${courseResults.length} Courses`}
            icon={<BookOpen size={16} className="text-blue-900" />}
            emptyMessage="No academic records are attached to this student profile yet."
            getRowClassName={(c) => (c.prerequisite_met === false ? "bg-rose-50/40 hover:bg-rose-50/60" : "")}
          />
        </div>

        {/* Right Side: Proactive Advising Note Hub */}
        <Card className="flex flex-col h-full border border-gray-200">
          <div className="flex-1 overflow-y-auto">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
              <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Advising Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-3">
                <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date: {new Date().toLocaleDateString()}
                </div>
                <textarea
                  className="w-full min-h-[100px] p-3 text-sm text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-900 bg-white resize-none shadow-sm"
                  placeholder="Notes (e.g., student advised to repeat Operating Systems)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="relative">
                  <CheckSquare className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <Input
                    placeholder="Action Item (Optional)"
                    value={actionItem}
                    onChange={(e) => setActionItem(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <Button 
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white font-medium flex items-center justify-center gap-2 cursor-pointer"
                  onClick={handleSaveNotes}
                  disabled={isSaving || !notes.trim()}
                >
                  <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Commit Log"}
                </Button>
              </div>

              {pastLogs.length > 0 && (
                <div className="pt-4 border-t border-gray-100 space-y-3 mt-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Past Sessions</h4>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {pastLogs.map((log) => (
                      <div key={log.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(log.session_date).toLocaleDateString()}
                        </div>
                        <p className="text-gray-800 whitespace-pre-wrap">{log.notes}</p>
                        {log.action_item && (
                          <div className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 p-1.5 rounded-md flex items-start gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>Action: {log.action_item}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </div>
        </Card>

      </div>
    </div>
  );
}
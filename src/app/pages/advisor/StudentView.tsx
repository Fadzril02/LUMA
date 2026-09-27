import React, { useState, useEffect } from "react";
import { ArrowLeft, GraduationCap, Calendar, CheckSquare, AlertCircle, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input } from "../../components/ui";
import { db } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { CourseLedger, CourseLedgerRecord } from "../../../components/shared/CourseLedger";

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

  // Extract real metrics safely passed downwards inside array parameters
  const courseResults: CourseLedgerRecord[] = (student.rawResults || student.records || []).map((r: any) => ({
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

  useEffect(() => {
    const fetchLogs = async () => {
      if (!student.matric_no) return;
      const { data, error } = await db
        .from("advising_logs")
        .select("*")
        .eq("student_matric_no", student.matric_no)
        .order("session_date", { ascending: false });
      
      if (!error && data) {
        setPastLogs(data);
      }
    };
    fetchLogs();
  }, [student.matric_no]);

  const handleSaveNotes = async () => {
    if (!notes.trim()) return;
    setIsSaving(true);
    const advisorStaffId = (profile as any)?.staff_id;
    
    try {
      const { data, error } = await db.from("advising_logs").insert([{
        student_matric_no: student.matric_no,
        advisor_staff_id: advisorStaffId,
        notes: notes.trim(),
        action_item: actionItem.trim() || null
      }]).select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        setPastLogs([data[0], ...pastLogs]);
        setNotes("");
        setActionItem("");
        alert("Academic intervention logs committed to database ledger.");
      }
    } catch (err) {
      console.error("Failed to save log:", err);
      alert("Failed to save advising log.");
    } finally {
      setIsSaving(false);
    }
  };

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
        
        {/* Left Side: Full Academic History Ledger — shared CourseLedger (advisor role) */}
        <div className="lg:col-span-2 max-h-[500px] overflow-y-auto">
          <CourseLedger
            records={courseResults}
            role="advisor"
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
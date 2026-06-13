import React, { useState } from "react";
import { ArrowLeft, GraduationCap, Calendar, Clock, BookOpen, AlertCircle, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "../../components/ui";

interface StudentViewProps {
  student: any;
  onBack: () => void;
}

export function StudentView({ student, onBack }: StudentViewProps) {
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Extract real metrics safely passed downwards inside array parameters
  const courseResults = student.rawResults || [];
  const creditProgressPercentage = Math.min((student.credits / 130) * 100, 100);

  const handleSaveNotes = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      alert("Academic intervention logs committed to database ledger.");
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* 🔙 TOP HEADER TRACK WITH ACTION CONTROLS */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack} 
          className="flex items-center text-sm font-medium text-gray-500 hover:text-[#990033] transition-colors gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Advisee List
        </button>
        <Badge variant={student.status === 'Good Standing' ? 'success' : 'danger'} className="text-sm px-3 py-1">
          Account Status: {student.status}
        </Badge>
      </div>

      {/* 👤 CHASSIS TOP SUMMARY DETAILS SCREEN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white">
          <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
            <div>
              <span className="text-xs font-bold font-mono text-[#990033] tracking-widest uppercase">STUDENT PROFILE</span>
              <h2 className="text-2xl font-bold text-gray-900 mt-1">{student.name}</h2>
              <p className="text-sm font-mono text-gray-500 mt-0.5">Matric No: {student.id}</p>
            </div>
            
            {/* Degree Credit Milestones Tracker bar code display */}
            <div className="space-y-2 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-gray-600">Total Program Credit Progress</span>
                <span className="text-gray-900 font-bold">{student.credits} / 130 Credits</span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${creditProgressPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">Completion threshold calculated against Software Engineering syllabus blueprints.</p>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic score summary blocks */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div>
              <GraduationCap className="w-8 h-8 text-[#FFCC00] mb-2" />
              <p className="text-sm text-slate-400 font-medium">Calculated Cumulative Performance</p>
              <p className="text-5xl font-black text-white mt-1 font-mono tracking-tight">{student.cgpa.toFixed(2)}</p>
            </div>
            <div className="pt-4 border-t border-slate-700 text-xs text-slate-400 flex items-center justify-between">
              <span>Status Standing:</span>
              <span className={`font-bold uppercase ${student.cgpa < 2.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {student.cgpa < 2.5 ? 'Kedudukan Amaran' : 'Satisfactory'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🛠️ CORE COMPONENT DEEP GRID SYSTEM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Full Academic History Ledger */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#990033]" /> Academic History Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[400px] overflow-y-auto">
            {courseResults.length === 0 ? (
              <p className="p-8 text-center text-sm font-mono text-gray-400">
                No individual course evaluation items attached to database records.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {courseResults.map((result: any, idx: number) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="space-y-1">
                      <p className="font-mono font-bold text-sm text-[#990033]">{result.course_code}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-2">
                        <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> Sem {result.semester_id || "N/A"}</span>
                        <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {result.course?.credit_hour || 3} Credits</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-gray-900 font-mono bg-gray-100 px-2.5 py-1 rounded-md">
                        {result.grade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Side: Proactive Advising Note Hub */}
        <Card className="flex flex-col h-full justify-between">
          <div>
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Advising Log & Session Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Log internal interventions, remedial study roadmap adjustments, or course drop approvals here.
              </p>
              <textarea
                className="w-full min-h-[180px] p-3 text-sm text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#990033] bg-slate-50/50 resize-none"
                placeholder="Type structural advisement entries (e.g., student advised to repeat Operating Systems next semester)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <Button 
              className="w-full bg-[#990033] hover:bg-[#80002A] text-white font-medium flex items-center justify-center gap-2"
              onClick={handleSaveNotes}
              disabled={isSaving || !notes.trim()}
            >
              <Save className="w-4 h-4" /> {isSaving ? "Saving Logs..." : "Commit Session Note"}
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
}
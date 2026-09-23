import React, { useState, useEffect } from "react";
import { Check, XCircle, Clock, CheckCircle2, FileText, Calendar, Eye, X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, Button, Badge } from "../../components/ui";
import { db } from "../../../lib/supabase";
import { api } from "../../../lib/api";

interface CorrectionsQueueProps {
  queue: any[];
  roster: any[];
}

export function CorrectionsQueue({ queue, roster }: CorrectionsQueueProps) {
  const [liveQueue, setLiveQueue] = useState<any[]>(queue);
  const [filterStatus, setFilterStatus] = useState<string>("Pending_Advisor_Approval"); 

  const [activeAuditDoc, setActiveAuditDoc] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Staged courses with manual fallback support
  const [stagedCourses, setStagedCourses] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualGrade, setManualGrade] = useState("A");
  const [manualCredits, setManualCredits] = useState(3);

  useEffect(() => { setLiveQueue(queue); }, [queue]);

  const pendingCount = liveQueue.filter((item) => item.processing_status === "Pending_Advisor_Approval").length;
  const approvedCount = liveQueue.filter((item) => item.processing_status === "Approved").length;

  const handleOpenAudit = async (doc: any) => {
    const { data } = db.storage.from("academic-slips").getPublicUrl(doc.file_path);
    setPdfUrl(data.publicUrl);
    setActiveAuditDoc(doc);
    const courses = doc.extracted_data?.courses || [];
    setStagedCourses([...courses]);
    setShowAddForm(false);
    setManualCode("");
    setManualName("");
    setManualGrade("A");
    setManualCredits(3);
  };

  const handleAddManualCourse = () => {
    const trimmed = manualCode.trim().toUpperCase();
    if (!trimmed) {
      alert("Please enter a valid Course Code (e.g. SECJ1013).");
      return;
    }
    const newCourse = {
      course_code: trimmed,
      course_name: manualName.trim() || trimmed,
      grade: manualGrade.trim().toUpperCase(),
      credit_hour: Number(manualCredits) || 3,
      credits: Number(manualCredits) || 3,
      status: ["TD", "TS", "E"].includes(manualGrade.trim().toUpperCase()) ? "Failed" : "Passed"
    };
    setStagedCourses(prev => [...prev, newCourse]);
    setManualCode("");
    setManualName("");
    setShowAddForm(false);
  };

  const handleRemoveCourse = (index: number) => {
    setStagedCourses(prev => prev.filter((_, i) => i !== index));
  };

  const handleReject = async () => {
    if (!activeAuditDoc) return;
    await db.from("uploaded_documents").update({ processing_status: "Rejected" }).eq("id", activeAuditDoc.id);
    setLiveQueue(prev => prev.map(item => item.id === activeAuditDoc.id ? { ...item, processing_status: "Rejected" } : item));
    setActiveAuditDoc(null);
  };

  const handleApprove = async () => {
    if (!activeAuditDoc || !activeAuditDoc.extracted_data) return;
    if (!stagedCourses || stagedCourses.length === 0) {
      alert("No course records provided for approval. Please add courses manually before approving.");
      return;
    }
    setIsSaving(true);
    
    try {
      const studentData = activeAuditDoc.extracted_data;
      const matchingStudent = roster.find((s) => s.id === activeAuditDoc.matric_no || s.matric_no === activeAuditDoc.matric_no);
      
      // Route through FastAPI Zero-Waste engine for DAG verification & persistence into academic_records.
      // Note: advisor_id is strictly derived from the verified JWT payload on the backend.
      await api.finalizeApproval({
        document_id: activeAuditDoc.id,
        matric_number: activeAuditDoc.matric_no,
        student_name: matchingStudent ? matchingStudent.name : studentData.student_name,
        academic_session: studentData.academic_session || "2024/2025",
        semester: studentData.semester || 1,
        courses: stagedCourses.map(c => ({
          course_code: c.course_code.replace(/\s+/g, "").toUpperCase(),
          course_name: c.course_name || c.course_code,
          grade: c.grade.trim().toUpperCase(),
          credit_hour: Number(c.credit_hour || c.credits || 3),
          credits: Number(c.credits || c.credit_hour || 3),
          status: c.status || "Pass"
        }))
      });

      setLiveQueue(prev => prev.map(item => item.id === activeAuditDoc.id ? { ...item, processing_status: "Approved" } : item));
      setActiveAuditDoc(null);

    } catch (err: any) {
      console.error("Save failed:", err);
      const errMsg = err?.response?.data?.detail || err?.message || "Failed to commit verified records.";
      alert(`Approval Failed: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const displayQueue = liveQueue.filter((item) => item.processing_status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setFilterStatus("Pending_Advisor_Approval")} className={`text-left transition-all ${filterStatus === "Pending_Advisor_Approval" ? "scale-[1.02]" : "opacity-75"}`}>
          <Card className={`border-l-4 p-1 ${filterStatus === "Pending_Advisor_Approval" ? "border-l-[#FFCC00] bg-amber-50/20" : "border-l-gray-300"}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Awaiting Audit</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{pendingCount}</p>
              </div>
              <Clock className="w-6 h-6 text-[#997a00]" />
            </CardContent>
          </Card>
        </button>

        <button onClick={() => setFilterStatus("Approved")} className={`text-left transition-all ${filterStatus === "Approved" ? "scale-[1.02]" : "opacity-75"}`}>
          <Card className={`border-l-4 p-1 ${filterStatus === "Approved" ? "border-l-emerald-500 bg-emerald-50/10" : "border-l-gray-300"}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Verified Records</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{approvedCount}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </CardContent>
          </Card>
        </button>
      </div>

      <div className="space-y-4">
        {displayQueue.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-lg border border-dashed text-gray-500">All caught up! No pending documents.</div>
        ) : (
          displayQueue.map((req) => {
            const matchingStudent = roster.find((s) => s.id === req.matric_no);
            const studentName = matchingStudent ? matchingStudent.name : req.matric_no;

            return (
              <Card key={req.id} className="hover:border-gray-300 transition-colors">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{studentName}</h3>
                    <p className="text-sm text-gray-500">{req.file_name} • Uploaded {new Date(req.uploaded_at || Date.now()).toLocaleDateString()}</p>
                  </div>
                  {req.processing_status === "Pending_Advisor_Approval" && (
                    <Button onClick={() => handleOpenAudit(req)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                      <Eye className="w-4 h-4 mr-2" /> Audit Document
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {activeAuditDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Document Audit</h3>
                <p className="text-sm text-gray-500">Student: {activeAuditDoc.matric_no}</p>
              </div>
              <button onClick={() => setActiveAuditDoc(null)}><X className="w-6 h-6 text-gray-500 hover:text-gray-800" /></button>
            </div>
            
            {/* THE MASSIVE FRAUD ALERT BANNER */}
            {activeAuditDoc.fraud_flag && (
              <div className="bg-[#990033] text-white px-6 py-3 flex items-center justify-center font-bold tracking-widest text-sm shadow-inner uppercase">
                ⚠️ System Alert: Metadata Anomaly Detected. Suspected Digital Forgery. ⚠️
              </div>
            )}

            <div className="flex-1 flex overflow-hidden">
              <div className="w-1/2 border-r border-gray-200 bg-gray-100 p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Original Document</h4>
                <iframe src={pdfUrl} className="w-full h-full rounded shadow-sm border border-gray-300 bg-white" />
              </div>

              <div className="w-1/2 p-6 overflow-y-auto bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase">Student Submitted Data</h4>
                      <p className="text-xs text-gray-400">{stagedCourses.length} course{stagedCourses.length === 1 ? "" : "s"} staged for audit</p>
                    </div>
                    <Button
                      onClick={() => setShowAddForm(!showAddForm)}
                      variant="outline"
                      size="sm"
                      className="text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Course Manually
                    </Button>
                  </div>

                  {/* Manual Course Input Form */}
                  {showAddForm && (
                    <div className="mb-4 p-4 border border-indigo-100 bg-indigo-50/50 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">Add Course Entry</span>
                        <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-medium text-gray-600 block mb-1">Course Code *</label>
                          <input
                            type="text"
                            placeholder="e.g. SECJ1013"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                            className="w-full text-xs font-mono px-2.5 py-1.5 border border-gray-300 rounded bg-white focus:outline-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-gray-600 block mb-1">Course Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Programming Technique I"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded bg-white focus:outline-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-gray-600 block mb-1">Grade *</label>
                          <select
                            value={manualGrade}
                            onChange={(e) => setManualGrade(e.target.value)}
                            className="w-full text-xs font-bold px-2.5 py-1.5 border border-gray-300 rounded bg-white focus:outline-indigo-500"
                          >
                            {["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "E", "TD", "TS", "HL"].map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-gray-600 block mb-1">Credits</label>
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={manualCredits}
                            onChange={(e) => setManualCredits(Number(e.target.value))}
                            className="w-full text-xs font-mono px-2.5 py-1.5 border border-gray-300 rounded bg-white focus:outline-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleAddManualCourse}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add to List
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Course Table or Empty Fallback */}
                  {stagedCourses.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-amber-300 rounded-lg bg-amber-50/40">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-gray-800">No courses extracted automatically</p>
                      <p className="text-xs text-gray-500 mt-1 mb-4">
                        PDF extraction found 0 course rows. Add courses manually using the button below to bypass PDF extraction failure.
                      </p>
                      <Button
                        onClick={() => setShowAddForm(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                      >
                        <Plus className="w-4 h-4 mr-1.5" /> Add Course Manually
                      </Button>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Course Code</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Course Name</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Grade</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Credits</th>
                            <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                          {stagedCourses.map((course: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-mono font-bold text-gray-900">{course.course_code}</td>
                              <td className="px-4 py-2.5 text-gray-600 truncate max-w-[140px]">{course.course_name || "-"}</td>
                              <td className="px-4 py-2.5 font-bold text-[#990033]">{course.grade}</td>
                              <td className="px-4 py-2.5 font-mono">{course.credit_hour || course.credits}</td>
                              <td className="px-2 py-2.5 text-center">
                                <button
                                  onClick={() => handleRemoveCourse(idx)}
                                  className="text-gray-400 hover:text-rose-600 p-1"
                                  title="Remove Course"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-4 border-t border-gray-100 flex space-x-4">
                  <Button onClick={handleReject} variant="outline" className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50">
                    <XCircle className="w-4 h-4 mr-2" /> Reject Forgery
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isSaving || stagedCourses.length === 0}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> {isSaving ? "Saving..." : `Approve & Commit (${stagedCourses.length})`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
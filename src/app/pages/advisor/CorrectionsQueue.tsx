import React, { useState, useEffect } from "react";
import { Check, XCircle, Clock, CheckCircle2, FileText, Calendar, Eye, X } from "lucide-react";
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

  useEffect(() => { setLiveQueue(queue); }, [queue]);

  const pendingCount = liveQueue.filter((item) => item.processing_status === "Pending_Advisor_Approval").length;
  const approvedCount = liveQueue.filter((item) => item.processing_status === "Approved").length;

  const handleOpenAudit = async (doc: any) => {
    const { data } = db.storage.from("academic-slips").getPublicUrl(doc.file_path);
    setPdfUrl(data.publicUrl);
    setActiveAuditDoc(doc);
  };

  const handleReject = async () => {
    if (!activeAuditDoc) return;
    await db.from("uploaded_documents").update({ processing_status: "Rejected" }).eq("id", activeAuditDoc.id);
    setLiveQueue(prev => prev.map(item => item.id === activeAuditDoc.id ? { ...item, processing_status: "Rejected" } : item));
    setActiveAuditDoc(null);
  };

  const handleApprove = async () => {
    if (!activeAuditDoc || !activeAuditDoc.extracted_data) return;
    setIsSaving(true);
    
    try {
      const studentData = activeAuditDoc.extracted_data;
      const matchingStudent = roster.find((s) => s.id === activeAuditDoc.matric_no);
      
      // Route through FastAPI Zero-Waste engine for DAG verification & persistence into academic_records
      await api.finalizeApproval({
        document_id: activeAuditDoc.id,
        matric_number: activeAuditDoc.matric_no,
        student_name: matchingStudent ? matchingStudent.name : studentData.student_name,
        academic_session: studentData.academic_session || "2024/2025",
        semester: studentData.semester || 1,
        courses: studentData.courses || []
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

              <div className="w-1/2 p-6 overflow-y-auto bg-white">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Student Submitted Data</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-sm font-semibold">Course Code</th>
                        <th className="px-4 py-3 text-sm font-semibold">Grade</th>
                        <th className="px-4 py-3 text-sm font-semibold">Credits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activeAuditDoc.extracted_data?.courses?.map((course: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 font-mono text-sm">{course.course_code}</td>
                          <td className="px-4 py-3 font-bold text-[#990033]">{course.grade}</td>
                          <td className="px-4 py-3 font-mono text-sm">{course.credit_hour}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-8 flex space-x-4">
                  <Button onClick={handleReject} variant="outline" className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50">
                    <XCircle className="w-4 h-4 mr-2" /> Reject Forgery
                  </Button>
                  <Button onClick={handleApprove} disabled={isSaving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> {isSaving ? "Saving..." : "Approve & Commit"}
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
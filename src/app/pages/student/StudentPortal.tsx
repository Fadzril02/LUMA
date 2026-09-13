import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  GraduationCap, Upload, FileText, LogOut, Menu, X, 
  FileUp, BarChart, CheckCircle, Target, Edit3, AlertTriangle, Clock,
  Loader2, CheckCircle2, ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { Button, Input } from "../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../lib/supabase";
import { api } from "../../../lib/api";

import { StudentDashboardView } from "./StudentDashboardView";
import { AcademicHistoryView } from "./AcademicHistoryView";
import { DegreeAuditView } from "./DegreeAuditView";
import { CgpaCalculatorView } from "./CgpaCalculatorView";

export function StudentPortal() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [courseHistory, setCourseHistory] = useState<any[]>([]);
  const [creditProgress, setCreditProgress] = useState<any[]>([]);
  const [stats, setStats] = useState({ cgpa: "0.00", earned: 0, required: 130 });
  const [loadingData, setLoadingData] = useState(true);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");
  const [stagedData, setStagedData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Prevent tab close or navigation during active cold-start transcript extraction
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProcessing) {
        e.preventDefault();
        e.returnValue = "Document processing is underway. Leaving now may cause duplicate or corrupt uploads.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isProcessing]);

  useEffect(() => {
    // Profile must be loaded before we can fetch student data
    if (!profile?.matric_no) {
      setLoadingData(false);
      return;
    }

    const fetchDashboardData = async () => {
      setLoadingData(true);
      try {
        // ── Pending upload lockout check ────────────────────────────────────
        // Guarded with try/catch — uploaded_documents may not exist in all envs.
        try {
          const { data: pendingDoc } = await db
            .from('uploaded_documents')
            .select('id')
            .eq('matric_no', profile.matric_no)
            .eq('processing_status', 'Pending_Advisor_Approval')
            .maybeSingle();
          if (pendingDoc) setIsLockedOut(true);
        } catch {
          // uploaded_documents table may not exist; lockout defaults to false
        }

        // ── PRIORITY 2 FIX: Query `academic_records` (not the deleted `results` table) ──
        //
        // SECURITY BOUNDARY: RLS policy `academic_records_select` (migration 06)
        // enforces:  matric_no IN (SELECT matric_no FROM students WHERE user_id = auth.uid())
        // The server-side RLS, not this client filter, is what prevents cross-student leaks.
        //
        // The .eq("matric_no", ...) below is a PERFORMANCE HINT only — it narrows
        // the index scan and prevents the RLS fallback path from doing a full table scan.
        // Even if removed, RLS alone would return only this student's rows.
        const { data: resultsData, error: resultsError } = await db
          .from("academic_records")
          .select(
            "course_code, course_name, credits, grade, grade_point, semester, status"
          )
          // Performance hint (RLS is the actual security gate):
          .eq("matric_no", profile.matric_no)
          .order("semester", { ascending: true });

        if (resultsError) {
          console.error("[StudentPortal] academic_records fetch error:", resultsError.message, resultsError.details);
        }

        const historyMapped = (resultsData || []).map((row: any) => ({
          code: row.course_code,
          name: row.course_name || "Unknown Module",
          credits: row.credits || 0,
          grade: row.grade || "N/A",
          status: row.status,
          pointValue: row.grade_point || 0,
          session_semester: row.semester,
        }));

        setCourseHistory(historyMapped);

        let totalPoints = 0;
        let gradedCredits = 0;
        let totalEarnedCredits = 0;

        // The live schema CHECK constraint allows: 'Passed', 'Failed', 'Exempted', 'In-Progress'
        historyMapped.forEach((item) => {
          const passed = item.status === "Passed" || item.status === "Pass";
          if (passed) {
            totalEarnedCredits += item.credits;
            // Exempt courses (HL grade) do not contribute to GPA
            if (item.grade !== "HL" && item.grade !== "N/A" && item.pointValue > 0) {
              totalPoints += item.pointValue * item.credits;
              gradedCredits += item.credits;
            }
          }
        });

        const calculatedCgpa =
          gradedCredits > 0 ? (totalPoints / gradedCredits).toFixed(2) : "0.00";

        setStats({ cgpa: calculatedCgpa, earned: totalEarnedCredits, required: 130 });
        setCreditProgress([
          { name: "Syllabus Total", earned: totalEarnedCredits, total: 130 },
          {
            name: "Core Modules",
            earned: historyMapped.filter((c) => c.status === "Passed" || c.status === "Pass").length * 3,
            total: 90,
          },
        ]);
      } catch (err) {
        console.error("[StudentPortal] Dashboard load error:", err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchDashboardData();
  }, [profile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return;
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Please upload an official PDF academic slip (.pdf only).");
        return;
      }
      setSelectedFile(file);
      setUploadStatusMsg("");
      setUploadProgress(0);
    }
  };

  const handleUploadTranscript = async () => {
    if (isProcessing) return;
    if (!selectedFile) {
      toast.error("Please select a transcript PDF file first.");
      return;
    }
    if (!profile?.matric_no) {
      toast.error("Student profile not found. Please log in again.");
      return;
    }

    // UI Lockdown: Set isProcessing immediately on click
    setIsProcessing(true);
    setUploadProgress(15);
    setUploadStatusMsg("Uploading to secure vault...");

    try {
      const extension = selectedFile.name.split(".").pop() || "pdf";
      const fileName = `${profile.matric_no}_${Date.now()}.${extension}`;
      const filePath = `slips/${fileName}`;

      setUploadProgress(35);
      const { error: uploadErr } = await db.storage.from("academic-slips").upload(filePath, selectedFile);
      if (uploadErr) throw uploadErr;

      setUploadProgress(50);
      setUploadStatusMsg("Registering audit document entry...");

      const { data: docData, error: docErr } = await db.from("uploaded_documents").insert([{
        matric_no: profile.matric_no,
        file_name: selectedFile.name,
        file_path: filePath,
        processing_status: 'Pending_Student_Verification'
      }]).select().single();
      
      if (docErr) throw docErr;
      setActiveDocumentId(docData.id);

      setUploadProgress(70);
      setUploadStatusMsg("Analyzing Academic Data via AI (May take up to 60s)...");

      // Idempotency Safeguard: 75-second timeout limit against cold-start hangs
      const timeoutSafeguard = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Document extraction timed out after 75 seconds. The server cold-start took too long. Please retry."
              )
            ),
          75000
        )
      );

      const result = (await Promise.race([
        api.extractTranscript(filePath),
        timeoutSafeguard
      ])) as any;

      setUploadProgress(100);
      setUploadStatusMsg("Extraction Complete! Review required.");
      toast.success("Transcript parsed successfully! Review extracted courses.");

      setTimeout(() => {
        setStagedData(result.data);
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setUploadProgress(0);
        setIsVerificationModalOpen(true);
      }, 700);

    } catch (err: any) {
      console.error("[StudentPortal] upload error:", err);
      let friendlyError = "Failed to process document. Please try again.";
      if (err.message?.includes("timed out") || err.message?.includes("75 seconds")) {
        friendlyError = "Upload timeout (75s limit reached). Backend cold-start took too long. Please retry in a moment.";
      } else if (err.response?.data?.detail) {
        friendlyError = `Extraction failed: ${err.response.data.detail}`;
      } else if (err.message) {
        friendlyError = err.message;
      }
      toast.error(friendlyError);
      setUploadStatusMsg(`Error: ${friendlyError}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStagedDataChange = (index: number, field: string, value: string) => {
    const newData = { ...stagedData };
    newData.courses[index][field] = value.toUpperCase();
    setStagedData(newData);
  };

  const handleConfirmAndSave = async () => {
    if (!profile?.matric_no || !activeDocumentId) return;
    setIsSaving(true);
    try {
      // Inject the hidden fraud flag into the database
      const suspectedFraud = stagedData?.fraud_flag === true;

      const { error: updErr } = await db
        .from("uploaded_documents")
        .update({ 
          processing_status: 'Pending_Advisor_Approval',
          extracted_data: stagedData,
          fraud_flag: suspectedFraud
        })
        .eq("id", activeDocumentId);

      if (updErr) throw updErr;

      setIsVerificationModalOpen(false);
      setIsLockedOut(true);
      toast.success("Slip verified and sent to your Advisor for official approval!");
    } catch (err: any) {
      toast.error("Failed to submit ticket. Please try again.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button 
      onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }} 
      className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors tracking-tight ${
        activeTab === id 
          ? "bg-blue-900 text-white shadow-sm font-semibold" 
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  if (loadingData) return <div className="flex h-screen w-screen items-center justify-center bg-gray-50 text-blue-900 font-mono tracking-widest text-xs uppercase">LOADING SECURE PORTAL...</div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex font-sans text-gray-900 antialiased">
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-gray-200 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-900 flex items-center justify-center text-white shadow-sm">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base text-blue-900 tracking-tight leading-none block">LUMA</span>
            <span className="text-xs text-gray-400 font-normal">Student Portal</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavItem id="dashboard" icon={BarChart} label="Dashboard Snapshot" />
          <NavItem id="history" icon={FileText} label="Academic Timeline" />
          <NavItem id="audit" icon={CheckCircle} label="Degree Audit" />
          <NavItem id="whatif" icon={Target} label="Grade Predictor" />
        </nav>
        <div className="p-4 border-t border-gray-200 bg-gray-50/50">
          <button onClick={logout} className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center">
            <button className="lg:hidden mr-4" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6 text-gray-600" /></button>
            <h1 className="text-xl font-semibold text-gray-800 capitalize">Student Portal</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {isLockedOut ? (
              <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg flex items-center text-amber-800 text-sm font-medium shadow-sm">
                <Clock className="w-4 h-4 mr-2 text-amber-600" />
                Under Advisor Review
              </div>
            ) : (
              <Button 
                onClick={() => setIsUploadModalOpen(true)} 
                disabled={isProcessing}
                className="bg-blue-900 hover:bg-blue-800 text-white shadow-sm disabled:opacity-50"
              >
                <Upload className="w-4 h-4 mr-2" />Upload Slip
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-6xl mx-auto space-y-6">
              {activeTab === "dashboard" && <StudentDashboardView stats={stats} creditProgress={creditProgress} />}
              {activeTab === "history" && <AcademicHistoryView courseHistory={courseHistory} />}
              {activeTab === "audit" && <DegreeAuditView />}
              {activeTab === "whatif" && <CgpaCalculatorView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {isUploadModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!isProcessing) setIsUploadModalOpen(false);
            }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center space-x-2">
                  <FileUp className="w-5 h-5 text-blue-900" />
                  <h3 className="text-base font-semibold text-gray-900">Upload Academic Slip</h3>
                </div>
                <button 
                  disabled={isProcessing}
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Cold-start idempotency alert banner */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-800 flex items-start space-x-2">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="font-semibold text-amber-900">Cold Start Notice:</strong> Extraction service spins down when idle. First document upload may take 30–60s. Please keep this tab open.
                  </p>
                </div>

                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all relative ${
                  isProcessing 
                    ? "border-gray-200 bg-gray-50/50 cursor-not-allowed" 
                    : selectedFile 
                      ? "border-emerald-300 bg-emerald-50/20" 
                      : "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/10"
                }`}>
                  <FileUp className={`w-10 h-10 mx-auto mb-3 ${isProcessing ? "text-gray-300" : selectedFile ? "text-emerald-600" : "text-gray-400"}`} />
                  
                  <input 
                    type="file" 
                    className="hidden" 
                    id="file-uploader" 
                    accept=".pdf" 
                    disabled={isProcessing}
                    onChange={handleFileSelect} 
                  />

                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900 truncate max-w-xs mx-auto">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB • PDF Document
                      </p>
                      {!isProcessing && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            const input = document.getElementById("file-uploader") as HTMLInputElement | null;
                            if (input) input.value = "";
                          }}
                          className="text-xs text-red-600 hover:underline pt-1 inline-block"
                        >
                          Choose different file
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">Select your official UTM academic slip PDF</p>
                      <Button 
                        type="button"
                        disabled={isProcessing}
                        className="bg-blue-900 hover:bg-blue-800 text-white text-xs py-2 px-4 shadow-sm" 
                        onClick={() => document.getElementById("file-uploader")?.click()}
                      >
                        Browse PDF Files
                      </Button>
                    </div>
                  )}
                </div>

                {/* Progress Indicator */}
                {uploadProgress > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between text-xs font-mono font-bold">
                      <span className="text-gray-600 truncate mr-2">{uploadStatusMsg}</span>
                      <span className="text-blue-900 flex-shrink-0">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-900 h-full transition-all duration-500" 
                        style={{ width: `${uploadProgress}%` }} 
                      />
                    </div>
                  </div>
                )}

                {/* Submit Action Button with Mutability & Cold-Start Spinner */}
                <div className="pt-2">
                  <Button
                    type="button"
                    disabled={!selectedFile || isProcessing}
                    onClick={handleUploadTranscript}
                    className="w-full bg-blue-900 hover:bg-blue-800 text-white py-2.5 font-medium disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-all text-sm"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing Document (May take up to 60s)...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Transcript
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isVerificationModalOpen && stagedData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center space-x-2">
                  <Edit3 className="w-5 h-5 text-amber-600" />
                  <h3 className="text-lg font-bold text-gray-900">Verify AI Extraction</h3>
                </div>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="bg-blue-50 border border-blue-200 text-blue-900 text-sm p-4 rounded-lg mb-6 flex items-start">
                  <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-blue-700" />
                  <p>Check the AI's work. Fix any errors below before submitting to your advisor.</p>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Code</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Grade</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Credits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stagedData.courses.map((course: any, index: number) => (
                        <tr key={index}>
                          <td className="px-4 py-2"><Input value={course.course_code} onChange={(e) => handleStagedDataChange(index, "course_code", e.target.value)} className="font-mono text-sm max-w-[120px]" /></td>
                          <td className="px-4 py-2"><Input value={course.grade} onChange={(e) => handleStagedDataChange(index, "grade", e.target.value)} className="font-bold text-sm max-w-[80px]" /></td>
                          <td className="px-4 py-2 font-mono text-sm">{course.credit_hour}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <Button onClick={handleConfirmAndSave} disabled={isSaving} className="bg-blue-900 hover:bg-blue-800 text-white shadow-sm">
                  {isSaving ? "Submitting..." : <><CheckCircle className="w-4 h-4 mr-2"/> Submit to Advisor</>}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
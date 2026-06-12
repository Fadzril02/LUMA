import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  GraduationCap, Upload, FileText, LogOut, Menu, X, 
  FileUp, BarChart, CheckCircle, Target, Edit3, AlertTriangle 
} from "lucide-react";
import { Button, Input } from "../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../lib/supabase";

import { StudentDashboardView } from "./StudentDashboardView";
import { AcademicHistoryView } from "./AcademicHistoryView";
import { DegreeAuditView } from "./DegreeAuditView";
import { CgpaCalculatorView } from "./CgpaCalculatorView";

export function StudentPortal() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  
  // UI Layout States
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  
  // Dynamic Database Data States
  const [courseHistory, setCourseHistory] = useState<any[]>([]);
  const [creditProgress, setCreditProgress] = useState<any[]>([]);
  const [stats, setStats] = useState({ cgpa: "0.00", earned: 0, required: 130 });
  const [loadingData, setLoadingData] = useState(true);

  // File Upload & Staging State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");
  const [stagedData, setStagedData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Transactional Layer (Database Fetching)
  useEffect(() => {
    if (!profile?.matric_no) return;

    const fetchAcademicRecords = async () => {
      setLoadingData(true);
      try {
        const { data: resultsData, error: resultsErr } = await db
          .from("results")
          .select("*, course(*)")
          .eq("matric_no", profile.matric_no);

        if (resultsErr) throw resultsErr;

        const historyMapped = (resultsData || []).map((row: any) => ({
          code: row.course_code,
          name: row.course?.course_name || "Unknown Module",
          credits: row.course?.credit_hour || 0,
          grade: row.grade || "N/A",
          status: row.status,
          pointValue: row.point_value || 0,
          session_semester: row.session_semester
        }));
        
        setCourseHistory(historyMapped);

        let totalPoints = 0;
        let gradedCredits = 0;
        let totalEarnedCredits = 0;

        historyMapped.forEach((item) => {
          if (item.status === "Pass") {
            totalEarnedCredits += item.credits;
            if (item.grade !== "HL" && item.grade !== "N/A") {
              totalPoints += item.pointValue * item.credits;
              gradedCredits += item.credits;
            }
          }
        });

        const calculatedCgpa = gradedCredits > 0 ? (totalPoints / gradedCredits).toFixed(2) : "0.00";
        const requiredCredits = profile.intakes?.total_required_credits || 130;

        setStats({ cgpa: calculatedCgpa, earned: totalEarnedCredits, required: requiredCredits });
        setCreditProgress([
          { name: "Syllabus Total", earned: totalEarnedCredits, total: requiredCredits },
          { name: "Core Modules", earned: historyMapped.filter(c => c.status === "Pass").length * 3, total: 90 }, 
        ]);

      } catch (err) {
        console.error("Failed to query database:", err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchAcademicRecords();
  }, [profile]);

  // 2. Upload and Extract Pipeline
  const handleRealStorageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.matric_no) return;

    setUploadProgress(20);
    setUploadStatusMsg("Uploading to secure vault...");

    try {
      const extension = file.name.split(".").pop();
      const fileName = `${profile.matric_no}_${Date.now()}.${extension}`;
      const filePath = `slips/${fileName}`;

      const { error: uploadErr } = await db.storage.from("academic-slips").upload(filePath, file);
      if (uploadErr) throw uploadErr;

      setUploadProgress(50);
      setUploadStatusMsg("Triggering AI Extraction Engine...");

      // Call Python Backend
      const response = await fetch("http://localhost:8000/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matric_no: profile.matric_no, file_path: filePath }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Extraction failed.");

      setUploadProgress(100);
      setUploadStatusMsg("Extraction Complete! Opening Staging Area...");

      // Transition to Verification Modal
      setTimeout(() => {
        setStagedData(result.data);
        setIsUploadModalOpen(false);
        setUploadProgress(0);
        setUploadStatusMsg("");
        setIsVerificationModalOpen(true);
      }, 800);

    } catch (err: any) {
      console.error(err);
      setUploadStatusMsg(`Error: ${err.message}`);
    }
  };

  // 3. Edit Data in Staging
  const handleStagedDataChange = (index: number, field: string, value: string) => {
    const newData = [...stagedData];
    newData[index][field] = value.toUpperCase();
    setStagedData(newData);
  };

  // 4. Final Commit to Database
  const handleConfirmAndSave = async () => {
    if (!profile?.matric_no) return;
    setIsSaving(true);
    try {
      const { error: delErr } = await db.from("results").delete().eq("matric_no", profile.matric_no);
      if (delErr) throw delErr;

      const { error: insErr } = await db.from("results").insert(stagedData);
      if (insErr) throw insErr;

      setIsVerificationModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      alert("Failed to commit records.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Sidebar Navigation Component
  const NavItem = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button
      onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === id ? "bg-[#990033] text-white shadow-md" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  if (loadingData) {
    return <div className="flex h-screen w-screen items-center justify-center bg-[#F8F9FA] text-[#990033] font-mono text-xs tracking-widest">COMPUTING TRANSCRIPT...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* --- SIDEBAR --- */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-8 h-8 text-[#990033]" />
            <span className="font-bold text-base text-[#990033] leading-tight">SE Smart AA<br/><span className="text-xs text-gray-400 font-normal">Session: {profile?.name}</span></span>
          </div>
          <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6 text-gray-500" /></button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavItem id="dashboard" icon={BarChart} label="Dashboard Snapshot" />
          <NavItem id="history" icon={FileText} label="Academic Timeline" />
          <NavItem id="audit" icon={CheckCircle} label="Degree Audit" />
          <NavItem id="whatif" icon={Target} label="Grade Predictor" />
        </nav>
        
        <div className="p-4 border-t border-gray-100">
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center">
            <button className="lg:hidden mr-4" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6 text-gray-600" /></button>
            <h1 className="text-xl font-semibold text-gray-800 capitalize">
              {activeTab === 'dashboard' && 'Dashboard Snapshot'}
              {activeTab === 'history' && 'Academic Timeline'}
              {activeTab === 'audit' && 'Degree Progress Audit'}
              {activeTab === 'whatif' && 'Grade Predictor Engine'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={() => setIsUploadModalOpen(true)} className="bg-[#990033] hover:bg-[#80002A] text-white">
              <Upload className="w-4 h-4 mr-2" />Upload Slip
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="max-w-6xl mx-auto space-y-6">
              
              {/* 🧩 THE MODULAR ROUTER */}
              {activeTab === "dashboard" && <StudentDashboardView stats={stats} creditProgress={creditProgress} />}
              {activeTab === "history" && <AcademicHistoryView courseHistory={courseHistory} />}
              {activeTab === "audit" && <DegreeAuditView />}
              {activeTab === "whatif" && <CgpaCalculatorView />}
              
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {/* 1. Upload Modal */}
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Upload Slip</h3>
                <button onClick={() => setIsUploadModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className="border-2 border-dashed rounded-xl p-8 text-center bg-gray-50 hover:border-[#990033] hover:bg-red-50/10 transition-all relative">
                  <FileUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <input type="file" className="hidden" id="file-uploader-field" accept=".pdf" onChange={handleRealStorageUpload} />
                  <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => document.getElementById("file-uploader-field")?.click()}>Browse Files</Button>
                </div>
                {uploadProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono font-bold">
                      <span className="text-gray-600">{uploadStatusMsg}</span>
                      <span className="text-[#990033]">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#990033] h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* 2. Verification Modal */}
        {isVerificationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center space-x-2">
                  <Edit3 className="w-5 h-5 text-amber-600" />
                  <h3 className="text-lg font-bold text-gray-900">Verify Extracted Data</h3>
                </div>
                <button onClick={() => setIsVerificationModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-lg mb-6 flex items-start">
                  <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-amber-600" />
                  <p>Please review the extracted grades below. If the AI misread any text, you can edit the boxes directly before saving to your official ledger.</p>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Course Code</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Grade</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Sem / Session</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stagedData.map((course, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <Input 
                              value={course.course_code} 
                              onChange={(e) => handleStagedDataChange(index, "course_code", e.target.value)}
                              className="font-mono text-sm max-w-[120px]"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input 
                              value={course.grade} 
                              onChange={(e) => handleStagedDataChange(index, "grade", e.target.value)}
                              className="font-bold text-sm max-w-[80px] text-[#990033]"
                            />
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 font-mono">
                            {course.session_semester}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setIsVerificationModalOpen(false)}>Discard</Button>
                <Button 
                  onClick={handleConfirmAndSave} 
                  disabled={isSaving}
                  className="bg-[#990033] hover:bg-[#80002A] text-white"
                >
                  {isSaving ? "Saving to Database..." : <><CheckCircle className="w-4 h-4 mr-2"/> Confirm & Save Records</>}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
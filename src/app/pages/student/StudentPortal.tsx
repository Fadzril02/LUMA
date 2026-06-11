import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from "recharts";
import { 
  GraduationCap, Upload, FileText, AlertTriangle, LogOut, ChevronRight, Menu, X, FileUp
} from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input, Label } from "../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../lib/supabase";

export function StudentPortal() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  
  // UI Layout States
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  
  // Dynamic Database Data States
  const [courseHistory, setCourseHistory] = useState<any[]>([]);
  const [creditProgress, setCreditProgress] = useState<any[]>([]);
  const [stats, setStats] = useState({ cgpa: "0.00", earned: 0, required: 130 });
  const [loadingData, setLoadingData] = useState(true);

  // Correction Form Inputs State
  const [correctionForm, setCorrectionForm] = useState({ code: "", grade: "", remarks: "" });
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // File Upload Pipeline State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");

  // 1. Transactional Layer: Load Student Records from Database Live
  useEffect(() => {
    if (!profile?.matric_no) return;

    const fetchAcademicRecords = async () => {
      setLoadingData(true);
      try {
        // Query results and link master course structural catalog values
        const { data: resultsData, error: resultsErr } = await db
          .from("results")
          .select("*, course(*)")
          .eq("matric_no", profile.matric_no);

        if (resultsErr) throw resultsErr;

        // Process data array mapping
        const historyMapped = (resultsData || []).map((row: any) => ({
          code: row.course_code,
          name: row.course?.course_name || "Unknown Module",
          credits: row.course?.credit_hour || 0,
          grade: row.grade || "N/A",
          status: row.status,
          pointValue: row.point_value || 0
        }));
        
        setCourseHistory(historyMapped);

        // 2. Compute live analytical matrix metrics (CGPA & Progress Accumulation)
        let totalPoints = 0;
        let gradedCredits = 0;
        let totalEarnedCredits = 0;

        historyMapped.forEach((item) => {
          if (item.status === "Pass") {
            totalEarnedCredits += item.credits;
            // Unofficial pass marks like "HL" do not affect quality point sums
            if (item.grade !== "HL" && item.grade !== "N/A") {
              totalPoints += item.pointValue * item.credits;
              gradedCredits += item.credits;
            }
          }
        });

        const calculatedCgpa = gradedCredits > 0 ? (totalPoints / gradedCredits).toFixed(2) : "0.00";
        const requiredCredits = profile.intakes?.total_required_credits || 130;

        setStats({
          cgpa: calculatedCgpa,
          earned: totalEarnedCredits,
          required: requiredCredits
        });

        // 3. Map values dynamically into your Recharts chart data model
        // Spreads metrics cleanly into curriculum balance slots
        setCreditProgress([
          { name: "Syllabus Total", earned: totalEarnedCredits, total: requiredCredits },
          { name: "Core Modules", earned: historyMapped.filter(c => c.status === "Pass").length * 3, total: 90 }, 
        ]);

      } catch (err) {
        console.error("Failed to query database state records:", err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchAcademicRecords();
  }, [profile]);

  // 2. Transactional Layer: Submit Correction Request Entry to Ledger
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.matric_no || !correctionForm.code) return;

    setSubmittingCorrection(true);
    try {
      const { error } = await db.from("correction_requests").insert([
        {
          matric_no: profile.matric_no,
          course_code: correctionForm.code.toUpperCase(),
          expected_grade: correctionForm.grade.toUpperCase(),
          remarks: correctionForm.remarks,
          status: "Pending"
        }
      ]);

      if (error) throw error;
      
      // Clean up inputs and close context overlay modal container
      setCorrectionForm({ code: "", grade: "", remarks: "" });
      setIsCorrectionModalOpen(false);
      alert("Correction log logged successfully into system audit registry queue!");
    } catch (err: any) {
      alert(`Ledger transmission fault: ${err.message}`);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // 3. Transactional Layer: Real Cloud File Storage Upload Loop
  const handleRealStorageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.matric_no) return;

    setUploadProgress(10);
    setUploadStatusMsg("Opening network connection channel...");

    try {
      const extension = file.name.split(".").pop();
      const fileName = `${profile.matric_no}_${Date.now()}.${extension}`;
      const filePath = `slips/${fileName}`;

      setUploadProgress(40);
      setUploadStatusMsg("Streaming raw binary document payload to secure storage bucket...");

      // Upload file block to your live 'academic-slips' storage location
      const { error: uploadErr } = await db.storage
        .from("academic-slips")
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      setUploadProgress(70);
      setUploadStatusMsg("Writing ingestion transaction record to database queue...");

      // Log structural mapping index trace entry pointing to raw resource location
      const { data: docRow, error: dbErr } = await db
        .from("uploaded_documents")
        .insert([
          {
            matric_no: profile.matric_no,
            file_path: filePath,
            extracted_cgpa: null 
          }
        ])
        .select()
        .single();

      if (dbErr) throw dbErr;

      setUploadProgress(100);
      setUploadStatusMsg("Ingestion completed successfully! Forwarding to Option A FastAPI parser...");

      // Wait brief window to give clear confirmation indicator before refreshing view
      setTimeout(() => {
        setIsUploadModalOpen(false);
        setUploadProgress(0);
        setUploadStatusMsg("");
        // Instantly reload local list records from source to look for newly registered lines
        window.location.reload();
      }, 1200);

    } catch (err: any) {
      console.error("Storage streaming failure:", err);
      setUploadStatusMsg(`Pipeline Error: ${err.message}`);
    }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === id 
          ? "bg-[#990033] text-white shadow-md shadow-[#990033]/10" 
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  if (loadingData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F8F9FA] text-[#990033] font-mono text-xs tracking-widest">
        COMPUTING TRANSCRIPT ANALYTICS TREE...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar Layout */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-8 h-8 text-[#990033]" />
            <span className="font-bold text-base text-[#990033] leading-tight">SE Smart AA<br/><span className="text-xs text-gray-400 font-normal">Active Session: {profile?.name}</span></span>
          </div>
          <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6 text-gray-500" /></button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem id="dashboard" icon={BarChart} label="Dashboard" />
          <NavItem id="history" icon={FileText} label="Academic History" />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center">
            <button className="lg:hidden mr-4" onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6 text-gray-600" /></button>
            <h1 className="text-xl font-semibold text-gray-800 capitalize">{activeTab === 'dashboard' ? 'Academic Dashboard' : 'Academic History'}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" className="hidden sm:flex" onClick={() => setIsCorrectionModalOpen(true)}><AlertTriangle className="w-4 h-4 mr-2" />Correction Request</Button>
            <Button onClick={() => setIsUploadModalOpen(true)} className="bg-[#990033] hover:bg-[#80002A] text-white"><Upload className="w-4 h-4 mr-2" />Upload Slip</Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="max-w-6xl mx-auto space-y-6">
              
              {activeTab === "dashboard" && (
                <>
                  {/* Real Dynamic Stats Dashboard Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-t-4 border-t-[#990033]">
                      <CardContent className="pt-6">
                        <p className="text-sm font-medium text-gray-500 uppercase">Current CGPA Balance</p>
                        <div className="mt-2 flex items-baseline space-x-2">
                          <span className="text-4xl font-bold text-gray-900">{stats.cgpa}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md">Live Verified</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-t-4 border-t-[#FFCC00]">
                      <CardContent className="pt-6">
                        <p className="text-sm font-medium text-gray-500 uppercase">Credits Earned</p>
                        <div className="mt-2 flex items-baseline space-x-2">
                          <span className="text-4xl font-bold text-gray-900">{stats.earned}</span>
                          <span className="text-lg text-gray-500">/ {stats.required}</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full mt-4 overflow-hidden">
                          <div className="bg-[#990033] h-full rounded-full" style={{ width: `${(stats.earned / stats.required) * 100}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-t-4 border-t-gray-800">
                      <CardContent className="pt-6">
                        <p className="text-sm font-medium text-gray-500 uppercase">Program Enrollment</p>
                        <div className="mt-2"><Badge variant="success" className="text-xs px-2.5 py-1">Active SE Student</Badge></div>
                        <p className="text-xs text-gray-500 mt-4 truncate">Syllabus Template: {profile?.syllabus_type} Hierarchy</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Dynamic Analytics Recharts Block */}
                  <Card>
                    <CardHeader><CardTitle>Relational Curriculum Progression</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={creditProgress} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <RechartsTooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="earned" name="Credits Accumulated" fill="#990033" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="total" name="Total Syllabus Boundary" fill="#FFCC00" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {activeTab === "history" && (
                <Card>
                  <CardHeader><CardTitle>Live Extracted Academic Ledger Transcript</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/50">
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">Course Code</th>
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">Course Name</th>
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">Credits</th>
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">Grade Output</th>
                            <th className="px-4 py-3 text-sm font-semibold text-gray-600">State Guard Status</th>
                          </tr>
                        </thead> {/* Changed this line cleanly from </table> to </thead> */}
                        <tbody>
                          {courseHistory.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 font-mono">No active transcript records discovered. Click 'Upload Slip' above to initialize database injection files.</td></tr>
                          ) : (
                            courseHistory.map((item, idx) => (
                              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 font-semibold text-[#990033]">{item.code}</td>
                                <td className="px-4 py-3 text-gray-700 text-sm font-medium">{item.name}</td>
                                <td className="px-4 py-3 text-gray-600 text-sm">{item.credits} Credits</td>
                                <td className="px-4 py-3 font-bold text-gray-900">{item.grade}</td>
                                <td className="px-4 py-3">
                                  <Badge variant={item.status === 'Pass' ? 'success' : item.status === 'Fail' ? 'danger' : 'warning'}>
                                    {item.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table> {/* The table element correctly closes completely down here now */}
                    </div>
                  </CardContent>
                </Card>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Upload Document Modal Panel Block */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Upload Official Academic Slip</h3>
                <button onClick={() => setIsUploadModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className="border-2 border-dashed rounded-xl p-8 text-center bg-gray-50 hover:border-[#990033] hover:bg-red-50/10 transition-all relative">
                  <FileUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm font-medium text-gray-700">Select Unofficial Semester PDF</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">File maps securely to profile: {profile?.matric_no}</p>
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
                      <div className="bg-[#990033] h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Correction Audit Ingestion Request Modal */}
        {isCorrectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
              <form onSubmit={handleCorrectionSubmit}>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Log Academic Dispute Entry</h3>
                  <button type="button" onClick={() => setIsCorrectionModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start space-x-3 text-amber-800 text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p>Submitting writes an immutable request row referencing your matric code. Your assigned advisor ({profile?.advisors?.name || 'Faculty Office'}) will audit your verification slip before releasing status updates.</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Target Course Code</Label>
                    <Input required placeholder="e.g., SCSE1013" value={correctionForm.code} onChange={e => setCorrectionForm({...correctionForm, code: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label>Disputed Grade Outcome</Label>
                    <Input required placeholder="e.g., A-" value={correctionForm.grade} onChange={e => setCorrectionForm({...correctionForm, grade: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label>Justification Narrative Remarks</Label>
                    <textarea required className="w-full h-20 rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#990033]" placeholder="Provide a brief reason for the review query..." value={correctionForm.remarks} onChange={e => setCorrectionForm({...correctionForm, remarks: e.target.value})} />
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
                  <Button type="button" variant="ghost" onClick={() => setIsCorrectionModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submittingCorrection} className="bg-[#990033] hover:bg-[#80002A] text-white">{submittingCorrection ? "COMMITTING LOG..." : "Commit Dispute Request"}</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
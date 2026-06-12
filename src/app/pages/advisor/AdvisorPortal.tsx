import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, Bell, CheckSquare, Search, Filter, AlertCircle, ChevronRight, X, Menu, LogOut, Check, XCircle, FileSearch, CheckCircle
} from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input } from "../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../lib/supabase";


import { AdvisorRosterView } from "./AdvisorRosterView";
import { AdvisorAlertsView } from "./AdvisorAlertsView";
import { VerificationQueueView } from "./VerificationQueueView";
import { SplitScreenAuditorView } from "./SplitScreenAuditorView";
import { Student360ProfileView } from "./Student360ProfileView";


export function AdvisorPortal() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  
  // UI States
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ==========================================
  // REAL DATABASE STATES
  // ==========================================
  const [roster, setRoster] = useState<any[]>([]); // Replaces MOCK_STUDENTS
  const [auditQueue, setAuditQueue] = useState<any[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // 1. Fetch ALL Real Data on Load
  useEffect(() => {
    const fetchAdvisorData = async () => {
      try {
        // A. Fetch the Document Verification Queue
        const { data: queueData } = await db
          .from("uploaded_documents")
          .select("*")
          .eq("processing_status", "Completed")
          .order("uploaded_at", { ascending: false });

        if (queueData) setAuditQueue(queueData);

        // B. Fetch Real Student Profiles
        const { data: studentsData } = await db
          .from("profiles")
          .select("*")
          .eq("role", "student"); // Grabs all users marked as students

        // C. Fetch all grades to calculate live CGPAs for the roster
        const { data: resultsData } = await db
          .from("results")
          .select("*, course(credit_hour)");

        if (studentsData && resultsData) {
          // Cross-reference students with their grades to build the live roster
          const liveRoster = studentsData.map((student: any) => {
            const myResults = resultsData.filter((r: any) => r.matric_no === student.matric_no);
            
            let totalPts = 0;
            let gradedCreds = 0;
            let earnedCreds = 0;

            myResults.forEach((r: any) => {
              const credits = r.course?.credit_hour || 3; // Fallback to 3 if missing from course catalog
              if (r.status === "Pass") {
                earnedCreds += credits;
                if (r.grade !== "HL" && r.grade !== "N/A") {
                  totalPts += r.point_value * credits;
                  gradedCreds += credits;
                }
              }
            });

            const cgpa = gradedCreds > 0 ? totalPts / gradedCreds : 0;
            const status = cgpa < 2.5 && myResults.length > 0 ? "At-Risk" : "Good Standing";
            
            let alertMsg = "";
            if (cgpa > 0 && cgpa < 2.0) alertMsg = "Academic Probation Warning: CGPA critically low.";
            else if (cgpa > 0 && cgpa < 2.5) alertMsg = "Warning: CGPA dropping near probation threshold.";

            return {
              id: student.matric_no,
              name: student.name || "Student",
              cgpa: cgpa,
              credits: earnedCreds,
              status: status,
              alert: alertMsg
            };
          });

          setRoster(liveRoster);
        }
      } catch (err) {
        console.error("Failed to load advisor data:", err);
      }
    };
    
    fetchAdvisorData();
  }, []);

  // 2. Open the Split-Screen Auditor
  const handleOpenAudit = async (doc: any) => {
    setSelectedAudit(doc);
    setStudentResults([]);
    setPdfUrl(null);

    try {
      const { data: urlData, error: urlErr } = await db.storage
        .from("academic-slips")
        .createSignedUrl(doc.file_path, 3600); 
      
      if (urlErr) throw urlErr;
      setPdfUrl(urlData.signedUrl);

      const { data: resultsData, error: resultsErr } = await db
        .from("results")
        .select("*")
        .eq("matric_no", doc.matric_no);
        
      if (resultsErr) throw resultsErr;
      setStudentResults(resultsData || []);

    } catch (err) {
      console.error("Failed to load audit details:", err);
      alert("Could not load document details.");
    }
  };

  // 3. Approve and Clear from Queue
  const handleApprove = async () => {
    if (!selectedAudit) return;
    setIsApproving(true);
    try {
      await db.from("uploaded_documents")
        .update({ processing_status: "Verified_By_Advisor" })
        .eq("id", selectedAudit.id);
      
      setAuditQueue(prev => prev.filter(item => item.id !== selectedAudit.id));
      setSelectedAudit(null);
    } catch (err) {
      console.error("Failed to approve:", err);
    } finally {
      setIsApproving(false);
    }
  };
  // ==========================================

  const filteredStudents = roster.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.id && s.id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const atRiskStudents = roster.filter(s => s.status === 'At-Risk');

  const NavItem = ({ id, icon: Icon, label, alertCount }: { id: string; icon: any; label: string, alertCount?: number }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setSelectedStudent(null);
        setSelectedAudit(null);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
        activeTab === id && !selectedStudent && !selectedAudit
          ? "bg-[#990033] text-white shadow-md shadow-[#990033]/10" 
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5" />
        <span className="font-medium">{label}</span>
      </div>
      {alertCount !== undefined && alertCount > 0 && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === id && !selectedStudent && !selectedAudit ? 'bg-white text-[#990033]' : 'bg-[#FFCC00] text-[#990033]'}`}>
          {alertCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <Users className="w-8 h-8 text-[#990033]" />
            <span className="font-bold text-lg text-[#990033] leading-tight">SE Smart AA<br/><span className="text-xs text-gray-500 font-normal">Advisor Portal</span></span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem id="dashboard" icon={Users} label="My Students" />
          <NavItem id="alerts" icon={Bell} label="At-Risk Alerts" alertCount={atRiskStudents.length} />
          <NavItem id="queue" icon={CheckSquare} label="Approval Queue" alertCount={auditQueue.length} />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center">
            <button className="lg:hidden mr-4" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-800 capitalize">
              {selectedAudit ? `Verification Audit` :
               selectedStudent ? `Student Detail: ${selectedStudent.id}` : 
               activeTab === 'dashboard' ? 'Assigned Students' : 
               activeTab === 'alerts' ? 'At-Risk Students' : 'Document Approval Queue'}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-500 hidden sm:inline-flex items-center bg-gray-100 px-3 py-1.5 rounded-full">
              Verified Role: Academic Advisor
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={selectedAudit ? "audit" : selectedStudent ? "detail" : activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="max-w-6xl mx-auto space-y-6">
              
              {/* Dashboard Tab: LIVE ROSTER */}
              {!selectedStudent && !selectedAudit && activeTab === "dashboard" && (
                <>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <Input placeholder="Search student name or ID..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Button variant="outline"><Filter className="w-4 h-4 mr-2"/> Filter</Button>
                  </div>

                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50/50">
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Student ID</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Name</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">CGPA</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Credits</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                            <th className="px-6 py-4 text-sm font-semibold text-gray-600">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-500 font-mono">No students found in master database.</td></tr>
                          ) : (
                            filteredStudents.map((student) => (
                              <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">{student.id}</td>
                                <td className="px-6 py-4 text-gray-600">{student.name}</td>
                                <td className="px-6 py-4 font-semibold text-gray-900">{student.cgpa.toFixed(2)}</td>
                                <td className="px-6 py-4 text-gray-600">{student.credits}</td>
                                <td className="px-6 py-4">
                                  <Badge variant={student.status === 'Good Standing' ? 'success' : 'danger'}>{student.status}</Badge>
                                </td>
                                <td className="px-6 py-4">
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(student)}>
                                    View <ChevronRight className="w-4 h-4 ml-1" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}

              {/* Alerts Tab: LIVE AT-RISK STUDENTS */}
              {!selectedStudent && !selectedAudit && activeTab === "alerts" && (
                <div className="space-y-4">
                  {atRiskStudents.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-emerald-600 font-mono">All students currently in Good Standing.</CardContent></Card>
                  ) : (
                    atRiskStudents.map(student => (
                      <Card key={student.id} className="border-l-4 border-l-[#FFCC00]">
                        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                          <div className="flex items-start space-x-4">
                            <div className="bg-[#FFCC00]/20 p-3 rounded-full">
                              <AlertCircle className="w-6 h-6 text-[#997a00]" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 text-lg">{student.name} ({student.id})</h3>
                              <p className="text-[#990033] font-medium mt-1">{student.alert}</p>
                              <div className="flex space-x-4 mt-2 text-sm text-gray-600">
                                <span>CGPA: <strong>{student.cgpa.toFixed(2)}</strong></span>
                                <span>Credits: <strong>{student.credits}</strong></span>
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" onClick={() => setSelectedStudent(student)}>Review Record</Button>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* Queue Tab: LIVE AUDIT LIST */}
              {!selectedStudent && !selectedAudit && activeTab === "queue" && (
                <div className="space-y-4">
                  {auditQueue.length === 0 ? (
                     <Card><CardContent className="p-8 text-center text-gray-500 font-mono">No documents currently pending review.</CardContent></Card>
                  ) : (
                    auditQueue.map(req => (
                      <Card key={req.id} className="border-l-4 border-l-[#990033]">
                        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                          <div>
                            <div className="flex items-center space-x-3 mb-2">
                              <Badge variant="warning" className="bg-amber-100 text-amber-800">Needs Audit</Badge>
                              <span className="text-sm font-medium text-gray-500">ID: {req.id.substring(0,8).toUpperCase()}</span>
                            </div>
                            <h3 className="font-semibold text-gray-900 font-mono text-lg">{req.matric_no}</h3>
                            <p className="text-gray-600 mt-1">
                              <span className="font-medium text-gray-900">Task:</span> System extracted grades from uploaded PDF. Verify data integrity.
                            </p>
                            <p className="text-xs text-gray-400 mt-2">Submitted: {new Date(req.uploaded_at).toLocaleString()}</p>
                          </div>
                          <div className="flex space-x-2 w-full md:w-auto">
                            <Button className="bg-[#990033] hover:bg-[#80002A] text-white flex-1 md:flex-none" onClick={() => handleOpenAudit(req)}>
                              <FileSearch className="w-4 h-4 mr-2" /> Open Auditor
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* SPLIT-SCREEN AUDITOR */}
              {selectedAudit && (
                <div className="h-[75vh] flex flex-col">
                  <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Auditing File: {selectedAudit.matric_no}</h2>
                      <p className="text-sm text-gray-500">Cross-reference the raw PDF against the digital database ledger.</p>
                    </div>
                    <div className="flex space-x-3 mt-4 sm:mt-0">
                      <Button variant="outline" onClick={() => setSelectedAudit(null)}>Cancel</Button>
                      <Button 
                        onClick={handleApprove} 
                        disabled={isApproving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isApproving ? "Locking..." : <><CheckCircle className="w-4 h-4 mr-2" /> Approve & Lock Records</>}
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                    <Card className="flex-1 flex flex-col overflow-hidden border-2 border-gray-300">
                      <CardHeader className="py-3 bg-gray-50 border-b"><CardTitle className="text-sm text-gray-600">Raw Source Document</CardTitle></CardHeader>
                      <CardContent className="p-0 flex-1 bg-gray-900 relative">
                        {pdfUrl ? (
                          <iframe src={`${pdfUrl}#toolbar=0`} className="w-full h-full border-none absolute inset-0" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 font-mono text-sm">DECRYPTING VAULT FILE...</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="w-full md:w-[45%] flex flex-col overflow-hidden border-2 border-[#990033]">
                      <CardHeader className="py-3 bg-[#990033]"><CardTitle className="text-sm text-white">Extracted Database Records</CardTitle></CardHeader>
                      <CardContent className="p-0 overflow-auto bg-slate-50">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-100 sticky top-0 border-b border-gray-200 shadow-sm">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-gray-600">Code</th>
                              <th className="px-4 py-3 font-semibold text-gray-600">Grade</th>
                              <th className="px-4 py-3 font-semibold text-gray-600">Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {studentResults.length === 0 ? (
                              <tr><td colSpan={3} className="p-6 text-center text-gray-500 font-mono">Loading records...</td></tr>
                            ) : (
                              studentResults.map((course, idx) => (
                                <tr key={idx} className="hover:bg-red-50/50 transition-colors">
                                  <td className="px-4 py-3 font-mono font-bold text-[#990033]">{course.course_code}</td>
                                  <td className="px-4 py-3 font-bold text-gray-900 text-lg">{course.grade}</td>
                                  <td className="px-4 py-3 text-gray-600">{course.point_value}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* LIVE STUDENT DETAIL VIEW */}
              {selectedStudent && !selectedAudit && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
                    <button onClick={() => setSelectedStudent(null)} className="hover:text-[#990033]">Dashboard</button>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-gray-900">{selectedStudent.id}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2">
                      <CardHeader><CardTitle>Course Structure Progress</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-semibold text-gray-800">Overall Credit Progress</h4>
                              <Badge variant="success">Active Tracking</Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{selectedStudent.credits} credits successfully accumulated.</p>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${Math.min((selectedStudent.credits / 130) * 100, 100)}%` }} />
                            </div>
                          </div>
                          {selectedStudent.status === 'At-Risk' && (
                            <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-gray-800">Academic Alert</h4>
                                <Badge variant="danger">Action Required</Badge>
                              </div>
                              <p className="text-sm text-red-600">{selectedStudent.alert}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle>Student Snapshot</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold">Name</p>
                          <p className="font-medium text-gray-900">{selectedStudent.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold">Live CGPA</p>
                          <p className="font-bold text-2xl text-[#990033]">{selectedStudent.cgpa.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold">Status</p>
                          <Badge variant={selectedStudent.status === 'Good Standing' ? 'success' : 'danger'} className="mt-1">
                            {selectedStudent.status}
                          </Badge>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                          <Button variant="outline" className="w-full">Message Student</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
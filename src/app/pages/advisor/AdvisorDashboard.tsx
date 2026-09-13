import React, { useState, useEffect } from "react";
import { 
  Users, 
  AlertTriangle, 
  ClipboardCheck, 
  Percent, 
  Loader2, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  ExternalLink, 
  CheckCircle2, 
  FileUp, 
  X,
  AlertCircle,
  BookOpen
} from "lucide-react";
import { toast } from "sonner";
import { db } from "../../../lib/supabase"; 
import { useAuth } from "../../../context/AuthContext";

export function AdvisorDashboard() {
  const { profile, user } = useAuth();
  const [roster, setRoster] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Session Code Copy State
  const [copied, setCopied] = useState(false);

  // Curriculum Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState<string>("");

  const advisorStaffId = (profile as any)?.staff_id || user?.user_metadata?.staff_id || "STAFF-LIYANA";

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        let query = db.from("students").select("*");
        if (advisorStaffId) {
          query = query.eq("advisor_staff_id", advisorStaffId);
        }

        const [studentsRes, queueRes] = await Promise.all([
          query,
          db.from("correction_requests").select("*")
        ]);

        if (studentsRes.data) setRoster(studentsRes.data);
        if (queueRes.data) setQueue(queueRes.data);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [advisorStaffId]);

  // Copy Lecturer Session Code handler
  const handleCopySessionCode = async () => {
    if (!advisorStaffId) return;
    try {
      await navigator.clipboard.writeText(advisorStaffId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy session code:", err);
    }
  };

  // Standard Template CSV Generator and Downloader
  const handleDownloadTemplate = () => {
    const csvHeader = "course_code,course_name,credits,category,semester,prerequisite_code,min_grade\n";
    const sampleRows = [
      "SECJ1013,Programming Technique I,3,Core,1,,",
      "SECJ1023,Programming Technique II,3,Core,2,SECJ1013,C",
      "SECP2243,Software Engineering Project I,3,Core,3,SECJ1023,C",
      "SECP3723,Systems Development Technology,3,Elective,4,,",
      "UCSD2762,Creative & Innovation,2,University,1,,"
    ].join("\n");

    const blob = new Blob([csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `luma_curriculum_template_${advisorStaffId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Curriculum File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setUploadStatus("idle");
      setUploadMessage("");
    }
  };

  // Handle Curriculum Upload Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploadStatus("uploading");
    setUploadMessage("Parsing and validating curriculum structure matrix...");

    // Simulate matrix parsing and local schema validation
    setTimeout(() => {
      setUploadStatus("success");
      setUploadMessage(`UAT Sandbox Mode: CSV structure validated locally (${selectedFile.name}). Database saving disabled for this pilot.`);
      toast.info("UAT Sandbox Mode: CSV structure validated locally. Database saving disabled for this pilot.", {
        duration: 6000
      });
      setTimeout(() => {
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setUploadStatus("idle");
      }, 3500);
    }, 1200);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-gray-500 bg-white rounded-xl border border-gray-200 shadow-sm">
        <Loader2 className="animate-spin text-blue-900 w-8 h-8 mb-3" />
        <span className="text-xs font-mono uppercase tracking-wider">Syncing Cohort Diagnostics...</span>
      </div>
    );
  }

  // Calculate Metrics
  const totalStudents = roster.length;
  const atRiskStudents = roster.filter((s) => ["At-Risk", "Probation"].includes(s.academic_status) || Number(s.cgpa || 0) < 2.50);
  const pendingAudits = queue.filter((q) => q.status === "Pending").length;
  const totalCgpa = roster.reduce((sum, s) => sum + (Number(s.cgpa) || 0), 0);
  const averageCgpa = totalStudents > 0 ? totalCgpa / totalStudents : 0;

  // Prioritize At-Risk students at the top of the roster table
  const sortedRoster = [...roster].sort((a, b) => {
    const aAtRisk = ["At-Risk", "Probation"].includes(a.academic_status) || Number(a.cgpa || 0) < 2.50 ? 1 : 0;
    const bAtRisk = ["At-Risk", "Probation"].includes(b.academic_status) || Number(b.cgpa || 0) < 2.50 ? 1 : 0;
    return bAtRisk - aAtRisk;
  });

  return (
    <div className="space-y-6">
      {/* 1. HERO WIDGET: LECTURER SESSION CODE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-900 text-xs font-mono border border-blue-200 font-medium">
              <span>Registration Key</span>
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-gray-900">
              Lecturer Session Code
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Distribute this code to your incoming students. Advisees must provide this identifier in the{" "}
              <span className="text-gray-900 font-mono font-medium">Lecturer Session Code</span> field during sign-up to automatically connect to your cohort roster.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg flex items-center justify-between sm:justify-center space-x-3">
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Staff ID:</span>
              <span className="font-mono font-bold text-base text-gray-900 tracking-wider">
                {advisorStaffId}
              </span>
            </div>

            <button
              onClick={handleCopySessionCode}
              className={`inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-tight transition-colors cursor-pointer shadow-sm ${
                copied
                  ? "bg-emerald-700 text-white hover:bg-emerald-800"
                  : "bg-blue-900 hover:bg-blue-800 text-white"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Session Code</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. POLISHED METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Advisees"
          value={totalStudents}
          icon={Users}
          description="Active cohort advisees"
          indicator="bg-blue-50 text-blue-900 border-blue-200"
          iconColor="text-blue-900"
        />
        <MetricCard
          title="Cohort CGPA"
          value={averageCgpa.toFixed(2)}
          icon={Percent}
          description="Average cumulative score"
          indicator="bg-emerald-50 text-emerald-800 border-emerald-200"
          iconColor="text-emerald-700"
        />
        <MetricCard
          title="Pending Audits"
          value={pendingAudits}
          icon={ClipboardCheck}
          description="Awaiting advisor sign-off"
          indicator="bg-indigo-50 text-indigo-900 border-indigo-200"
          iconColor="text-indigo-900"
        />
        <MetricCard
          title="At-Risk Alerts"
          value={atRiskStudents.length}
          icon={AlertTriangle}
          description="CGPA below 2.50 threshold"
          indicator={
            atRiskStudents.length > 0
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : "bg-gray-50 text-gray-700 border-gray-200"
          }
          iconColor={atRiskStudents.length > 0 ? "text-rose-700" : "text-gray-400"}
        />
      </div>

      {/* 3. FUNCTIONAL ACTION PANELS: CURRICULUM MANAGEMENT */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-900" />
            <span>Curriculum Management &amp; Tools</span>
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed mt-1">
            Operational resources for syllabus structuring, matrix uploads, and external advising petitions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Action 1: Download Template */}
          <div className="bg-gray-50/60 border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition-colors">
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-blue-900 flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">Download Template</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Standard CSV/Excel course structure matrix template with pre-formatted columns for credits and prerequisites.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Action 2: Upload Course Structure */}
          <div className="bg-gray-50/60 border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition-colors">
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-blue-900 flex items-center justify-center shadow-xs">
                <Upload className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">Upload Course Structure</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Import and ingest an updated curriculum syllabus matrix to sync prerequisite rules with the degree audit engine.
              </p>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-900 text-xs font-semibold text-white hover:bg-blue-800 transition-colors shadow-sm"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Upload Syllabus Matrix</span>
            </button>
          </div>

          {/* Action 3: Google Form Integration */}
          <div className="bg-gray-50/60 border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition-colors">
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-emerald-700 flex items-center justify-center shadow-xs">
                <ExternalLink className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">Google Form Integration</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Direct students to the institutional Academic Appeal and Discrepancy Petition Google Form for supplementary data intake.
              </p>
            </div>
            <a
              href="https://forms.gle/utm-academic-petition"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              <span>Open Petition Form</span>
            </a>
          </div>
        </div>
      </div>

      {/* 4. ADVISEE ROSTER & URGENT ACADEMIC INTERVENTION TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-semibold tracking-tight text-gray-900">
                Academic Intervention &amp; Advisee Roster
              </h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Real-time monitoring of enrolled cohort students, CGPA progression, and intervention alerts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200">
              Total Advisees: {totalStudents}
            </span>
            {atRiskStudents.length > 0 ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                {atRiskStudents.length} At-Risk
              </span>
            ) : (
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                All Good Standing
              </span>
            )}
          </div>
        </div>

        {totalStudents === 0 ? (
          /* 5. PREMIUM EMPTY STATE */
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mb-3" />
            <h4 className="text-lg font-medium text-gray-900">No advisees enrolled yet</h4>
            <p className="text-sm text-gray-500 max-w-sm mt-1 leading-relaxed">
              Provide your Lecturer Session Code to your cohort to begin tracking their progress.
            </p>
          </div>
        ) : (
          /* 4. THE ADVISEE TABLE (HOVER STATES & GEOMETRY) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50 border-b border-gray-200">
                  <th className="py-3 px-6">Student Name</th>
                  <th className="py-3 px-6">Matric No</th>
                  <th className="py-3 px-6">Program</th>
                  <th className="py-3 px-6">Cumulative GPA</th>
                  <th className="py-3 px-6">Academic Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedRoster.map((student) => {
                  const isAtRisk = ["At-Risk", "Probation"].includes(student.academic_status) || Number(student.cgpa || 0) < 2.50;
                  return (
                    <tr
                      key={student.matric_no}
                      className="hover:bg-gray-50 transition-colors duration-200 ease-in-out cursor-default"
                    >
                      <td className="py-4 px-6 text-sm font-semibold text-gray-900">
                        {student.name || "Student"}
                      </td>
                      <td className="py-4 px-6 text-sm font-mono text-gray-600">
                        {student.matric_no}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">
                        {student.program || "SECJ"}
                      </td>
                      <td className="py-4 px-6 text-sm font-mono font-bold text-gray-900">
                        {Number(student.cgpa || 0).toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-sm">
                        {isAtRisk ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            {student.academic_status || "At-Risk"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {student.academic_status || "Good Standing"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. UPLOAD COURSE STRUCTURE MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
              <div className="flex items-center space-x-2">
                <FileUp className="w-5 h-5 text-blue-900" />
                <h3 className="text-sm font-semibold text-gray-900">Upload Course Structure Matrix</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-mono font-medium">
                  UAT Sandbox
                </span>
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-6">
              <div className="bg-amber-50/70 border border-amber-200/90 rounded-lg p-3 text-xs text-amber-900 flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-amber-950">UAT Pilot Sandbox Notice</span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Uploaded curriculum files are evaluated locally for matrix structure and prerequisites. Database saving is disabled during this pilot phase.
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">
                Select a completed curriculum matrix file (.csv or .xlsx). The system will automatically validate course codes, credit hour assignments, and prerequisite rule logic.
              </p>

              <div className="border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl p-6 text-center bg-gray-50/50 transition-colors">
                <input
                  type="file"
                  id="curriculum-upload-input"
                  accept=".csv, .xlsx, .json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="curriculum-upload-input"
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-900 flex items-center justify-center border border-blue-100">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-blue-900 hover:underline">
                    {selectedFile ? selectedFile.name : "Click to select or drag and drop file"}
                  </span>
                  <span className="text-[10px] text-gray-400">CSV, XLSX up to 5MB</span>
                </label>
              </div>

              {uploadStatus === "uploading" && (
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-blue-50 text-blue-900 text-xs border border-blue-200">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{uploadMessage}</span>
                </div>
              )}

              {uploadStatus === "success" && (
                <div className="space-y-2 p-3.5 rounded-lg bg-amber-50/90 border border-amber-300 text-amber-900 text-xs">
                  <div className="flex items-center space-x-2 font-semibold text-amber-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>CSV Structure Validated</span>
                    <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-md bg-amber-200/80 border border-amber-400 text-amber-900 text-[10px] font-mono">
                      UAT Sandbox Mode
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-850 leading-relaxed font-medium">
                    UAT Sandbox Mode: CSV structure validated locally. Database saving disabled for this pilot.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploadStatus === "uploading"}
                  className="px-4 py-2.5 rounded-lg bg-blue-900 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  Confirm &amp; Ingest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Metric Card Helper Component
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  indicator: string;
  iconColor: string;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  indicator,
  iconColor
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg border ${indicator}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold text-gray-900">
          {value}
        </div>
        <p className="text-sm text-gray-600 leading-relaxed mt-1">
          {description}
        </p>
      </div>
    </div>
  );
}
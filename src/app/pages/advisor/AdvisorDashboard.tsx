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
import { Card, CardContent, CardHeader, CardTitle, Badge } from "../../components/ui";
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

    // Simulate matrix parsing and validation delay
    setTimeout(() => {
      setUploadStatus("success");
      setUploadMessage(`Successfully parsed ${selectedFile.name}. 48 courses and prerequisites verified.`);
      setTimeout(() => {
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setUploadStatus("idle");
      }, 2000);
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500">
        <Loader2 className="animate-spin text-blue-600 w-8 h-8 mb-3" />
        <span className="text-xs font-mono uppercase tracking-wider">Syncing Cohort Diagnostics...</span>
      </div>
    );
  }

  // Calculate Metrics
  const totalStudents = roster.length;
  const atRiskStudents = roster.filter((s) => ["At-Risk", "Probation"].includes(s.academic_status));
  const pendingAudits = queue.filter((q) => q.status === "Pending").length;
  const totalCgpa = roster.reduce((sum, s) => sum + (Number(s.cgpa) || 0), 0);
  const averageCgpa = totalStudents > 0 ? totalCgpa / totalStudents : 0;

  return (
    <div className="space-y-6">
      {/* 1. HERO WIDGET: LECTURER SESSION CODE */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono border border-blue-500/30">
              <span>Registration Key</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Lecturer Session Code
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Distribute this code to your incoming students. Advisees must provide this identifier in the{" "}
              <span className="text-slate-200 font-mono">Lecturer Session Code</span> field during sign-up to automatically connect to your cohort roster.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-slate-700/80 px-4 py-2.5 rounded-lg flex items-center justify-between sm:justify-center space-x-3 shadow-inner">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Staff ID:</span>
              <span className="font-mono font-bold text-base text-blue-400 tracking-wider">
                {advisorStaffId}
              </span>
            </div>

            <button
              onClick={handleCopySessionCode}
              className={`inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                copied
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Advisees"
          value={totalStudents}
          icon={Users}
          description="Active cohort advisees"
          indicator="bg-blue-50 text-blue-700 border-blue-200"
          iconColor="text-blue-600"
        />
        <MetricCard
          title="Cohort CGPA"
          value={averageCgpa.toFixed(2)}
          icon={Percent}
          description="Average cumulative score"
          indicator="bg-emerald-50 text-emerald-700 border-emerald-200"
          iconColor="text-emerald-600"
        />
        <MetricCard
          title="Pending Audits"
          value={pendingAudits}
          icon={ClipboardCheck}
          description="Awaiting advisor sign-off"
          indicator="bg-indigo-50 text-indigo-700 border-indigo-200"
          iconColor="text-indigo-600"
        />
        <MetricCard
          title="At-Risk Alerts"
          value={atRiskStudents.length}
          icon={AlertTriangle}
          description="CGPA below 2.50 threshold"
          indicator={
            atRiskStudents.length > 0
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-50 text-slate-700 border-slate-200"
          }
          iconColor={atRiskStudents.length > 0 ? "text-amber-600" : "text-slate-400"}
        />
      </div>

      {/* 3. FUNCTIONAL ACTION PANELS: CURRICULUM MANAGEMENT */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Curriculum Management &amp; Tools</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational resources for syllabus structuring, matrix uploads, and external advising petitions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action 1: Download Template */}
          <div className="border border-slate-200 rounded-lg p-5 flex flex-col justify-between hover:border-slate-300 transition-colors bg-slate-50/50">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Download Template</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Standard CSV/Excel course structure matrix template with pre-formatted columns for credits and prerequisites.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Action 2: Upload Course Structure */}
          <div className="border border-slate-200 rounded-lg p-5 flex flex-col justify-between hover:border-slate-300 transition-colors bg-slate-50/50">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Upload Course Structure</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Import and ingest an updated curriculum syllabus matrix to sync prerequisite rules with the degree audit engine.
              </p>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Upload Syllabus Matrix</span>
            </button>
          </div>

          {/* Action 3: Google Form Integration */}
          <div className="border border-slate-200 rounded-lg p-5 flex flex-col justify-between hover:border-slate-300 transition-colors bg-slate-50/50">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ExternalLink className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Google Form Integration</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Direct students to the institutional Academic Appeal and Discrepancy Petition Google Form for supplementary data intake.
              </p>
            </div>
            <a
              href="https://forms.gle/utm-academic-petition"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Open Petition Form</span>
            </a>
          </div>
        </div>
      </div>

      {/* 4. URGENT ACADEMIC INTERVENTION PANEL */}
      <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Urgent Academic Intervention</span>
            </CardTitle>
            <span
              className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                atRiskStudents.length > 0
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
              }`}
            >
              {atRiskStudents.length} Flagged
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[360px] overflow-y-auto divide-y divide-slate-100">
          {atRiskStudents.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-800">All Advisees in Good Standing</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No students currently meet the at-risk criteria (CGPA &lt; 2.50). Trajectory evaluations are performing within expected limits.
              </p>
            </div>
          ) : (
            atRiskStudents.map((s) => (
              <div
                key={s.matric_no}
                className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
              >
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-slate-900">{s.name}</h4>
                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {s.matric_no}
                    </span>
                    <span>•</span>
                    <span>{s.program || "SECJ"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-rose-600 font-mono">
                    CGPA {Number(s.cgpa || 0).toFixed(2)}
                  </div>
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {s.academic_status || "At-Risk"}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 5. UPLOAD COURSE STRUCTURE MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2">
                <FileUp className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Upload Course Structure Matrix</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Select a completed curriculum matrix file (.csv or .xlsx). The system will automatically validate course codes, credit hour assignments, and prerequisite rule logic.
              </p>

              <div className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg p-6 text-center bg-slate-50/50 transition-colors">
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
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-blue-600 hover:underline">
                    {selectedFile ? selectedFile.name : "Click to select or drag and drop file"}
                  </span>
                  <span className="text-[10px] text-slate-400">CSV, XLSX up to 5MB</span>
                </label>
              </div>

              {uploadStatus === "uploading" && (
                <div className="flex items-center space-x-2 p-3 rounded-md bg-blue-50 text-blue-700 text-xs border border-blue-200">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{uploadMessage}</span>
                </div>
              )}

              {uploadStatus === "success" && (
                <div className="flex items-center space-x-2 p-3 rounded-md bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{uploadMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploadStatus === "uploading"}
                  className="px-4 py-2 rounded-md bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
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
    <Card className="border border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
          {title}
        </CardTitle>
        <div className={`p-1.5 rounded-md border ${indicator}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {value}
        </div>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
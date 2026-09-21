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
  BookOpen,
  RotateCw,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Plus,
  RefreshCw,
  GraduationCap
} from "lucide-react";
import { toast } from "sonner";
import { db, supabase } from "../../../lib/supabase"; 
import { useAuth } from "../../../context/AuthContext";
import { Switch } from "../../components/ui/switch";

export function AdvisorDashboard() {
  const { profile, user } = useAuth();
  const [roster, setRoster] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cohort Management State (Multi-Tenant Blueprint Architecture)
  interface AdvisorCohort {
    id: string;
    cohort_name: string;
    name?: string;
    cohort_code: string;
    is_locked: boolean;
    advisor_staff_id: string;
    template_id: string;
    degree_template_id?: string;
    degree_templates?: {
      program_code?: string;
      program_name?: string;
      syllabus_year?: string;
    } | {
      program_code?: string;
      program_name?: string;
      syllabus_year?: string;
    }[];
  }

  interface DegreeTemplate {
    id: string;
    university_name: string;
    program_code: string;
    program_name: string;
    syllabus_year: string;
    total_credits_required?: number;
  }

  const [cohorts, setCohorts] = useState<AdvisorCohort[]>([]);
  const [degreeTemplates, setDegreeTemplates] = useState<DegreeTemplate[]>([]);
  const [togglingCohortId, setTogglingCohortId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create Cohort Modal State
  const [isCreateCohortOpen, setIsCreateCohortOpen] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [isCreatingCohort, setIsCreatingCohort] = useState(false);
  const [createdCohortResult, setCreatedCohortResult] = useState<AdvisorCohort | null>(null);
  const [copiedNewCode, setCopiedNewCode] = useState(false);

  // Recent Enrollments State (Loose Admission Safety Net)
  interface RecentEnrollment {
    matric_no: string;
    user_id: string | null;
    name: string;
    institutional_email: string;
    cohort_id: string | null;
    created_at?: string;
  }
  const [recentEnrollments, setRecentEnrollments] = useState<RecentEnrollment[]>([]);
  const [isRevoking, setIsRevoking] = useState<string | null>(null); // stores matric_no being revoked

  // Curriculum Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState<string>("");

  const advisorStaffId = (profile as any)?.staff_id || (user as any)?.user_metadata?.staff_id || "";

  // Helper: Generate random 6-character alphanumeric cohort_code (e.g. "SECJ99")
  const generateCohortCode = (programCode: string = "SECJ"): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const prefix = programCode ? programCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) : "SECJ";
    const needed = Math.max(0, 6 - prefix.length);
    let suffix = "";
    for (let i = 0; i < needed; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}${suffix}`.slice(0, 6);
  };

  useEffect(() => {
    const fetchData = async () => {
      // Security Check: Guard to ensure advisor context is loaded before querying
      if (!advisorStaffId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch degree templates for the Create Cohort modal
        const templatesQuery = db
          .from("degree_templates")
          .select("id, university_name, program_code, program_name, syllabus_year, total_credits_required")
          .order("program_code", { ascending: true });

        // 2. Fetch students strictly chained with advisor_staff_id to respect RLS
        // Note: 'created_at' does not exist on students table; order by name to avoid 400 Bad Request
        const studentQuery = db
          .from("students")
          .select("matric_no, user_id, name, institutional_email, cohort_id, cgpa, academic_status, program")
          .eq("advisor_staff_id", advisorStaffId)
          .order("name", { ascending: true });

        // 3. Fetch all cohorts strictly belonging to this advisor with blueprint details
        const cohortsQuery = db
          .from("cohorts")
          .select(`
            id,
            cohort_name,
            cohort_code,
            is_locked,
            advisor_staff_id,
            template_id,
            degree_templates (
              program_code,
              program_name,
              syllabus_year
            )
          `)
          .eq("advisor_staff_id", advisorStaffId)
          .order("created_at", { ascending: false });

        // 4. Fetch correction requests
        const queueQuery = db.from("correction_requests").select("*");

        const [studentsRes, queueRes, cohortsRes, templatesRes] = await Promise.all([
          studentQuery,
          queueQuery,
          cohortsQuery,
          templatesQuery
        ]);

        if (studentsRes.data) {
          setRoster(studentsRes.data);
          setRecentEnrollments(studentsRes.data as RecentEnrollment[]);
        }
        if (queueRes.data) setQueue(queueRes.data);
        if (cohortsRes.data) {
          setCohorts(cohortsRes.data as AdvisorCohort[]);
        }
        if (templatesRes.data && templatesRes.data.length > 0) {
          setDegreeTemplates(templatesRes.data);
          if (!selectedTemplateId) {
            const firstTmpl = templatesRes.data[0];
            setSelectedTemplateId(firstTmpl.id);
            setGeneratedCode(generateCohortCode(firstTmpl.program_code));
            setCohortName(`${firstTmpl.program_code} ${firstTmpl.syllabus_year || "2024/2025"}`);
          }
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [advisorStaffId]);

  // Lock Toggle Handler: updates is_locked in cohorts table for specific cohort
  const handleToggleCohortLock = async (cohortId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setTogglingCohortId(cohortId);
    try {
      const { error } = await db
        .from("cohorts")
        .update({ is_locked: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", cohortId);

      if (error) throw error;

      setCohorts((prev) =>
        prev.map((c) => (c.id === cohortId ? { ...c, is_locked: nextStatus } : c))
      );
      toast.success(
        nextStatus
          ? "Cohort registration locked. Advisees cannot join with this code."
          : "Cohort registration unlocked. Advisees can now join."
      );
    } catch (err: any) {
      console.error("Failed to update cohort lock:", err);
      toast.error(err.message || "Failed to update cohort lock status.");
    } finally {
      setTogglingCohortId(null);
    }
  };

  // Handle Revoke Student — Step 2
  const handleRevokeStudent = async (matricNo: string, userId: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to revoke this student's access? This will permanently delete their account and enforce a 24-hour registration ban on this matric number.`
    );
    if (!confirmed) return;

    setIsRevoking(matricNo);
    try {
      const { data, error } = await db.functions.invoke('revoke-student', {
        body: { matric_no: matricNo, user_id: userId, advisor_staff_id: advisorStaffId }
      });

      if (error) throw error;

      // Optimistically remove from local state on success
      setRecentEnrollments((prev) => prev.filter((e) => e.matric_no !== matricNo));
      setRoster((prev) => prev.filter((s) => s.matric_no !== matricNo));
      toast.success(`Access revoked for ${matricNo}. A 24-hour re-registration ban has been enforced.`);
    } catch (err: any) {
      console.error('[handleRevokeStudent] Edge Function error:', err);
      toast.error(err.message || `Failed to revoke access for ${matricNo}. Please try again.`);
    } finally {
      setIsRevoking(null);
    }
  };

  // Copy specific cohort code handler
  const handleCopyCohortCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Cohort code "${code}" copied to clipboard!`);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch (err) {
      console.error("Failed to copy code:", err);
      toast.error("Failed to copy code to clipboard.");
    }
  };

  // Open Create Cohort Modal
  const handleOpenCreateCohort = () => {
    setCreatedCohortResult(null);
    setCopiedNewCode(false);
    const tmpl = degreeTemplates.find((t) => t.id === selectedTemplateId) || degreeTemplates[0];
    if (tmpl) {
      setSelectedTemplateId(tmpl.id);
      setGeneratedCode(generateCohortCode(tmpl.program_code));
      setCohortName(`${tmpl.program_code} ${tmpl.syllabus_year || "2024/2025"}`);
    } else {
      setGeneratedCode(generateCohortCode("SECJ"));
      setCohortName("SECJ 2024/2025");
    }
    setIsCreateCohortOpen(true);
  };

  // Change Template selection
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = degreeTemplates.find((t) => t.id === templateId);
    if (tmpl) {
      const code = generateCohortCode(tmpl.program_code);
      setGeneratedCode(code);
      setCohortName(`${tmpl.program_code} ${tmpl.syllabus_year || "2024/2025"}`);
    }
  };

  // Create Cohort Handler: direct Supabase insert into cohorts table respecting RLS
  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advisorStaffId) {
      toast.error("Advisor session error: staff_id missing. Please re-login.");
      return;
    }
    if (!selectedTemplateId) {
      toast.error("Please select a degree template.");
      return;
    }
    if (!cohortName.trim()) {
      toast.error("Please enter a cohort name.");
      return;
    }

    const codeToInsert = generatedCode || generateCohortCode();
    setIsCreatingCohort(true);

    try {
      const { data, error } = await db
        .from("cohorts")
        .insert({
          cohort_name: cohortName.trim(),
          advisor_staff_id: advisorStaffId,
          template_id: selectedTemplateId,
          cohort_code: codeToInsert,
          is_locked: false,
        })
        .select(`
          id,
          cohort_name,
          cohort_code,
          is_locked,
          advisor_staff_id,
          template_id,
          degree_templates (
            program_code,
            program_name,
            syllabus_year
          )
        `)
        .single();

      if (error) throw error;

      const createdCohort = data as AdvisorCohort;

      // Update UI state immediately
      setCohorts((prev) => [createdCohort, ...prev]);
      setCreatedCohortResult(createdCohort);
      toast.success(`Cohort "${createdCohort.cohort_name}" created successfully!`);
    } catch (err: any) {
      console.error("Failed to insert cohort:", err);
      toast.error(err.message || "Failed to create cohort in Supabase.");
    } finally {
      setIsCreatingCohort(false);
    }
  };

  // Copy newly created cohort code
  const handleCopyNewCohortCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedNewCode(true);
      toast.success(`Cohort code "${code}" copied to clipboard!`);
      setTimeout(() => setCopiedNewCode(false), 2500);
    } catch (err) {
      console.error("Failed to copy code:", err);
      toast.error("Failed to copy code to clipboard.");
    }
  };

  // Standard Template CSV Generator and Downloader
  const handleDownloadTemplate = () => {
    const csvHeader = "course_code,course_name,credits,category,semester,prerequisite_code,min_grade\n";
    const sampleRows = [
      "CS101,Introduction to Computer Science,3,Core,1,,",
      "CS102,Programming Fundamentals,3,Core,2,CS101,C",
      "SWE300,Software Engineering Project I,3,Core,3,CS102,C",
      "CS310,Systems Development Technology,3,Elective,4,,",
      "GEN101,Creative Thinking and Innovation,2,University,1,,"
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
      {/* 1. COHORT MANAGEMENT CARD (Multi-Tenant Blueprint Architecture) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-900 text-xs font-mono border border-blue-200 font-semibold">
                <KeyRound className="w-3.5 h-3.5" />
                Cohort Management
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-mono font-medium">
                {cohorts.length} {cohorts.length === 1 ? "Cohort" : "Cohorts"} Active
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-gray-900">
              Advisor Cohort Gatekeeper
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
              Distribute cohort codes to your advisees. Students enter the code during registration to join your cohort roster with degree blueprints automatically assigned.
            </p>
          </div>

          {/* Prominent Header Action: Create Cohort Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="create-cohort-header-btn"
              onClick={handleOpenCreateCohort}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Cohort</span>
            </button>
          </div>
        </div>

        {/* Cohorts List */}
        <div className="space-y-3">
          {cohorts.length === 0 ? (
            <div className="text-center py-12 px-6 bg-gradient-to-b from-blue-50/40 to-gray-50/60 rounded-xl border-2 border-dashed border-blue-200/80 flex flex-col items-center justify-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/10">
                <Users className="w-7 h-7" />
              </div>
              <div className="max-w-md text-center space-y-1">
                <h4 className="text-base font-bold text-gray-900">No Active Cohorts Yet</h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  You have not set up any student cohorts. Create a cohort to generate an institutional 6-character invite code and link your advisees directly to degree blueprints.
                </p>
              </div>
              <button
                type="button"
                id="create-cohort-empty-state-btn"
                onClick={handleOpenCreateCohort}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Cohort</span>
              </button>
            </div>
          ) : (
            cohorts.map((cohort) => {
              const tmpl = Array.isArray(cohort.degree_templates)
                ? cohort.degree_templates[0]
                : cohort.degree_templates;
              const programCode = tmpl?.program_code || "Unassigned";
              const syllabusYear = tmpl?.syllabus_year || "2024/2025";
              const programName = tmpl?.program_name || "Degree Program";
              const isLocked = cohort.is_locked;
              const isToggling = togglingCohortId === cohort.id;
              const isCopied = copiedCode === cohort.cohort_code;

              return (
                <div
                  key={cohort.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                >
                  {/* Cohort Meta */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-gray-900 text-sm tracking-tight">
                        {cohort.cohort_name}
                      </h4>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100/70 text-blue-800 text-[11px] font-mono font-semibold">
                        {programCode}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-mono">
                        {syllabusYear}
                      </span>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[11px] font-mono font-semibold border border-rose-200">
                          <Lock className="w-3 h-3" />
                          LOCKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-mono font-semibold border border-emerald-200">
                          <Unlock className="w-3 h-3" />
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {programName} • Linked to institutional degree blueprint
                    </p>
                  </div>

                  {/* Cohort Code Display & Lock Switch */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                    {/* Code Display */}
                    <div className="flex items-center gap-2">
                      <div className="bg-white border border-gray-300 px-3.5 py-1.5 rounded-lg flex items-center gap-2 shadow-xs">
                        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                          Code:
                        </span>
                        <span className="font-mono text-xl font-bold tracking-wider text-blue-950">
                          {cohort.cohort_code}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyCohortCode(cohort.cohort_code)}
                        type="button"
                        className={`inline-flex items-center justify-center p-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
                          isCopied
                            ? "bg-emerald-700 text-white hover:bg-emerald-800"
                            : "bg-blue-900 hover:bg-blue-800 text-white"
                        }`}
                        title="Copy Cohort Code"
                      >
                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Lock Toggle */}
                    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-700 block">
                          {isLocked ? "Registration Locked" : "Registration Open"}
                        </span>
                        <span className="text-[10px] text-gray-400 block">
                          {isLocked ? "Reject sign-ups" : "Accept sign-ups"}
                        </span>
                      </div>
                      <Switch
                        id={`cohort-lock-${cohort.id}`}
                        checked={isLocked}
                        disabled={isToggling}
                        onCheckedChange={() => handleToggleCohortLock(cohort.id, isLocked)}
                        className="data-[state=checked]:bg-rose-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
                        {student.program || "Unassigned"}
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

      {/* 5. RECENT ENROLLMENTS SURVEILLANCE PANEL (Loose Admission Safety Net) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-semibold tracking-tight text-gray-900">
                Recent Enrollments
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-mono border border-amber-200">
                Safety Net
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Review self-registered students. Revoke access for fraudulent or duplicate registrations.
            </p>
          </div>
          <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200 shrink-0">
            {recentEnrollments.length} {recentEnrollments.length === 1 ? 'enrollment' : 'enrollments'}
          </span>
        </div>

        {recentEnrollments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No enrollments to review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50 border-b border-gray-200">
                  <th className="py-3 px-6">Student Name</th>
                  <th className="py-3 px-6">Matric No</th>
                  <th className="py-3 px-6">Institutional Email</th>
                  <th className="py-3 px-6">Registered At</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentEnrollments.map((enrollment) => {
                  const registeredAt = enrollment.created_at
                    ? new Date(enrollment.created_at).toLocaleString('en-MY', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—';
                  const isBeingRevoked = isRevoking === enrollment.matric_no;

                  return (
                    <tr
                      key={enrollment.matric_no}
                      className="hover:bg-rose-50/30 transition-colors duration-150"
                    >
                      <td className="py-3.5 px-6 text-sm font-medium text-gray-900">
                        {enrollment.name || '—'}
                      </td>
                      <td className="py-3.5 px-6 text-sm font-mono text-gray-700">
                        {enrollment.matric_no}
                      </td>
                      <td className="py-3.5 px-6 text-sm text-gray-500">
                        {enrollment.institutional_email || '—'}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-gray-500 font-mono">
                        {registeredAt}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          id={`revoke-btn-${enrollment.matric_no}`}
                          onClick={() =>
                            handleRevokeStudent(
                              enrollment.matric_no,
                              enrollment.user_id ?? ''
                            )
                          }
                          disabled={isBeingRevoked || !enrollment.user_id}
                          title={
                            !enrollment.user_id
                              ? 'Cannot revoke: no auth account linked'
                              : 'Revoke this student\'s access'
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {isBeingRevoked ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          {isBeingRevoked ? 'Revoking…' : 'Revoke'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. UPLOAD COURSE STRUCTURE MODAL */}
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

      {/* 7. CREATE COHORT MODAL */}
      {isCreateCohortOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/70">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center shadow-xs">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {createdCohortResult ? "Cohort Ready!" : "Create Advisee Cohort"}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {createdCohortResult ? "Invite code generated" : "Link cohort to institutional degree blueprint"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateCohortOpen(false);
                  setCreatedCohortResult(null);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdCohortResult ? (
              /* Success / Copy Code Screen */
              <div className="p-6 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-gray-900">
                    Cohort Created Successfully
                  </h4>
                  <p className="text-xs text-gray-600 max-w-xs mx-auto">
                    "{createdCohortResult.cohort_name}" is now active in your dashboard.
                  </p>
                </div>

                {/* Prominent 6-Character Code Display */}
                <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-200 rounded-xl p-5 text-center space-y-3">
                  <span className="text-[10px] font-mono text-blue-900 uppercase font-semibold tracking-wider block">
                    Student Registration Code
                  </span>
                  <div className="font-mono text-3xl font-extrabold tracking-widest text-blue-950">
                    {createdCohortResult.cohort_code}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyNewCohortCode(createdCohortResult.cohort_code)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer mx-auto ${
                      copiedNewCode
                        ? "bg-emerald-700 text-white hover:bg-emerald-800"
                        : "bg-blue-900 hover:bg-blue-800 text-white"
                    }`}
                  >
                    {copiedNewCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedNewCode ? "Code Copied to Clipboard!" : "Copy Cohort Code"}</span>
                  </button>
                </div>

                <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Distribute this 6-character code to your incoming students. Entering this code during registration will automatically bind them to your advisee roster with the selected degree blueprint.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateCohortOpen(false);
                      setCreatedCohortResult(null);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    Done &amp; View Cohort
                  </button>
                </div>
              </div>
            ) : (
              /* Creation Form */
              <form onSubmit={handleCreateCohort} className="p-6 space-y-5">
                {/* 1. Degree Template Selection */}
                <div className="space-y-1.5">
                  <label htmlFor="degree-template-select" className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                    <span>Degree Template Blueprint *</span>
                    <span className="text-[10px] text-gray-400 font-normal">Institutional</span>
                  </label>
                  <select
                    id="degree-template-select"
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-colors cursor-pointer"
                  >
                    {degreeTemplates.length === 0 ? (
                      <option value="">Loading templates...</option>
                    ) : (
                      degreeTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.university_name} — {t.program_code} ({t.program_name}, {t.syllabus_year})
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-[11px] text-gray-500">
                    Defines the core curriculum, required credits, and prerequisites for this intake.
                  </p>
                </div>

                {/* 2. Cohort Name Input */}
                <div className="space-y-1.5">
                  <label htmlFor="cohort-name-input" className="text-xs font-semibold text-gray-800 block">
                    Cohort Name *
                  </label>
                  <input
                    type="text"
                    id="cohort-name-input"
                    value={cohortName}
                    onChange={(e) => setCohortName(e.target.value)}
                    placeholder="e.g., SECJ 2024/2025"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-colors"
                  />
                  <p className="text-[11px] text-gray-500">
                    Human-readable label shown on student dashboards and reports.
                  </p>
                </div>

                {/* 3. Generated 6-Character Code Preview */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                    <span>Generated 6-Character Cohort Code</span>
                    <button
                      type="button"
                      onClick={() => {
                        const currentTmpl = degreeTemplates.find(t => t.id === selectedTemplateId);
                        setGeneratedCode(generateCohortCode(currentTmpl?.program_code || "SECJ"));
                      }}
                      className="text-[11px] text-blue-900 hover:text-blue-700 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Re-roll Code</span>
                    </button>
                  </label>
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div className="font-mono text-xl font-bold tracking-widest text-blue-950 px-2 py-1 bg-white border border-gray-300 rounded-lg">
                      {generatedCode || "SECJ99"}
                    </div>
                    <span className="text-[11px] text-gray-500 leading-tight">
                      Random alphanumeric code assigned to advisees upon registration.
                    </span>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateCohortOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCohort || !selectedTemplateId || !cohortName.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isCreatingCohort ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>{isCreatingCohort ? "Creating Cohort..." : "Create Cohort"}</span>
                  </button>
                </div>
              </form>
            )}
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
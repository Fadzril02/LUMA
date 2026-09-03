import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { StudentRadarChart } from '../../components/advisor/StudentRadarChart';
import { TrafficLightGrid, CourseAuditItem } from '../../components/advisor/TrafficLightGrid';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
  GraduationCap,
  Sparkles,
  Search,
  ChevronRight,
  LogOut,
  Plus,
  Copy,
  Check,
  FileUp,
  Loader2,
  X,
  Filter,
  ArrowUpDown,
  BookOpen,
  HelpCircle,
} from 'lucide-react';

interface Cohort {
  id: string;
  name: string;
  invite_code: string;
  curriculum_version: string;
  created_at: string;
}

interface StudentRosterItem {
  id: string;
  matric_number: string;
  full_name: string;
  cohort_id: string;
  cgpa: number;
  total_credits_earned: number;
  academic_status: string;
  traffic_light: 'RED' | 'YELLOW' | 'GREEN';
  unmet_prereq_count: number;
  failed_count: number;
  records: CourseAuditItem[];
  radar_stats?: {
    'Logic & Math'?: number;
    'Core Development'?: number;
    'Systems & Architecture'?: number;
    'Soft Skills'?: number;
    'Project Management'?: number;
  };
}

export function AdvisorDashboard() {
  const navigate = useNavigate();
  const { advisor, user, signOut } = useAuth();
  const universityId = advisor?.university_id || '00000000-0000-0000-0000-000000000001';

  // Cohort Selection & Data State
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('ALL');
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Drill-down Student Drawer / Modal state
  const [activeStudent, setActiveStudent] = useState<StudentRosterItem | null>(null);

  // Quick Audit Modal state
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Load Cohorts and Students
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Cohorts
      const { data: cohortsData } = await supabase
        .from('cohorts')
        .select('*')
        .order('created_at', { ascending: false });

      setCohorts(cohortsData || []);

      // 2. Fetch Students and their latest Degree Audits & Academic Records
      const { data: studentsData } = await supabase
        .from('students')
        .select(`
          id,
          matric_number,
          full_name,
          cohort_id,
          cgpa,
          total_credits_earned,
          academic_status,
          degree_audits (
            traffic_light_status,
            unmet_prerequisites_count,
            failed_courses_count,
            audit_summary
          ),
          academic_records (
            course_code,
            course_name,
            credits,
            grade,
            grade_point,
            semester,
            status,
            prerequisite_met,
            missing_prerequisites,
            is_ai_parsed
          )
        `);

      if (studentsData) {
        const formattedStudents: StudentRosterItem[] = studentsData.map((s: any) => {
          const latestAudit = s.degree_audits?.[0];
          const rawTrafficLight = latestAudit?.traffic_light_status || (Number(s.cgpa) < 2.0 ? 'RED' : 'GREEN');
          const summary = latestAudit?.audit_summary || {};

          // Convert academic_records to CourseAuditItem format
          const formattedRecords: CourseAuditItem[] = (s.academic_records || []).map((r: any) => {
            let itemTraffic: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
            if (r.status === 'Failed' || !r.prerequisite_met) itemTraffic = 'RED';
            else if (r.status === 'In-Progress') itemTraffic = 'YELLOW';

            return {
              course_code: r.course_code,
              course_name: r.course_name || r.course_code,
              credits: r.credits || 3,
              grade: r.grade,
              grade_point: Number(r.grade_point) || 0.0,
              semester: r.semester || 'Sem 1',
              status: r.status,
              traffic_light: itemTraffic,
              prerequisite_met: r.prerequisite_met,
              missing_prerequisites: r.missing_prerequisites || [],
              is_ai_parsed: r.is_ai_parsed,
            };
          });

          return {
            id: s.id,
            matric_number: s.matric_number,
            full_name: s.full_name,
            cohort_id: s.cohort_id || 'unassigned',
            cgpa: Number(s.cgpa) || 0.0,
            total_credits_earned: s.total_credits_earned || 0,
            academic_status: s.academic_status || 'Good Standing',
            traffic_light: rawTrafficLight,
            unmet_prereq_count: latestAudit?.unmet_prerequisites_count || 0,
            failed_count: latestAudit?.failed_courses_count || 0,
            records: formattedRecords,
            radar_stats: summary.radar_stats || {
              'Logic & Math': Math.min(4.0, (Number(s.cgpa) || 3.0) + 0.2),
              'Core Development': Number(s.cgpa) || 3.2,
              'Systems & Architecture': Math.min(4.0, (Number(s.cgpa) || 3.0) - 0.1),
              'Soft Skills': 3.7,
              'Project Management': Math.min(4.0, (Number(s.cgpa) || 3.0) + 0.4),
            },
          };
        });

        // 3. THE TRIAGE AUTO-SORT:
        // Rank order: RED (High Priority Alerts) -> YELLOW (Review Pending) -> GREEN (Good Standing)
        const priorityWeight = { RED: 0, YELLOW: 1, GREEN: 2 };
        const sortedStudents = formattedStudents.sort((a, b) => {
          if (priorityWeight[a.traffic_light] !== priorityWeight[b.traffic_light]) {
            return priorityWeight[a.traffic_light] - priorityWeight[b.traffic_light];
          }
          return a.cgpa - b.cgpa; // lower CGPA first among same color
        });

        setStudents(sortedStudents);
      }
    } catch (err) {
      console.error('Failed to load triage roster:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [advisor]);

  // Filtered Students based on Cohort Selector and Search Query
  const filteredStudents = students.filter((s) => {
    const matchesCohort = selectedCohortId === 'ALL' || s.cohort_id === selectedCohortId;
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.matric_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCohort && matchesSearch;
  });

  // Triage Metric Calculations
  const totalRosterCount = filteredStudents.length;
  const redAlertCount = filteredStudents.filter((s) => s.traffic_light === 'RED').length;
  const yellowReviewCount = filteredStudents.filter((s) => s.traffic_light === 'YELLOW').length;
  const greenGoodCount = filteredStudents.filter((s) => s.traffic_light === 'GREEN').length;

  const avgCgpa =
    totalRosterCount > 0
      ? (filteredStudents.reduce((sum, s) => sum + s.cgpa, 0) / totalRosterCount).toFixed(2)
      : '0.00';

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Manual Override Handler inside Drill-Down Modal
  const handleCourseOverride = (courseCode: string, reason: string, notes: string) => {
    if (!activeStudent) return;

    const updatedRecords = activeStudent.records.map((r) => {
      if (r.course_code === courseCode) {
        return {
          ...r,
          traffic_light: 'GREEN' as const,
          prerequisite_met: true,
          status: 'Passed (Override)',
          is_overridden: true,
          override_reason: reason,
        };
      }
      return r;
    });

    const stillHasRed = updatedRecords.some((r) => r.traffic_light === 'RED');
    const newTraffic = stillHasRed ? 'RED' : 'GREEN';

    const updatedStudent: StudentRosterItem = {
      ...activeStudent,
      traffic_light: newTraffic,
      records: updatedRecords,
    };

    setActiveStudent(updatedStudent);
    setStudents((prev) => prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s)));
  };

  // Direct Storage PDF Audit
  const handleRunQuickAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcriptFile || !user) return;

    setIsAuditing(true);
    setAuditError(null);

    try {
      const timestamp = Date.now();
      const storagePath = `${user.id}/${timestamp}_${transcriptFile.name}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('transcripts')
        .upload(storagePath, transcriptFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

      const auditRes = await api.processStorageAudit({
        storage_path: `transcripts/${uploadData.path}`,
        advisor_id: user.id,
        university_id: universityId,
      });

      setShowAuditModal(false);
      setTranscriptFile(null);
      await loadData();
    } catch (err: any) {
      setAuditError(err?.response?.data?.detail || err?.message || 'Audit execution failed');
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Bar Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-sm shadow-indigo-200">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">L.U.M.A.</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Lecturer Triage
                </span>
              </div>
              <p className="text-xs text-slate-500">Degree Audit & Prerequisite Resolver</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/advisor/setup')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>New Cohort / Syllabus</span>
            </button>

            <button
              onClick={() => setShowAuditModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm shadow-indigo-200 transition-all"
            >
              <FileUp className="w-4 h-4" />
              <span>Audit Transcript (PDF)</span>
            </button>

            <div className="h-6 w-px bg-slate-200" />

            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-900">{advisor?.full_name || user?.email}</div>
              <div className="text-[11px] text-slate-500 font-mono">{advisor?.staff_id || 'Academic Advisor'}</div>
            </div>

            <button
              onClick={signOut}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Triage Summary Metric Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cohort Advisees</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalRosterCount}</div>
            <p className="text-[10px] text-slate-400">Total active students</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Red Alerts</span>
              <XCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-600 mt-1">{redAlertCount}</div>
            <p className="text-[10px] text-rose-500 font-medium">Failed / Missing Prereq</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">In-Progress</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600 mt-1">{yellowReviewCount}</div>
            <p className="text-[10px] text-amber-500 font-medium">Active Semesters</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">On-Track</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{greenGoodCount}</div>
            <p className="text-[10px] text-emerald-500 font-medium">All Prereqs Satisfied</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Average CGPA</span>
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">{avgCgpa}</div>
            <p className="text-[10px] text-slate-400">Cohort performance</p>
          </div>
        </div>

        {/* Triage Control Bar: Cohort Dropdown & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Filter Cohort:</label>
            </div>
            <select
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
            >
              <option value="ALL">All Cohorts ({students.length} Students)</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Code: {c.invite_code})
                </option>
              ))}
            </select>

            {selectedCohortId !== 'ALL' && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-mono">
                <span className="text-slate-600 text-[11px]">Invite:</span>
                <span className="font-bold text-indigo-700">
                  {cohorts.find((c) => c.id === selectedCohortId)?.invite_code}
                </span>
                <button
                  onClick={() =>
                    handleCopyCode(cohorts.find((c) => c.id === selectedCohortId)?.invite_code || '')
                  }
                  className="text-indigo-600 hover:text-indigo-900 p-0.5"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name or matric..."
              className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Triage Roster Table (Auto-sorted by Risk) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Triage Student Roster</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                  Priority-Sorted
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Students with failed courses or missing prerequisites are automatically pinned to the top.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 font-medium">
              {filteredStudents.length} Students
            </span>
          </div>

          {isLoading ? (
            <div className="p-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading student triage audit data...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">No students found</p>
              <p className="text-xs text-slate-500 mt-1">
                Share your cohort invite code with students to populate this roster.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200/60 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Risk Tier</th>
                    <th className="px-6 py-3.5">Student Details</th>
                    <th className="px-6 py-3.5">CGPA</th>
                    <th className="px-6 py-3.5">Credits Earned</th>
                    <th className="px-6 py-3.5">Audit Triage Summary</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((s) => {
                    const isRed = s.traffic_light === 'RED';
                    const isYellow = s.traffic_light === 'YELLOW';
                    const isGreen = s.traffic_light === 'GREEN';

                    return (
                      <tr
                        key={s.id}
                        onClick={() => setActiveStudent(s)}
                        className={`cursor-pointer transition-colors ${
                          isRed
                            ? 'bg-rose-50/30 hover:bg-rose-50/70'
                            : isYellow
                            ? 'bg-amber-50/20 hover:bg-amber-50/60'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Traffic Light Status Badge */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${
                              isRed
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isYellow
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isRed ? 'bg-rose-600' : isYellow ? 'bg-amber-500' : 'bg-emerald-600'
                              }`}
                            />
                            <span>{s.traffic_light}</span>
                          </span>
                        </td>

                        {/* Name & Matric */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-xs">{s.full_name}</div>
                          <div className="font-mono text-[11px] text-slate-500">{s.matric_number}</div>
                        </td>

                        {/* CGPA */}
                        <td className="px-6 py-4">
                          <span
                            className={`font-mono font-bold text-xs ${
                              s.cgpa < 2.0 ? 'text-rose-600' : s.cgpa < 3.0 ? 'text-amber-600' : 'text-slate-900'
                            }`}
                          >
                            {s.cgpa.toFixed(2)}
                          </span>
                        </td>

                        {/* Credits */}
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          {s.total_credits_earned} / 130
                        </td>

                        {/* Summary Message */}
                        <td className="px-6 py-4">
                          {isRed ? (
                            <span className="text-rose-700 font-bold text-[11px] flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Requires Academic Intervention</span>
                            </span>
                          ) : isYellow ? (
                            <span className="text-amber-700 font-medium text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Active Semester In-Progress</span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Graduation Path Valid</span>
                            </span>
                          )}
                        </td>

                        {/* Drill-down Arrow */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveStudent(s);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 font-semibold text-xs transition-colors shadow-2xs"
                          >
                            <span>Inspect Audit</span>
                            <ChevronRight className="w-3.5 h-3.5" />
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
      </main>

      {/* Student Drill-Down Full Modal / Drawer */}
      {activeStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full my-8 p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-2xl ${
                    activeStudent.traffic_light === 'RED'
                      ? 'bg-rose-100 text-rose-700'
                      : activeStudent.traffic_light === 'YELLOW'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <GraduationCap className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900">{activeStudent.full_name}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                        activeStudent.traffic_light === 'RED'
                          ? 'bg-rose-600 text-white'
                          : activeStudent.traffic_light === 'YELLOW'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {activeStudent.traffic_light} STATUS
                    </span>
                  </div>
                  <p className="font-mono text-xs text-slate-500 mt-0.5">
                    Matric: {activeStudent.matric_number} | Standing: {activeStudent.academic_status}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveStudent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Grid: Quick Stats & 5-Domain Skill Pentagon */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left Column: Academic Stats */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cumulative GPA</span>
                  <div className="text-3xl font-black text-slate-900 mt-1">{activeStudent.cgpa.toFixed(2)}</div>
                  <span className="text-[11px] text-slate-500">Scale: 0.00 - 4.00</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Graduation Credits</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {activeStudent.total_credits_earned} <span className="text-sm font-semibold text-slate-500">/ 130</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, (activeStudent.total_credits_earned / 130) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Right 2 Columns: 5-Domain Skill Pentagon Chart */}
              <div className="md:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>5-Domain Competency Pentagon</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Scale 0.0 - 4.0</span>
                </div>
                <StudentRadarChart stats={activeStudent.radar_stats} />
              </div>
            </div>

            {/* Prerequisite Matrix & Traffic Light Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>Transcript Course Prerequisite Matrix</span>
                </h3>
              </div>

              <TrafficLightGrid
                records={activeStudent.records}
                onOverrideCourse={handleCourseOverride}
                canOverride={true}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setActiveStudent(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md transition-all"
              >
                Close Audit Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Audit Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-indigo-600" />
              <span>Direct-Upload Transcript Audit (PDF)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Uploads student PDF directly to private Supabase Storage, then executes sub-second PyMuPDF extraction.
            </p>

            {auditError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{auditError}</span>
              </div>
            )}

            <form onSubmit={handleRunQuickAudit} className="mt-4 space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-50/50 cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!transcriptFile || isAuditing}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAuditing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing & Auditing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Run Zero-Waste Audit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import {
  Layers,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  Loader2,
  Sparkles,
  BookOpen,
  ArrowLeft,
  GraduationCap,
} from 'lucide-react';

export function CohortSetup() {
  const navigate = useNavigate();
  const { advisor, user } = useAuth();
  const universityId = advisor?.university_id || '00000000-0000-0000-0000-000000000001';

  // Step state (1: Cohort Details, 2: Course CSV Upload, 3: Completed)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form state
  const [cohortName, setCohortName] = useState<string>('');
  const [curriculumVersion, setCurriculumVersion] = useState<string>('2023/2024');
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string>('');
  const [createdCohortId, setCreatedCohortId] = useState<string | null>(null);
  const [isCreatingCohort, setIsCreatingCohort] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // CSV state
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState<boolean>(false);
  const [csvResult, setCsvResult] = useState<any | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate 6-char random alphanumeric code
  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortName.trim()) return;

    setIsCreatingCohort(true);
    const code = generateInviteCode();

    try {
      const { data, error } = await supabase
        .from('cohorts')
        .insert({
          advisor_id: user?.id,
          university_id: universityId,
          name: cohortName.trim(),
          invite_code: code,
          curriculum_version: curriculumVersion,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        alert(`Failed to create cohort: ${error.message}`);
      } else if (data) {
        setGeneratedInviteCode(code);
        setCreatedCohortId(data.id);
        setCurrentStep(2);
      }
    } catch (err: any) {
      alert(`Error: ${err?.message}`);
    } finally {
      setIsCreatingCohort(false);
    }
  };

  const handleCopyCode = () => {
    if (generatedInviteCode) {
      navigator.clipboard.writeText(generatedInviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await api.downloadCourseTemplateCSV();
    } catch (err) {
      alert('Failed to download sample CSV template.');
    }
  };

  const handleUploadCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setIsUploadingCSV(true);
    setCsvError(null);

    try {
      const res = await api.uploadCoursesCSV(csvFile, universityId);
      setCsvResult(res);
      setCurrentStep(3);
    } catch (err: any) {
      setCsvError(err?.response?.data?.detail || err?.message || 'Failed to parse and upload CSV.');
    } finally {
      setIsUploadingCSV(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/advisor')}
              className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Self-Serve Cohort Onboarding</h1>
              <p className="text-xs text-slate-500">Configure your student intake and curriculum syllabus</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className={`px-2.5 py-1 rounded-lg ${currentStep === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>
              1. Cohort
            </span>
            <span className={`px-2.5 py-1 rounded-lg ${currentStep === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>
              2. Syllabus CSV
            </span>
            <span className={`px-2.5 py-1 rounded-lg ${currentStep === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>
              3. Ready
            </span>
          </div>
        </div>

        {/* Step 1: Cohort Setup */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 1: Create Student Cohort</h2>
                <p className="text-xs text-slate-500">
                  Students will use this cohort invite code to join your roster automatically.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateCohort} className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Cohort Name / Intake Label
                </label>
                <input
                  type="text"
                  required
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  placeholder="e.g. Software Engineering 2025/2026 Intake"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Curriculum Version
                </label>
                <input
                  type="text"
                  required
                  value={curriculumVersion}
                  onChange={(e) => setCurriculumVersion(e.target.value)}
                  placeholder="2023/2024"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
                />
              </div>

              <div className="pt-4 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isCreatingCohort || !cohortName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-200 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isCreatingCohort ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Next: Upload Syllabus CSV</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Course Syllabus CSV Ingestion */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 2: Upload Course Syllabus</h2>
                  <p className="text-xs text-slate-500">
                    Upload the curriculum CSV so LUMA can map prerequisite DAG rules and 5-skill domains.
                  </p>
                </div>
              </div>

              {/* Invite Code Generated Banner */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                <span className="text-[11px] text-slate-600 font-medium">Invite Code:</span>
                <span className="font-mono font-bold text-indigo-700 text-xs">{generatedInviteCode}</span>
                <button onClick={handleCopyCode} className="text-indigo-600 hover:text-indigo-900">
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {csvError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{csvError}</span>
              </div>
            )}

            <form onSubmit={handleUploadCSV} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-all"
              >
                <FileSpreadsheet className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                <span className="text-sm font-semibold text-slate-800 block">
                  {csvFile ? csvFile.name : 'Choose Course Syllabus CSV'}
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  Expected columns: course_code, course_name, credits, category, prerequisites
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setCSVFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample Syllabus CSV</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Skip for Now
                  </button>
                  <button
                    type="submit"
                    disabled={!csvFile || isUploadingCSV}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isUploadingCSV ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>Ingest & Categorize</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Completed Summary */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">Cohort Ready for Students!</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Share this unique invite code with your students to automatically map them to this syllabus.
              </p>
            </div>

            {/* Large Copyable Invite Code Card */}
            <div className="max-w-xs mx-auto p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl text-center space-y-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                Student Invite Code
              </span>
              <div className="font-mono text-3xl font-black text-indigo-700 tracking-widest">
                {generatedInviteCode || 'SE25X9'}
              </div>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Invite Code'}</span>
              </button>
            </div>

            {csvResult && (
              <p className="text-xs font-semibold text-emerald-700">
                ✨ Successfully cataloged {csvResult.total_inserted} courses into university prerequisite engine.
              </p>
            )}

            <div className="pt-4">
              <button
                onClick={() => navigate('/advisor')}
                className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-sm shadow-lg shadow-slate-200 transition-all"
              >
                Go to Advisor Triage Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

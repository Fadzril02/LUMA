import React, { useState, useEffect, useMemo } from "react";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Lock, 
  ArrowLeft, 
  Loader2, 
  Save, 
  X,
  AlertTriangle,
  Layers,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";

interface TemplateSummary {
  id: string;
  program_code: string;
  program_name: string;
  syllabus_year: string;
  total_credits_required: number;
  owner_staff_id: string | null;
  can_edit: boolean;
}

interface TemplateCourseRow {
  id: string;
  template_id: string;
  course_code: string;
  course_name: string;
  credit_hour: number;
  category: string;
  is_core_requirement: boolean;
  is_elective_slot: boolean;
  slot_no: number | null;
  match_patterns: string[] | null;
  prerequisites: any;
  created_at?: string;
  updated_at?: string;
}

interface TemplateDetail {
  id: string;
  program_code: string;
  program_name: string;
  syllabus_year: string;
  total_credits_required: number;
  owner_staff_id: string | null;
  can_edit: boolean;
  rows: TemplateCourseRow[];
}

export function CurriculumTemplatesView() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateDetail, setTemplateDetail] = useState<TemplateDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Template header editing state
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState("");
  const [headerCredits, setHeaderCredits] = useState(0);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // New row state
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCredits, setNewCredits] = useState<number | string>(3);
  const [newCategory, setNewCategory] = useState("Core");
  const [newPrereqs, setNewPrereqs] = useState("");
  const [isSubmittingNewRow, setIsSubmittingNewRow] = useState(false);
  const [newRowError, setNewRowError] = useState<string | null>(null);

  // Editing existing row state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editCredits, setEditCredits] = useState<number | string>(3);
  const [editCategory, setEditCategory] = useState("Core");
  const [editPrereqs, setEditPrereqs] = useState("");
  const [isSavingRow, setIsSavingRow] = useState(false);
  const [rowError, setRowError] = useState<{ rowId: string; message: string } | null>(null);

  // Delete impact modal state
  const [rowToDelete, setRowToDelete] = useState<TemplateCourseRow | null>(null);
  const [impactData, setImpactData] = useState<{ overrides_count: number; cohorts_using_template: number } | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const [isDeletingRow, setIsDeletingRow] = useState(false);

  // 1. Fetch template summaries list
  const loadTemplates = async () => {
    setIsLoadingList(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data || []);
    } catch (err: any) {
      console.error("Failed to load templates:", err);
      toast.error(err.response?.data?.detail || "Failed to load curriculum templates.");
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // 2. Fetch selected template detail
  const loadTemplateDetail = async (templateId: string) => {
    setIsLoadingDetail(true);
    setIsAddingRow(false);
    setEditingRowId(null);
    setRowError(null);
    setHeaderError(null);
    try {
      const data = await api.getTemplateDetail(templateId);
      setTemplateDetail(data);
      setHeaderName(data.program_name);
      setHeaderCredits(data.total_credits_required);
    } catch (err: any) {
      console.error("Failed to load template detail:", err);
      toast.error(err.response?.data?.detail || "Failed to load template details.");
      setSelectedTemplateId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    loadTemplateDetail(id);
  };

  const handleBackToList = () => {
    setSelectedTemplateId(null);
    setTemplateDetail(null);
    loadTemplates();
  };

  // Helper to format prerequisites object as readable text
  const formatPrereqsText = (prereqs: any): string => {
    if (!prereqs) return "None";
    if (typeof prereqs === "string") return prereqs;
    const courses = prereqs.courses || [];
    const minCredits = prereqs.min_credits || 0;
    const minGrade = prereqs.min_grade;
    const hasCustomGrade = prereqs.has_custom_min_grade;

    let parts: string[] = [];
    if (courses.length > 0) {
      parts.push(courses.join(prereqs.type === "OR" ? " OR " : " AND "));
    }
    if (minCredits > 0) {
      parts.push(`min_credits: ${minCredits}`);
    }
    if (hasCustomGrade && minGrade) {
      parts.push(`min_grade: ${minGrade}`);
    }

    return parts.length > 0 ? parts.join(", ") : "None";
  };

  // Live credits totals calculation
  const rowsTotalCredits = useMemo(() => {
    if (!templateDetail?.rows) return 0;
    return templateDetail.rows.reduce((sum, r) => sum + (Number(r.credit_hour) || 0), 0);
  }, [templateDetail]);

  const programmeCredits = templateDetail?.total_credits_required || 0;
  const creditsDiff = rowsTotalCredits - programmeCredits;
  const isCreditsBalanced = rowsTotalCredits === programmeCredits;

  // 3. Save Header Edit
  const handleSaveHeader = async () => {
    if (!selectedTemplateId) return;
    setIsSavingHeader(true);
    setHeaderError(null);
    try {
      await api.updateTemplate(selectedTemplateId, {
        program_name: headerName,
        total_credits_required: Number(headerCredits),
      });
      toast.success("Template header updated successfully");
      setIsEditingHeader(false);
      loadTemplateDetail(selectedTemplateId);
    } catch (err: any) {
      console.error("Failed to update template header:", err);
      const msg = err.response?.data?.detail || "Failed to update template";
      setHeaderError(msg);
      toast.error(msg);
    } finally {
      setIsSavingHeader(false);
    }
  };

  // 4. Add Row
  const handleAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId) return;
    setIsSubmittingNewRow(true);
    setNewRowError(null);
    try {
      await api.addTemplateRow(selectedTemplateId, {
        course_code: newCode.trim(),
        course_name: newName.trim(),
        credit_hour: Number(newCredits),
        category: newCategory.trim(),
        prerequisites: newPrereqs.trim() || "None",
      });
      toast.success("Course row added successfully");
      setIsAddingRow(false);
      setNewCode("");
      setNewName("");
      setNewCredits(3);
      setNewCategory("Core");
      setNewPrereqs("");
      loadTemplateDetail(selectedTemplateId);
    } catch (err: any) {
      console.error("Failed to add row:", err);
      const msg = err.response?.data?.detail || "Validation failed";
      setNewRowError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingNewRow(false);
    }
  };

  // 5. Start Editing Row
  const startEditRow = (row: TemplateCourseRow) => {
    setEditingRowId(row.id);
    setEditCode(row.course_code);
    setEditName(row.course_name);
    setEditCredits(row.credit_hour);
    setEditCategory(row.category || "Core");
    setEditPrereqs(formatPrereqsText(row.prerequisites));
    setRowError(null);
  };

  // 6. Save Edited Row
  const handleSaveEditRow = async (rowId: string) => {
    if (!selectedTemplateId) return;
    setIsSavingRow(true);
    setRowError(null);
    try {
      await api.updateTemplateRow(selectedTemplateId, rowId, {
        course_code: editCode.trim(),
        course_name: editName.trim(),
        credit_hour: Number(editCredits),
        category: editCategory.trim(),
        prerequisites: editPrereqs.trim() || "None",
      });
      toast.success("Row updated successfully");
      setEditingRowId(null);
      loadTemplateDetail(selectedTemplateId);
    } catch (err: any) {
      console.error("Failed to update row:", err);
      const msg = err.response?.data?.detail || "Failed to update row";
      setRowError({ rowId, message: msg });
      toast.error(msg);
    } finally {
      setIsSavingRow(false);
    }
  };

  // 7. Open Delete Impact Modal
  const initiateDeleteRow = async (row: TemplateCourseRow) => {
    if (!selectedTemplateId) return;
    setRowToDelete(row);
    setIsLoadingImpact(true);
    setImpactData(null);
    try {
      const impact = await api.getTemplateRowImpact(selectedTemplateId, row.id);
      setImpactData(impact);
    } catch (err: any) {
      console.error("Failed to load impact:", err);
      toast.error("Failed to calculate deletion impact");
    } finally {
      setIsLoadingImpact(false);
    }
  };

  // 8. Confirm Delete Row
  const handleConfirmDelete = async () => {
    if (!selectedTemplateId || !rowToDelete) return;
    setIsDeletingRow(true);
    try {
      const res = await api.deleteTemplateRow(selectedTemplateId, rowToDelete.id);
      toast.success(
        `Row deleted. ${res.cascaded_overrides_count > 0 ? `${res.cascaded_overrides_count} overrides removed.` : ""}`
      );
      setRowToDelete(null);
      setImpactData(null);
      loadTemplateDetail(selectedTemplateId);
    } catch (err: any) {
      console.error("Failed to delete row:", err);
      toast.error(err.response?.data?.detail || "Failed to delete row");
    } finally {
      setIsDeletingRow(false);
    }
  };

  // Filter templates list
  const filteredTemplates = templates.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.program_code.toLowerCase().includes(q) ||
      t.program_name.toLowerCase().includes(q) ||
      t.syllabus_year.toLowerCase().includes(q)
    );
  });

  // =========================================================================
  // VIEW: Template List
  // =========================================================================
  if (!selectedTemplateId) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-950 flex items-center gap-2.5">
              <BookOpen className="w-7 h-7 text-blue-900" />
              Curriculum Templates
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse and manage degree syllabus structures, course requirements, and elective slots.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by program code, name, or year..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
            />
          </div>
        </div>

        {/* Templates Table / Cards */}
        {isLoadingList ? (
          <div className="p-16 text-center text-gray-400 font-mono text-xs flex flex-col items-center justify-center space-y-3 bg-white border border-gray-200 rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin text-blue-900" />
            <span className="tracking-widest uppercase">LOADING CURRICULUM TEMPLATES...</span>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-12 text-center bg-white border border-gray-200 rounded-xl">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900">No Templates Found</h3>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery ? "No templates match your search." : "No curriculum templates uploaded for your institution."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-[11px] font-semibold tracking-wider uppercase text-gray-500">
                  <th className="py-3.5 px-4">Program Code</th>
                  <th className="py-3.5 px-4">Program Name</th>
                  <th className="py-3.5 px-4">Syllabus Year</th>
                  <th className="py-3.5 px-4 text-right">Required Credits</th>
                  <th className="py-3.5 px-4">Ownership</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredTemplates.map((tmpl) => (
                  <tr key={tmpl.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-blue-950">
                      {tmpl.program_code}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-900">
                      {tmpl.program_name}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 font-mono text-xs">
                      {tmpl.syllabus_year}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-gray-800">
                      {tmpl.total_credits_required}
                    </td>
                    <td className="py-3.5 px-4">
                      {tmpl.can_edit ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Editable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          <Lock className="w-3 h-3" />
                          Read-Only
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleSelectTemplate(tmpl.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-900 text-white hover:bg-blue-800 transition-colors"
                      >
                        {tmpl.can_edit ? "Edit Template" : "View Template"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: Single Template Editor
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div>
        <button
          onClick={handleBackToList}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Curriculum Templates
        </button>
      </div>

      {isLoadingDetail || !templateDetail ? (
        <div className="p-16 text-center text-gray-400 font-mono text-xs flex flex-col items-center justify-center space-y-3 bg-white border border-gray-200 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-blue-900" />
          <span className="tracking-widest uppercase">LOADING TEMPLATE DETAILS...</span>
        </div>
      ) : (
        <>
          {/* Read-Only Notice Banner */}
          {!templateDetail.can_edit && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">
                  Read-Only Mode
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Only the uploader can edit this template. You can view the courses and use this template in cohorts, but modifications are restricted.
                </p>
              </div>
            </div>
          )}

          {/* Template Header Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 text-xs font-mono font-bold bg-blue-100 text-blue-950 rounded-md">
                    {templateDetail.program_code}
                  </span>
                  <span className="text-xs font-mono text-gray-500">
                    Syllabus {templateDetail.syllabus_year}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mt-1">
                  {templateDetail.program_name}
                </h2>
              </div>

              {/* Live Credits Counter */}
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 font-mono ${
                    isCreditsBalanced
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-300 text-rose-950 font-semibold animate-pulse"
                  }`}
                >
                  {isCreditsBalanced ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>
                    Rows total <strong>{rowsTotalCredits}</strong> / programme{" "}
                    <strong>{programmeCredits}</strong> credits
                  </span>
                  {!isCreditsBalanced && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-900 font-bold ml-1">
                      {creditsDiff > 0 ? `+${creditsDiff}` : creditsDiff}
                    </span>
                  )}
                </div>

                {templateDetail.can_edit && !isEditingHeader && (
                  <button
                    onClick={() => setIsEditingHeader(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Header
                  </button>
                )}
              </div>
            </div>

            {/* Header Edit Form */}
            {isEditingHeader && (
              <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50/50 p-4 rounded-lg">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  Edit Template Properties
                </h4>
                {headerError && (
                  <div className="mb-3 p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{headerError}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Program Name
                    </label>
                    <input
                      type="text"
                      value={headerName}
                      onChange={(e) => setHeaderName(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Total Credits Required
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={headerCredits}
                      onChange={(e) => setHeaderCredits(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingHeader(false);
                      setHeaderError(null);
                      setHeaderName(templateDetail.program_name);
                      setHeaderCredits(templateDetail.total_credits_required);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveHeader}
                    disabled={isSavingHeader}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
                  >
                    {isSavingHeader ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Header
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-900" />
              Template Courses & Slots ({templateDetail.rows.length} rows)
            </h3>

            {templateDetail.can_edit && !isAddingRow && (
              <button
                onClick={() => {
                  setIsAddingRow(true);
                  setNewRowError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-900 text-white hover:bg-blue-800 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add Course / Slot
              </button>
            )}
          </div>

          {/* Add Row Form Card */}
          {isAddingRow && (
            <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-blue-100 mb-4">
                <h4 className="text-sm font-semibold text-blue-950 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-900" />
                  Add Course or Elective Slot
                </h4>
                <button
                  onClick={() => setIsAddingRow(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {newRowError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{newRowError}</span>
                </div>
              )}

              <form onSubmit={handleAddRow} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Course Code / Slot <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SECJ1013 or SECR5XX3/SECP5XX3"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    />
                    <span className="text-[10px] text-gray-500 mt-1 block">
                      Use "/" or "XX" to define elective slots
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Course Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Programming Technique I"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Credits <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={newCredits}
                      onChange={(e) => setNewCredits(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    >
                      <option value="Core">Core</option>
                      <option value="Elective">Elective</option>
                      <option value="University Requirement">University Requirement</option>
                      <option value="Specialization">Specialization</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Prerequisites (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SECJ1013 AND SECJ1023, min_credits: 80 or None"
                    value={newPrereqs}
                    onChange={(e) => setNewPrereqs(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-mono text-xs"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Supports natural language: AND, OR, min_credits, min_grade (e.g. "SECJ1013 min_grade: B")
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingRow(false)}
                    className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingNewRow}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
                  >
                    {isSubmittingNewRow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add Row
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Courses & Slots Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-[11px] font-semibold tracking-wider uppercase text-gray-500">
                  <th className="py-3 px-4">Code / Slot</th>
                  <th className="py-3 px-4">Course Name</th>
                  <th className="py-3 px-4 text-center">Type</th>
                  <th className="py-3 px-4 text-right">Credits</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Prerequisites</th>
                  {templateDetail.can_edit && (
                    <th className="py-3 px-4 text-right sticky right-0 bg-gray-50 z-10 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {templateDetail.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">
                      No courses in this template yet. Click "Add Course / Slot" to begin.
                    </td>
                  </tr>
                ) : (
                  templateDetail.rows.map((row) => {
                    const isEditingThisRow = editingRowId === row.id;

                    return (
                      <React.Fragment key={row.id}>
                        {isEditingThisRow ? (
                          /* Inline Edit Row Mode */
                          <tr className="bg-blue-50/40">
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={editCode}
                                onChange={(e) => setEditCode(e.target.value)}
                                className="w-full px-2 py-1 text-xs font-mono bg-white border border-gray-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-900"
                              />
                              <div className="mt-2 flex items-center gap-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleSaveEditRow(row.id)}
                                disabled={isSavingRow}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50"
                              >
                                {isSavingRow ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRowId(null);
                                  setRowError(null);
                                }}
                                className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-800"
                              >
                                Cancel
                              </button>
                            </div>
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-900"
                              />
                            </td>
                            <td className="py-3 px-4 text-center text-xs font-mono text-gray-500">
                              {row.is_elective_slot ? `Slot #${row.slot_no || "-"}` : "Core"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <input
                                type="number"
                                min={1}
                                max={12}
                                value={editCredits}
                                onChange={(e) => setEditCredits(e.target.value)}
                                className="w-16 px-2 py-1 text-xs font-mono text-right bg-white border border-gray-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-900"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-900"
                              >
                                <option value="Core">Core</option>
                                <option value="Elective">Elective</option>
                                <option value="University Requirement">University Requirement</option>
                                <option value="Specialization">Specialization</option>
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={editPrereqs}
                                onChange={(e) => setEditPrereqs(e.target.value)}
                                className="w-full px-2 py-1 text-xs font-mono bg-white border border-gray-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-900"
                              />
                            </td>
                            <td className="py-3 px-4" />
                          </tr>
                        ) : (
                          /* Normal Row Display */
                          <tr className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-medium text-blue-950">
                              {row.course_code}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-gray-900">
                              {row.course_name}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {row.is_elective_slot ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                  Slot #{row.slot_no || "-"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-900 border border-blue-200">
                                  Core
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-medium text-gray-800">
                              {row.credit_hour}
                            </td>
                            <td className="py-3.5 px-4 text-gray-600 text-xs">
                              {row.category}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-gray-600 max-w-xs truncate">
                              {formatPrereqsText(row.prerequisites)}
                            </td>
                            {templateDetail.can_edit && (
                              <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap sticky right-0 bg-white z-10 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]">
                                <button
                                  onClick={() => startEditRow(row)}
                                  className="p-1.5 text-gray-500 hover:text-blue-900 hover:bg-gray-100 rounded-md transition-colors"
                                  title="Edit row"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => initiateDeleteRow(row)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                  title="Delete row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        )}

                        {/* Inline Error Message Display for this row */}
                        {rowError && rowError.rowId === row.id && (
                          <tr className="bg-rose-50/80">
                            <td colSpan={7} className="py-2.5 px-4 text-xs text-rose-800 font-medium">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>{rowError.message}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete Impact Confirmation Modal */}
      {rowToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">
                  Delete Course Row
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to delete{" "}
                  <strong className="font-mono text-gray-900">{rowToDelete.course_code}</strong> (
                  {rowToDelete.course_name})?
                </p>

                {/* Impact Count Box */}
                <div className="mt-4 p-3.5 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-2">
                  <div className="font-semibold text-gray-700 uppercase tracking-wider text-[10px]">
                    Impact Analysis
                  </div>
                  {isLoadingImpact ? (
                    <div className="flex items-center gap-2 text-gray-500 py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-900" />
                      <span>Calculating student override and cohort impact...</span>
                    </div>
                  ) : impactData ? (
                    <div className="space-y-1.5 text-gray-700">
                      <div className="flex justify-between items-center">
                        <span>Active Student Overrides affected:</span>
                        <span
                          className={`font-mono font-bold ${
                            impactData.overrides_count > 0 ? "text-rose-600" : "text-gray-900"
                          }`}
                        >
                          {impactData.overrides_count}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Cohorts using this template:</span>
                        <span className="font-mono font-bold text-gray-900">
                          {impactData.cohorts_using_template}
                        </span>
                      </div>
                      {impactData.overrides_count > 0 && (
                        <p className="text-[11px] text-rose-700 font-medium pt-1 border-t border-gray-200">
                          Warning: Deleting this elective slot will cascade and remove all {impactData.overrides_count} student override assignment(s).
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setRowToDelete(null);
                  setImpactData(null);
                }}
                disabled={isDeletingRow}
                className="px-4 py-2 text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingRow || isLoadingImpact}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeletingRow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

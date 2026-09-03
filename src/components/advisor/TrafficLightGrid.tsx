import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Layers,
  ChevronDown,
  Unlock,
} from 'lucide-react';

export interface CourseAuditItem {
  course_code: string;
  course_name: string;
  credits: number;
  grade: string;
  grade_point: number;
  semester: string;
  status: string;
  domain?: string;
  traffic_light: 'GREEN' | 'YELLOW' | 'RED';
  prerequisite_met: boolean;
  missing_prerequisites?: string[];
  is_ai_parsed?: boolean;
  is_overridden?: boolean;
  override_reason?: string;
}

interface TrafficLightGridProps {
  records: CourseAuditItem[];
  onOverrideCourse?: (courseCode: string, reason: string, notes: string) => void;
  canOverride?: boolean;
}

export function TrafficLightGrid({
  records,
  onOverrideCourse,
  canOverride = true,
}: TrafficLightGridProps) {
  const [filter, setFilter] = useState<'ALL' | 'GREEN' | 'YELLOW' | 'RED'>('ALL');
  const [selectedOverrideCourse, setSelectedOverrideCourse] = useState<CourseAuditItem | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>('Equivalent Transfer Approved');
  const [overrideNotes, setOverrideNotes] = useState<string>('');

  const filteredRecords = records.filter((r) => {
    if (filter === 'ALL') return true;
    return r.traffic_light === filter;
  });

  const greenCount = records.filter((r) => r.traffic_light === 'GREEN').length;
  const yellowCount = records.filter((r) => r.traffic_light === 'YELLOW').length;
  const redCount = records.filter((r) => r.traffic_light === 'RED').length;

  const handleConfirmOverride = () => {
    if (selectedOverrideCourse && onOverrideCourse) {
      onOverrideCourse(selectedOverrideCourse.course_code, overrideReason, overrideNotes);
      setSelectedOverrideCourse(null);
      setOverrideNotes('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Courses ({records.length})
          </button>
          <button
            onClick={() => setFilter('RED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
              filter === 'RED'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Alerts / Missing ({redCount})</span>
          </button>
          <button
            onClick={() => setFilter('YELLOW')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
              filter === 'YELLOW'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>In-Progress ({yellowCount})</span>
          </button>
          <button
            onClick={() => setFilter('GREEN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
              filter === 'GREEN'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Valid & Passed ({greenCount})</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-medium">
          Showing {filteredRecords.length} records
        </span>
      </div>

      {/* Grid Matrix */}
      {filteredRecords.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/60">
          <p className="text-xs font-medium text-slate-500">No courses match this filter category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredRecords.map((item, idx) => {
            const isRed = item.traffic_light === 'RED';
            const isYellow = item.traffic_light === 'YELLOW';
            const isGreen = item.traffic_light === 'GREEN';

            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all relative ${
                  isRed
                    ? 'bg-rose-50/40 border-rose-200 shadow-xs'
                    : isYellow
                    ? 'bg-amber-50/40 border-amber-200 shadow-xs'
                    : 'bg-emerald-50/30 border-emerald-200/80'
                }`}
              >
                {/* Header: Code + Badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg border ${
                        isRed
                          ? 'bg-rose-100/80 text-rose-800 border-rose-300'
                          : isYellow
                          ? 'bg-amber-100/80 text-amber-800 border-amber-300'
                          : 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {item.course_code}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {item.credits} Cr
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.is_ai_parsed && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-extrabold ${
                        isRed
                          ? 'bg-rose-600 text-white'
                          : isYellow
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.grade}
                    </span>
                  </div>
                </div>

                {/* Course Name */}
                <h4 className="font-semibold text-xs text-slate-900 mt-2 line-clamp-1">
                  {item.course_name}
                </h4>

                {/* Domain & Semester info */}
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                    {item.domain || 'Core Development'}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">{item.semester}</span>
                </div>

                {/* Missing Prerequisite Warnings */}
                {isRed && item.missing_prerequisites && item.missing_prerequisites.length > 0 && (
                  <div className="mt-2.5 p-2 rounded-xl bg-rose-100/80 border border-rose-300 text-rose-900 text-[11px] space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Missing Prerequisite:</span>
                    </div>
                    <div className="font-mono font-medium pl-4">
                      {item.missing_prerequisites.join(', ')}
                    </div>
                  </div>
                )}

                {/* Overridden state indicator */}
                {item.is_overridden && (
                  <div className="mt-2 p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-600" />
                    <span>Override: {item.override_reason}</span>
                  </div>
                )}

                {/* Manual Override Action for Red items */}
                {isRed && canOverride && (
                  <button
                    onClick={() => setSelectedOverrideCourse(item)}
                    className="mt-3 w-full py-1.5 px-3 rounded-xl bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 hover:text-rose-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Manual Advisor Override</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Override Modal */}
      {selectedOverrideCourse && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Advisor Prerequisite Override</h3>
            </div>
            <p className="text-xs text-slate-500">
              Granting an override for{' '}
              <strong className="text-slate-800 font-mono">{selectedOverrideCourse.course_code}</strong>{' '}
              ({selectedOverrideCourse.course_name}).
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Override Justification
                </label>
                <select
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Equivalent Transfer Approved">Equivalent Transfer Approved (External Credit)</option>
                  <option value="Dean / Faculty Exemption Granted">Dean / Faculty Exemption Granted</option>
                  <option value="Prerequisite Concurrent Waiver">Prerequisite Concurrent Waiver (Co-requisite)</option>
                  <option value="Diploma / Foundation Direct Articulation">Diploma / Foundation Direct Articulation</option>
                  <option value="Other Formal Institutional Waiver">Other Formal Institutional Waiver</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Advisor Reference Notes (Optional)
                </label>
                <textarea
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="e.g. Approved via Senate Meeting No. 4/2025 or Equivalent from UTM SPACE diploma."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setSelectedOverrideCourse(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOverride}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Confirm Override</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

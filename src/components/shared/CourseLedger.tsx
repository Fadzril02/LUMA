import React from "react";
import { Clock, Layers } from "lucide-react";

export interface CourseLedgerRecord {
  code: string;
  name: string;
  credits: number;
  grade: string;
  grade_point?: number;
  semester?: string;
  status: string;
  // Advisor-only diagnostic fields (optional)
  prerequisite_met?: boolean;
  missing_prerequisites?: string[];
  is_ai_parsed?: boolean;
  attempt_count?: number;
  override_flag?: boolean;
}

export interface LedgerColumn<T = CourseLedgerRecord> {
  key: string;
  header: React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  render: (record: T) => React.ReactNode;
}

export interface CourseLedgerProps {
  records: CourseLedgerRecord[];
  columns: LedgerColumn<CourseLedgerRecord>[];
  title?: string;
  subtitle?: React.ReactNode;
  emptyMessage?: string;
  icon?: React.ReactNode;
  getRowClassName?: (record: CourseLedgerRecord) => string;
}

export function CourseLedger({
  records,
  columns,
  title = "Course Ledger",
  subtitle,
  emptyMessage,
  icon,
  getRowClassName,
}: CourseLedgerProps) {
  const ledgerIcon = icon || <Layers size={16} className="text-blue-900" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ledgerIcon}
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        </div>
        {subtitle !== undefined ? (
          <span className="text-xs font-mono text-gray-500">{subtitle}</span>
        ) : (
          <span className="text-xs font-mono text-gray-500">{records.length} Courses</span>
        )}
      </div>

      {records.length === 0 ? (
        <div className="p-10 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
            <Clock size={20} />
          </div>
          <h4 className="text-sm font-bold text-gray-900">No Records Found</h4>
          <p className="text-xs text-gray-500 max-w-xs mt-1 leading-relaxed">
            {emptyMessage || "No academic records are available at this time."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/60 text-gray-500 border-b border-gray-200">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-5 py-3 font-semibold uppercase tracking-wider ${col.headerClassName || ""}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((course, idx) => (
                <tr
                  key={course.code ? `${course.code}-${idx}` : idx}
                  className={`hover:bg-gray-50/60 transition-colors ${
                    getRowClassName ? getRowClassName(course) : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-3 ${col.cellClassName || ""}`}
                    >
                      {col.render(course)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
